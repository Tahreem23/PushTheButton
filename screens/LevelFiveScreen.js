/* ============================================================
   LevelFiveScreen — Level 5: find the button.

   The button IS here. It's fully pressable right now, at a
   freshly-randomized spot. You just can't see it. Sweep the
   cursor around: the warmer you get, the warmer the whispers
   (pinned near your cursor — the button refuses to snitch on
   itself). Enter its hitbox and it pops into view, delighted.
   Press it once. Done.

   Nothing moves. There are no decoys, timers, or penalties.
   Searching is the whole game.

   Emits: next, replay, home.
   ============================================================ */

/* Every tunable for this puzzle lives here — nowhere else. */
const LEVEL5_TUNING = {
  buttonScale: 0.3,    // the hidden button is 40% smaller (token × this)
  warmDistance: 330,   // px from the button's edge: hints begin
  hotDistance: 150,    // px from the button's edge: "Right there…"
  hitSlop: 8,          // extra px past the button's edge that count as ON
  hintCooldown: 1800,  // min ms between whispers
  hintMove: 45,        // min px swept before a cool-down whisper fires
  hintDuration: 1400,  // ms a whisper lingers
  hintLeadTime: 350,   // ms of silence before a triggered whisper appears
  foundBeats: 1500,    // ms the "you found me!" line gets before the
                       // button starts plainly asking to be pressed
  edgeMargin: 56,      // keep button AND its (up to ~12rem) bubble inside
  topMargin: 110,      // … clear of the instruction AND the reaction
                       // bubble, which floats above the button's box
  centerClearance: 0.3, // don't spawn within this fraction of min(W,H)
                        // of stage center (where the last click happened)
  bowDelay: 0,         // press → straight into the ceremony (no last word)
  panelDelay: 550,     // … standard success-panel timing
};

/* Every whisper the button knows. Short only. */
const LEVEL5_BANTER = {
  found: "Ah, you found me!",
  pressMe: "Press me to go to next level!", // after a beat, the objective
  warm: ["Hmm…", "You're getting warmer…", "Warm…", "Warmer…"],
  hot: ["Right there…", "So close…", "Almost on top of it…"],
};

function pickSeekerLine(pool, current) {
  let next = current;
  while (next === current) {
    next = pool[Math.floor(Math.random() * pool.length)];
  }
  return next;
}

const LevelFiveScreen = {
  name: "LevelFiveScreen",
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
    <div class="screen seeker-screen" :class="{ 'is-hit': hitTick, 'is-leaving': leaving }">
      <level-header :level="store.level" />

      <game-area>
        <div class="seeker-canvas" ref="canvas">
          <div class="seeker-intro">
            <p class="seeker-intro__title">Find the button.</p>
          </div>

          <!-- The invisible button: opacity-only hiding keeps the
               hitbox (and the pointer-cursor teaser) alive. -->
          <div
            ref="station"
            class="seeker-station"
            :class="{ 'is-found': found }"
            :style="stationStyle"
          >
            <div class="seeker-bubble-anchor">
              <speech-bubble
                v-if="reaction"
                :key="reactionTick"
                class="speech-bubble--banter"
                :text="reaction"
              />
            </div>

            <div ref="slot" class="seeker-slot" :style="slotStyle">
              <push-button
                ref="button"
                :disabled="!store.buttonEnabled"
                @success="onSuccess"
              />
              <celebration-burst v-if="found" :burst="burstCount" />
            </div>
          </div>

          <!-- The searching whisper: appears beside the cursor, never
               near the button — no location snitching. The WRAPPER owns
               position; the bubble owns its animations (CSS animations
               override transform, so the two can never share an element). -->
          <div
            v-if="hint"
            ref="hintBubble"
            :key="hintTick"
            class="seeker-hint"
            :style="hintStyle"
          >
            <speech-bubble class="speech-bubble--banter" :text="hint" />
          </div>
        </div>
      </game-area>

      <div v-if="panelVisible" class="seeker-overlay">
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
      placed: false,            // measured + positioned (still invisible)
      pos: { x: 0, y: 0 },      // station's top-left inside the stage (px)

      /* ---- the search ---- */
      found: false,

      /* ---- dialogue ---- */
      hint: "",                 // cursor-side whisper while searching
      hintTick: 0,
      hintPos: { x: 0, y: 0 },
      reaction: "",             // the revealed button's own line
      reactionTick: 0,

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
    /* Position as CSS vars so the reveal keyframes can reuse them. */
    stationStyle() {
      return {
        "--sx": this.pos.x + "px",
        "--sy": this.pos.y + "px",
      };
    },

    hintStyle() {
      return { left: this.hintPos.x + "px", top: this.hintPos.y + "px" };
    },

    /* The smaller button: same approved design, scaled whole via its
       --button-size token so every part shrinks proportionally. */
    slotStyle() {
      return {
        "--button-size": `calc(clamp(120px, 26vmin, 176px) * ${LEVEL5_TUNING.buttonScale})`,
      };
    },
  },

  created() {
    // Entering the level resets its session state (replay included).
    GameStore.startLevel(5);

    this._timers = [];
    this._hintT = null;      // hide-hint timer
    this._hintLeadT = null;  // pending whisper (lead time) timer
    this._lastPointer = null; // freshest cursor position (client coords)
    this._lastZone = null;   // current proximity zone (null = cold/far)
    this._lastHintAt = 0;    // last whisper timestamp
    this._lastHintPos = null; // cursor position at the last whisper
  },

  mounted() {
    this._onMove = (e) => this.onPointerMove(e);
    window.addEventListener("pointermove", this._onMove, { passive: true });

    // First paint: measure the stage + station, then roll the hiding spot.
    this.$nextTick(() => {
      this.measure();
      this.pos = this.rollHidingSpot();
      this.placed = true;
    });
  },

  unmounted() {
    window.removeEventListener("pointermove", this._onMove);
    this._timers.forEach(clearTimeout);
  },

  methods: {
    /* Self-cleaning timeout — every timer dies with the screen. */
    later(fn, ms) {
      const id = setTimeout(fn, ms);
      this._timers.push(id);
      return id;
    },

    /* One layout read, once: stage box + station box + button radius. */
    measure() {
      const canvas = this.$refs.canvas.getBoundingClientRect();
      const station = this.$refs.station.getBoundingClientRect();
      const slot = this.$refs.slot.getBoundingClientRect();

      this._canvas = { w: canvas.width, h: canvas.height, left: canvas.left, top: canvas.top };
      this._station = { w: station.width, h: station.height };
      this._buttonOffset = {
        x: slot.left - station.left + slot.width / 2,
        y: slot.top - station.top + slot.height / 2,
      };
      this._buttonRadius = Math.max(slot.width, slot.height) / 2;
    },

    /* The whole hiding spot must fit: margins on every side, extra air
       below the instruction line, and not predictably dead-center. */
    rollHidingSpot() {
      const t = LEVEL5_TUNING;
      const minX = t.edgeMargin;
      const maxX = this._canvas.w - this._station.w - t.edgeMargin;
      const minY = t.topMargin;
      const maxY = this._canvas.h - this._station.h - t.edgeMargin;

      const stageCenter = { x: this._canvas.w / 2, y: this._canvas.h / 2 };
      const clearance = t.centerClearance * Math.min(this._canvas.w, this._canvas.h);

      let pos = null;
      for (let i = 0; i < 12; i++) {
        pos = {
          x: minX + Math.random() * (maxX - minX),
          y: minY + Math.random() * (maxY - minY),
        };
        const c = this.centerAt(pos);
        if (Math.hypot(c.x - stageCenter.x, c.y - stageCenter.y) >= clearance) break;
      }
      return pos;
    },

    centerAt(pos) {
      return { x: pos.x + this._buttonOffset.x, y: pos.y + this._buttonOffset.y };
    },

    /* Cursor (client coords) → distance (px) from the button's EDGE.
       Negative means the cursor is inside the box. */
    distanceFromEdge(clientX, clientY) {
      const p = { x: clientX - this._canvas.left, y: clientY - this._canvas.top };
      const c = this.centerAt(this.pos);
      return { p, d: Math.hypot(p.x - c.x, p.y - c.y) - this._buttonRadius };
    },

    onPointerMove(e) {
      this._lastPointer = { x: e.clientX, y: e.clientY };
      if (!this.placed || this.found || this.caught) return;

      const { p, d } = this.distanceFromEdge(e.clientX, e.clientY);

      // Cursor is on (or practically on) the invisible button → found!
      if (d <= LEVEL5_TUNING.hitSlop) {
        this.reveal();
        return;
      }

      const t = LEVEL5_TUNING;
      const zone = d <= t.hotDistance ? "hot" : d <= t.warmDistance ? "warm" : null;

      if (!zone) {
        this._lastZone = null; // went cold — re-entry may whisper again
        return;
      }

      const entered = zone !== this._lastZone;
      this._lastZone = zone;

      const now = performance.now();
      const cooledDown = now - this._lastHintAt >= t.hintCooldown;
      const sweptFarEnough =
        !this._lastHintPos ||
        Math.hypot(p.x - this._lastHintPos.x, p.y - this._lastHintPos.y) >= t.hintMove;

      // Whisper when a new zone is entered, or when the player keeps
      // sweeping the same zone and the cooldown has elapsed. Never
      // fire on every mouse move.
      if (entered || (cooledDown && sweptFarEnough)) {
        this.queueHint();
      }
    },

    /* A whisper never appears the instant it's triggered — a short
       lead time makes the dialogue feel deliberate, and by the time
       it fires we re-check where the cursor ACTUALLY is; the sweep
       may have moved on (or drifted cold) in the meantime. */
    queueHint() {
      if (this._hintLeadT) return; // one already on its way

      this._lastHintAt = performance.now();
      this._lastHintPos = { ...this._lastPointer };

      this._hintLeadT = this.later(() => {
        this._hintLeadT = null;
        if (this.found || this.caught || !this._lastPointer) return;

        const t = LEVEL5_TUNING;
        const { p, d } = this.distanceFromEdge(this._lastPointer.x, this._lastPointer.y);
        if (d <= t.hitSlop) {
          this.reveal();
          return;
        }
        const zone = d <= t.hotDistance ? "hot" : d <= t.warmDistance ? "warm" : null;
        if (zone) this.showHint(zone, p); // went cold meanwhile → stay quiet
      }, LEVEL5_TUNING.hintLeadTime);
    },

    /* The radar whisper: pinned near the cursor, then re-clamped once
       the bubble's real size is known, so it can never spill off-stage. */
    showHint(zone, p) {
      const t = LEVEL5_TUNING;
      const pool = zone === "hot" ? LEVEL5_BANTER.hot : LEVEL5_BANTER.warm;

      this.hint = pickSeekerLine(pool, this.hint);
      this.hintTick++;
      this.hintPos = { ...p };
      this.$nextTick(() => this.clampHint());

      if (this._hintT) clearTimeout(this._hintT);
      this._hintT = this.later(() => (this.hint = ""), t.hintDuration);
    },

    /* Wrapper transform is translate(-50%, -110%), so its box spans half
       its width each side of the anchor point and its full height above. */
    clampHint() {
      const el = this.$refs.hintBubble;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pad = 10;
      this.hintPos = {
        x: Math.min(Math.max(this.hintPos.x, r.width / 2 + pad), this._canvas.w - r.width / 2 - pad),
        y: Math.min(Math.max(this.hintPos.y, r.height * 1.1 + pad), this._canvas.h - pad),
      };
    },

    /* Cursor crossed the hitbox: the button pops into view and stays.
       (A lucky blind click lands here too — reveal first, ask to
       press properly.) It never moves again. */
    reveal() {
      if (this.found) return;
      this.found = true;

      this.hint = "";
      if (this._hintT) {
        clearTimeout(this._hintT);
        this._hintT = null;
      }

      this.reaction = LEVEL5_BANTER.found;
      this.reactionTick++;

      // Finding it isn't the win — after a beat, it asks for the press.
      this.later(() => {
        if (this.found && !this.caught) {
          this.reaction = LEVEL5_BANTER.pressMe;
          this.reactionTick++;
        }
      }, LEVEL5_TUNING.foundBeats);
    },

    /* The press. If the button was still invisible (a blind click),
       reveal it instead of winning — no accidental victories. */
    onSuccess() {
      if (!this.found) {
        this.reveal();
        // PushButton ended its press in "success" state; stand it
        // back up (after the pop) so the real press lands normally.
        this.later(() => this.$refs.button?.reset(), 480);
        return;
      }

      if (this.caught) return;
      this.caught = true;

      GameStore.recordPress();
      GameStore.completeLevel();

      // Caught with no last word — the button goes quiet and the
      // level completes straight away.
      this.reaction = "";
      this.burstCount++;

      this.later(() => {
        this.leaving = true;
        this.flashing = true;
        this.hitTick = true;
        this.later(() => {
          this.flashing = false;
          this.hitTick = false;
        }, 280);
      }, LEVEL5_TUNING.bowDelay);

      this.later(() => (this.panelVisible = true), LEVEL5_TUNING.panelDelay);
    },
  },
};
