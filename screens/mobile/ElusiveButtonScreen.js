/* ============================================================
   ElusiveButtonScreen — the mobile "Elusive Button" level.

   The mobile counterpart to the desktop "evasive" level. Same
   place in LEVEL_ORDER (id "evasive", Level 2), different feel:
   on a touch screen there is no cursor to spook the button, so
   instead it just roams — gliding to a fresh random spot every
   beat, daring the player to tap it mid-stride.

   One tap on the moving button is the whole objective:
     1. movement freezes under the finger (so the press commits),
     2. the existing button press animation plays,
     3. the button delivers its last line,
     4. the level completes and the next id in LEVEL_ORDER loads.

   Movement is driven by a self-cleaning timeout cycle (no
   pointer tracking, no animation loop). All timers and the
   resize listener die in unmounted().

   Emits: next, replay, home.
   ============================================================ */

/* Every tunable for this puzzle lives here — nowhere else.
   Speed/distance are exposed for playtesting; the defaults are
   forgiving, appropriate for the second level. */
const ELUSIVE_TUNING = {
  moveInterval: 950,  // ms between jumps — the beat of the roam
  moveDuration: 700,  // glide length (ms) — drives the CSS transition
  edgeMargin: 14,     // px breathing room between the mover and the stage edge
  buttonScale: 0.8,   // smaller than the home button, still a comfy touch target
  banterCooldown: 1100, // ms between miss taunts — no spamming
  bowDelay: 650,      // let "Oh darn it…" land before the stage bows
  panelDelay: 1500,   // …and before the success panel takes over
};

/* The button's whole vocabulary. Short lines only. */
const ELUSIVE_BANTER = {
  start: "Catch me!",
  success: "Oh darn it… you got me!",
  taunts: [
    "Catch me!",
    "Too slow!",
    "Almost!",
    "Missed me!",
    "You can't catch me!",
    "Haha!",
  ],
};

const clampToRange = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const ElusiveButtonScreen = {
  name: "ElusiveButtonScreen",
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

  template: /* html */ `
    <div
      class="screen evasive-screen elusive-screen"
      :class="{ 'is-hit': hitTick, 'is-leaving': leaving }"
    >
      <level-header :level="store.level" />

      <p class="elusive__instruction">Tap the button!</p>

      <game-area>
        <div class="evasive-canvas" ref="arena" @pointerdown="onArenaPointerDown">
          <div
            ref="mover"
            class="evasive-mover"
            :class="{ 'is-gliding': gliding }"
            :style="moverStyle"
          >
            <div class="evasive-bubble-anchor">
              <!-- :key re-mounts the bubble per line, replaying its pop-in.
                   --banter exempts it from the hover-excitement wobble. -->
              <speech-bubble
                :key="tauntTick"
                class="speech-bubble--banter"
                :text="taunt"
              />
            </div>

            <div ref="slot" class="evasive-slot" :style="slotStyle">
              <push-button
                ref="button"
                :disabled="!store.buttonEnabled"
                @press="onPressStart"
                @success="onSuccess"
              />
              <celebration-burst :burst="burstCount" />
            </div>
          </div>
        </div>
      </game-area>

      <div v-if="panelVisible" class="evasive-overlay">
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

      /* ---- movement state ---- */
      pos: { x: 0, y: 0 }, // mover's top-left inside the stage (px)
      ready: false,        // measured & placed — safe to show
      gliding: false,      // CSS glide enabled (off until initial placement)
      caught: false,       // the tap landed for good — roaming is over

      /* ---- banter ---- */
      taunt: ELUSIVE_BANTER.start,
      tauntTick: 0,        // bumped per line so the bubble re-pops
      bantering: false,    // miss-taunt cooldown — no spamming

      /* ---- success ceremony (shared shape across levels) ---- */
      burstCount: 0,
      flashing: false,
      hitTick: false,
      leaving: false,
      panelVisible: false,
    };
  },

  computed: {
    moverStyle() {
      return {
        transform: `translate(${this.pos.x}px, ${this.pos.y}px)`,
        visibility: this.ready ? "visible" : "hidden",
        "--move-duration": ELUSIVE_TUNING.moveDuration + "ms",
      };
    },

    /* Smaller than the home button — still a comfortable touch
       target — scaled whole via --button-size so every part of the
       approved design shrinks proportionally. */
    slotStyle() {
      return {
        "--button-size": `calc(clamp(120px, 26vmin, 176px) * ${ELUSIVE_TUNING.buttonScale})`,
      };
    },
  },

  created() {
    // Entering the level resets its session state (replay included).
    GameStore.startLevel("evasive");

    // Session-only plumbing, all torn down in unmounted().
    this._timers = [];
    this._moveTimer = null;
    this._onResize = () => this.onResize();
    window.addEventListener("resize", this._onResize);
  },

  mounted() {
    // First paint: measure, place the button, then arm the glide
    // and start the roam. Two frames later so the initial placement
    // never visibly animates in from 0,0.
    this.$nextTick(() => {
      this.measure();
      this.pos = this.initialPos();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          this.ready = true;
          this.gliding = true;
          this.startMovement();
        })
      );
    });
  },

  unmounted() {
    this.stopMovement();
    window.removeEventListener("resize", this._onResize);
    this._timers.forEach(clearTimeout);
  },

  methods: {
    /* Self-cleaning timeout — every timer dies with the screen. */
    later(fn, ms) {
      const id = setTimeout(fn, ms);
      this._timers.push(id);
      return id;
    },

    /* Cache every measurement the roam needs, once per layout. */
    measure() {
      const arena = this.$refs.arena.getBoundingClientRect();
      const mover = this.$refs.mover.getBoundingClientRect();
      this._arena = { w: arena.width, h: arena.height };
      this._mover = { w: mover.width, h: mover.height };
    },

    onResize() {
      this.measure();
      const b = this.bounds();
      this.pos = {
        x: clampToRange(this.pos.x, b.minX, b.maxX),
        y: clampToRange(this.pos.y, b.minY, b.maxY),
      };
    },

    /* The mover's box may never cross the stage boundary. */
    bounds() {
      const m = ELUSIVE_TUNING.edgeMargin;
      return {
        minX: m,
        minY: m,
        maxX: Math.max(m, this._arena.w - this._mover.w - m),
        maxY: Math.max(m, this._arena.h - this._mover.h - m),
      };
    },

    /* Opening spot: anywhere in bounds, biased toward center so the
       button doesn't spawn in a corner. */
    initialPos() {
      const b = this.bounds();
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      const spread = Math.min(b.maxX - b.minX, b.maxY - b.minY) * 0.3;
      return {
        x: clampToRange(cx + (Math.random() * 2 - 1) * spread, b.minX, b.maxX),
        y: clampToRange(cy + (Math.random() * 2 - 1) * spread, b.minY, b.maxY),
      };
    },

    /* The roam: every beat, glide to a fresh random spot. */
    startMovement() {
      this.scheduleNextMove();
    },

    scheduleNextMove() {
      if (this.caught) return;
      this._moveTimer = setTimeout(() => {
        if (this.caught) return;
        this.pickSpot();
        this.scheduleNextMove();
      }, ELUSIVE_TUNING.moveInterval);
    },

    /* A new, fair landing spot — fully inside the stage. */
    pickSpot() {
      const b = this.bounds();
      // Bias toward a real relocation: prefer spots a decent jump from
      // the current center, falling back to any in-bounds point.
      const c = { x: this.pos.x, y: this.pos.y };
      for (let i = 0; i < 8; i++) {
        const x = b.minX + Math.random() * (b.maxX - b.minX);
        const y = b.minY + Math.random() * (b.maxY - b.minY);
        if (Math.hypot(x - c.x, y - c.y) >= this._mover.w * 0.5) {
          this.pos = { x, y };
          return;
        }
      }
      this.pos = {
        x: b.minX + Math.random() * (b.maxX - b.minX),
        y: b.minY + Math.random() * (b.maxY - b.minY),
      };
    },

    stopMovement() {
      if (this._moveTimer) {
        clearTimeout(this._moveTimer);
        this._moveTimer = null;
      }
    },

    /* A tap landed on the button. Freeze any in-flight glide right
       where it is, or the button would slide out from under the
       finger and the press would cancel — it must never steal a
       landed tap. Movement stops here for good. */
    onPressStart() {
      if (this.caught) return;
      this.stopMovement();

      if (!this.gliding) return;
      const m = new DOMMatrixReadOnly(getComputedStyle(this.$refs.mover).transform);
      this.gliding = false;
      this.pos = { x: m.e, y: m.f };
      // Gliding stays off — the button is caught, no more roaming.
    },

    /* A tap missed the button (landed on the stage). Tease the
       player — once in a while, never spamming. */
    onArenaPointerDown(e) {
      if (this.caught || this.leaving) return;
      if (e.target.closest(".push-button")) return; // the button handles its own
      if (this.bantering) return;

      this.taunt = this.pickTaunt();
      this.tauntTick++;
      this.bantering = true;
      this.later(() => (this.bantering = false), ELUSIVE_TUNING.banterCooldown);
    },

    /* Short, varied, never the same line twice in a row. */
    pickTaunt() {
      const pool = ELUSIVE_BANTER.taunts;
      let next = this.taunt;
      while (next === this.taunt) {
        next = pool[Math.floor(Math.random() * pool.length)];
      }
      return next;
    },

    /* The objective: one tap. Roaming stops here; the ceremony
       mirrors every other level — bow out, then the panel. */
    onSuccess() {
      if (this.caught) return;
      this.caught = true;
      this.stopMovement();

      GameStore.recordPress();
      GameStore.completeLevel();

      // The button gets the last word.
      this.taunt = ELUSIVE_BANTER.success;
      this.tauntTick++;
      this.bantering = false;

      this.burstCount++;

      this.later(() => {
        this.leaving = true;
        this.flashing = true;
        this.hitTick = true;
        this.later(() => {
          this.flashing = false;
          this.hitTick = false;
        }, 280);
      }, ELUSIVE_TUNING.bowDelay);

      this.later(() => (this.panelVisible = true), ELUSIVE_TUNING.panelDelay);
    },
  },
};
