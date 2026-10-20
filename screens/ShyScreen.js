/* ============================================================
   ShyScreen — the "shy" level: the button shrinks as you get close.

   It's slow to react, though. Every frame it eases toward the size
   your distance deserves — but it can only shrink so fast. Creep up
   on it and it hides away completely; back off and it grows back.
   Commit to one quick, decisive move and it's still big enough to
   press when you arrive.

   Never clickable at rest: the resting size at any distance is too
   small to cover the cursor, so hovering never wins — only speed.

   A press that lands freezes the size (a shrink mid-click would
   slide the button out from under the cursor and silently cancel).

   On load it settles somewhere out of the cursor's reach, at full
   size — the player arrives by clicking (Home / Next level), so the
   cursor's position is already known before the level mounts.

   Emits: next, replay, home.
   ============================================================ */

/* Every tunable for this puzzle lives here — nowhere else. */
const SHY_TUNING = {
  range: 240,         // px from the button's CENTER where shyness begins
  shrinkMs: 540,      // fastest possible full-size → gone (the lag)
  growMs: 450,        // gone → full size again once you back off
  nervousBelow: 0.9,  // scale under which it starts protesting
  goneBelow: 0.04,    // scale under which it counts as hidden
  panelDelay: 550,    // standard success-panel timing
  spawnBuffer: 40,    // extra px past range the spawn keeps from the cursor
  edgeMargin: 40,     // keep the button (and its wider bubble) on stage
  topMargin: 90,      // … and room above it for the bubble
};

/* Last known mouse position, kept across screens. Browsers only
   report the cursor when it moves, so this is how the level knows
   where the player is the instant it loads. Two passive listeners
   for the page's lifetime — no level owns them. */
const shyLastPointer = { known: false, x: 0, y: 0 };
["pointermove", "pointerdown"].forEach((type) =>
  window.addEventListener(
    type,
    (e) => {
      if (e.pointerType === "touch") return;
      shyLastPointer.known = true;
      shyLastPointer.x = e.clientX;
      shyLastPointer.y = e.clientY;
    },
    { passive: true, capture: true }
  )
);

/* Everything the button says. Short only. */
const SHY_BANTER = {
  hello: "Hi! I'm a little shy…",
  nervous: "Eek! Too close!",
  gone: "Nope.",
  again: "Okay… but be quick.", // calm again, after it has hidden once
};

const ShyScreen = {
  name: "ShyScreen",
  emits: ["next", "replay", "home"],

  components: {
    LevelHeader,
    SettingsButton,
    GameArea,
    PushButton,
    SpeechBubble,
    CelebrationBurst,
    LevelComplete,
  },

  /* Reuses Level 1's success sequence (level1.css); shy.css adds
     the free-standing station, the shrink wrapper and the wobble. */
  template: /* html */ `
    <div class="screen level1-screen shy-screen" :class="{ 'is-hit': hitTick, 'is-leaving': leaving }">
      <level-header :level="store.level" />

      <game-area>
        <div class="shy-canvas" ref="canvas">
          <div ref="station" class="shy-station" :style="stationStyle">
            <div class="shy-bubble-anchor">
              <speech-bubble
                v-if="line"
                :key="lineTick"
                class="speech-bubble--banter"
                :text="line"
              />
            </div>

            <div ref="slot" class="level1__button-slot">
              <div class="shy-shrinker" :class="{ 'is-gone': mood === 'gone' }" :style="{ '--shy-scale': scale }">
                <div class="shy-wobble" :class="{ 'is-nervous': mood === 'nervous' }">
                  <push-button
                    ref="button"
                    :disabled="!store.buttonEnabled"
                    @press="onPressStart"
                    @success="onSuccess"
                  />
                </div>
              </div>
              <celebration-burst :burst="burstCount" />
            </div>
          </div>
        </div>
      </game-area>

      <div v-if="panelVisible" class="level1-overlay">
        <level-complete
          :level="store.level"
          @next="$emit('next')"
          @replay="$emit('replay')"
          @home="$emit('home')"
        />
      </div>

      <div class="screen-flash" :class="{ 'is-active': flashing }"></div>
    </div>
  `,

  data() {
    return {
      store: GameStore,

      /* ---- placement ---- */
      placed: false,         // measured + positioned — safe to show
      pos: { x: 0, y: 0 },   // station's top-left inside the stage (px)

      /* ---- shyness ---- */
      scale: 1,          // the button's current size (1 = full, 0 = gone)
      mood: "calm",      // calm | nervous | gone — drives the dialogue
      hasHidden: false,  // it vanished at least once (changes its calm line)

      /* ---- dialogue ---- */
      line: SHY_BANTER.hello,
      lineTick: 0,

      /* ---- success ceremony (same beats as every level) ---- */
      burstCount: 0,
      flashing: false,
      hitTick: false,
      caught: false,
      leaving: false,
      panelVisible: false,
    };
  },

  computed: {
    stationStyle() {
      return {
        transform: `translate(${this.pos.x}px, ${this.pos.y}px)`,
        visibility: this.placed ? "visible" : "hidden",
      };
    },
  },

  created() {
    // Entering the level resets its session state (replay included).
    GameStore.startLevel("shy");

    this._timers = [];
    this._raf = null;
    this._lastT = 0;
    // Freshest mouse position (client coords) — usually already known.
    this._pointer = shyLastPointer.known ? { x: shyLastPointer.x, y: shyLastPointer.y } : null;
    this._center = null;   // button center (client coords), cached
    this._pressing = false; // a press is in progress — size frozen
  },

  mounted() {
    this._onMove = (e) => this.onPointerMove(e);
    this._onRelease = () => this.onPressEnd();
    this._onResize = () => this.measure();

    window.addEventListener("pointermove", this._onMove, { passive: true });
    window.addEventListener("pointerup", this._onRelease);
    window.addEventListener("pointercancel", this._onRelease);
    window.addEventListener("resize", this._onResize);

    this.$nextTick(() => {
      this.measure();
      this.pos = this.pickSpawn();
      this.measure();
      // Full size on arrival, even if the stage was too small to spawn
      // fully out of range — it reacts once the cursor moves.
      this.scale = 1;
      this.placed = true;
    });
  },

  unmounted() {
    window.removeEventListener("pointermove", this._onMove);
    window.removeEventListener("pointerup", this._onRelease);
    window.removeEventListener("pointercancel", this._onRelease);
    window.removeEventListener("resize", this._onResize);
    if (this._raf) cancelAnimationFrame(this._raf);
    this._timers.forEach(clearTimeout);
  },

  methods: {
    /* Self-cleaning timeout — every timer dies with the screen. */
    later(fn, ms) {
      const id = setTimeout(fn, ms);
      this._timers.push(id);
      return id;
    },

    /* Layout reads, cached: stage box, station box, and where the
       button's center sits inside the station. The slot never scales
       (only its inner wrapper does), so it's always full size. */
    measure() {
      const canvas = this.$refs.canvas.getBoundingClientRect();
      const station = this.$refs.station.getBoundingClientRect();
      const slot = this.$refs.slot.getBoundingClientRect();

      this._canvas = { w: canvas.width, h: canvas.height, left: canvas.left, top: canvas.top };
      this._station = { w: station.width, h: station.height };
      this._offset = {
        x: slot.left - station.left + slot.width / 2,
        y: slot.top - station.top + slot.height / 2,
      };
      this.pos = this.clampToStage(this.pos);
      this._center = {
        x: canvas.left + this.pos.x + this._offset.x,
        y: canvas.top + this.pos.y + this._offset.y,
      };
    },

    clampToStage(pos) {
      const t = SHY_TUNING;
      const maxX = Math.max(t.edgeMargin, this._canvas.w - this._station.w - t.edgeMargin);
      const maxY = Math.max(t.topMargin, this._canvas.h - this._station.h - t.edgeMargin);
      return {
        x: Math.min(maxX, Math.max(t.edgeMargin, pos.x)),
        y: Math.min(maxY, Math.max(t.topMargin, pos.y)),
      };
    },

    /* Somewhere on stage, out of the cursor's reach. Unknown cursor
       (rare) → stage center; the first move sets its size. */
    pickSpawn() {
      const t = SHY_TUNING;
      const center = this.clampToStage({
        x: (this._canvas.w - this._station.w) / 2,
        y: (this._canvas.h - this._station.h) / 2,
      });
      if (!this._pointer) return center;

      const p = { x: this._pointer.x - this._canvas.left, y: this._pointer.y - this._canvas.top };
      const reach = (pos) => Math.hypot(pos.x + this._offset.x - p.x, pos.y + this._offset.y - p.y);

      // Random spots until one is clear of the cursor; if the stage is
      // too small for that, settle for the farthest one tried.
      const max = this.clampToStage({ x: Infinity, y: Infinity });
      let best = center;
      for (let i = 0; i < 40; i++) {
        const pos = {
          x: t.edgeMargin + Math.random() * (max.x - t.edgeMargin),
          y: t.topMargin + Math.random() * (max.y - t.topMargin),
        };
        if (reach(pos) >= t.range + t.spawnBuffer) return pos;
        if (reach(pos) > reach(best)) best = pos;
      }
      return best;
    },

    /* The size this distance deserves: full at the edge of range,
       nothing at the center. */
    targetScale() {
      if (!this._pointer || !this._center) return 1;
      const d = Math.hypot(this._pointer.x - this._center.x, this._pointer.y - this._center.y);
      return Math.min(1, d / SHY_TUNING.range);
    },

    onPointerMove(e) {
      // Touch has no hover — a finger only exists where it lands.
      if (e.pointerType === "touch") return;

      const first = !this._pointer;
      this._pointer = { x: e.clientX, y: e.clientY };
      if (!this.placed || this.caught || this._pressing) return;

      // First sighting: it was already shy wherever the cursor is —
      // no free window to click it before it has reacted.
      if (first) {
        this.scale = this.targetScale();
        this.updateMood();
        return;
      }
      this.wake();
    },

    /* Run the easing loop only while the size is still catching up. */
    wake() {
      if (this._raf) return;
      this._lastT = performance.now();
      this._raf = requestAnimationFrame((t) => this.tick(t));
    },

    /* The lag: ease toward the target, capped at a fixed rate. */
    tick(now) {
      this._raf = null;
      if (this.caught || this._pressing) return;

      const dt = Math.min(50, now - this._lastT); // tab-switch safe
      this._lastT = now;

      const target = this.targetScale();
      if (this.scale > target) {
        this.scale = Math.max(target, this.scale - dt / SHY_TUNING.shrinkMs);
      } else {
        this.scale = Math.min(target, this.scale + dt / SHY_TUNING.growMs);
      }
      this.updateMood();

      // Still catching up (or the cursor is parked and it keeps
      // shrinking toward it) → next frame. At rest → loop sleeps.
      if (this.scale !== target) {
        this._raf = requestAnimationFrame((t) => this.tick(t));
      }
    },

    /* Mood follows size, with hysteresis so the bubble never
       flickers when the cursor jiggles near a threshold. */
    updateMood() {
      const t = SHY_TUNING;
      let mood = this.mood;
      if (this.scale < t.goneBelow) mood = "gone";
      else if (this.scale < t.nervousBelow && mood === "calm") mood = "nervous";
      else if (this.scale >= 1) mood = "calm";
      else if (mood === "gone" && this.scale > 0.2) mood = "nervous";

      if (mood === this.mood) return;
      this.mood = mood;
      if (mood === "gone") this.hasHidden = true;

      this.say(
        mood === "gone" ? SHY_BANTER.gone
        : mood === "nervous" ? SHY_BANTER.nervous
        : this.hasHidden ? SHY_BANTER.again
        : SHY_BANTER.hello
      );
    },

    say(text) {
      this.line = text;
      this.lineTick++; // re-pop the bubble per line
    },

    /* A press landed: freeze, so it can't shrink out from under it. */
    onPressStart() {
      this._pressing = true;
      if (this._raf) {
        cancelAnimationFrame(this._raf);
        this._raf = null;
      }
    },

    /* Released anywhere. A successful press has already set caught
       (the button's pointerup fires before the window's); otherwise
       the press slipped off — shyness resumes. */
    onPressEnd() {
      if (!this._pressing) return;
      this._pressing = false;
      if (!this.caught) this.wake();
    },

    onSuccess() {
      if (this.caught) return;
      this.caught = true;

      GameStore.recordPress();
      GameStore.completeLevel();

      this.line = "";
      this.burstCount++;
      this.leaving = true;
      this.flashing = true;
      this.hitTick = true;
      this.later(() => {
        this.flashing = false;
        this.hitTick = false;
      }, 280);

      this.later(() => (this.panelVisible = true), SHY_TUNING.panelDelay);
    },
  },
};
