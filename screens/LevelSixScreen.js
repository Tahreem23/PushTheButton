/* ============================================================
   LevelSixScreen — Level 6: keep your eyes on the button.

   One button. It pops into view somewhere random, shouts at you
   for a moment, and vanishes — then pops up somewhere else.
   There is exactly one way to win: notice it, get there, press
   it before the lights go out. Observation + reaction, no luck.

   The cycle, on tracked timers, until caught:
     appear (fresh random spot + a shout) → visibleFor
       → vanish (a parting quip) → hiddenFor → appear …

   The quip bubble lives OUTSIDE the button's station, so the
   button can vanish while its last word lingers behind.

   Emits: next, replay, home.
   ============================================================ */

/* Every tunable for this puzzle lives here — nowhere else. */
const LEVEL6_TUNING = {
  buttonScale: 0.3,       // sneaky and small — same design, token × this
  visibleFor: 700,       // ms per appearance — notice + get there in time
  hiddenFor: 450,         // ms of darkness between appearances
  edgeMargin: 56,         // keep the whole button inside the stage
  topMargin: 110,         // … and clear of the instruction line
  minAppearDistance: 150, // px: a reappearance must feel like a NEW spot
  centerClearance: 0.3,   // never pop up within this fraction of min(W,H)
                          // of dead center — too obvious, too easy
  findAttempts: 16,       // placement rerolls before accepting the closest
  bowDelay: 1000,         // let "Ah, you got me!" land, then stage bows out
  panelDelay: 1600,       // … then the success panel takes over
};

/* Every line it knows. Short only — it's shouting, not lecturing. */
const LEVEL6_BANTER = {
  success: "Ah, you got me!",
  appears: [
    "PRESS ME!",
    "Quick!",
    "I'm right here!",
    "Come on, press me!",
    "You see me?",
    "Hurry!",
    "Catch me!",
    "I'm over here!",
  ],
  vanishes: ["Too slow!", "Bye!", "Missed me!"],
};

function pickBlinkLine(pool, current) {
  let next = current;
  while (next === current) {
    next = pool[Math.floor(Math.random() * pool.length)];
  }
  return next;
}

const LevelSixScreen = {
  name: "LevelSixScreen",
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
    <div class="screen teleport-screen" :class="{ 'is-hit': hitTick, 'is-leaving': leaving }">
      <level-header :level="store.level" />

      <game-area>
        <div class="teleport-canvas" ref="canvas">
          <div class="teleport-intro">
            <p class="teleport-intro__title">Keep your eyes on the button.</p>
          </div>

          <!-- Its running commentary, positioned independently so the
               button may vanish mid-sentence. -->
          <div v-if="quip" :key="quipTick" class="teleport-quip" :style="quipStyle">
            <speech-bubble class="speech-bubble--banter" :text="quip" />
          </div>

          <!-- The teleporting button itself. Hidden with opacity only so
               no layout churn; pointer-events gate clicks to is-visible. -->
          <div
            ref="station"
            class="teleport-station"
            :class="{ 'is-visible': visible }"
            :style="stationStyle"
          >
            <div ref="slot" class="teleport-slot" :style="slotStyle">
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

      <div v-if="panelVisible" class="teleport-overlay">
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

      /* ---- the cycle ---- */
      visible: false,          // is the button on stage right now?
      pos: { x: 0, y: 0 },     // station's top-left, px inside the canvas
      quip: "",                // current line (empty = bubble hidden)
      quipTick: 0,             // bumped per line so the bubble re-pops

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
    /* Position as CSS vars so the appear-pop keyframes can reuse them. */
    stationStyle() {
      return {
        "--sx": this.pos.x + "px",
        "--sy": this.pos.y + "px",
      };
    },

    /* The quip floats just above the button's current spot. */
    quipStyle() {
      return {
        left: this.pos.x + (this._buttonOffset?.x ?? 0) + "px",
        top: this.pos.y + "px",
      };
    },

    /* The smaller button: same approved design, scaled whole via its
       --button-size token so every part shrinks proportionally. */
    slotStyle() {
      return {
        "--button-size": `calc(clamp(120px, 26vmin, 176px) * ${LEVEL6_TUNING.buttonScale})`,
      };
    },
  },

  created() {
    // Entering the level resets its session state (replay included).
    GameStore.startLevel(6);

    this._timers = [];     // every timeout the level owns
    this._pressing = false; // a press is in flight — the button is pinned

    this._onUp = () => (this._pressing = false);
    window.addEventListener("pointerup", this._onUp, { passive: true });
    window.addEventListener("pointercancel", this._onUp, { passive: true });
  },

  mounted() {
    this.$nextTick(() => {
      this.measure();
      this.appear();
    });
  },

  unmounted() {
    window.removeEventListener("pointerup", this._onUp);
    window.removeEventListener("pointercancel", this._onUp);
    this._timers.forEach(clearTimeout);
  },

  methods: {
    /* Self-cleaning timeout — every timer dies with the screen. */
    later(fn, ms) {
      const id = setTimeout(fn, ms);
      this._timers.push(id);
      return id;
    },

    /* One layout read, once: canvas box + button box + button center
       offset (for positioning the quip above the dome). */
    measure() {
      const canvas = this.$refs.canvas.getBoundingClientRect();
      const slot = this.$refs.slot.getBoundingClientRect();

      this._canvas = { w: canvas.width, h: canvas.height };
      this._station = { w: slot.width, h: slot.height };
      this._buttonOffset = { x: slot.width / 2, y: slot.height / 2 };
    },

    /* A fresh spot inside the stage, clear of the instruction, and a
       real distance from the previous one — never the same place twice
       in a row, never a two-step shuffle. */
    rollSpot() {
      const t = LEVEL6_TUNING;
      const minX = t.edgeMargin;
      const maxX = this._canvas.w - this._station.w - t.edgeMargin;
      const minY = t.topMargin;
      const maxY = this._canvas.h - this._station.h - t.edgeMargin;

      let best = null;
      let bestScore = -Infinity;
      const prev = { x: this.pos.x, y: this.pos.y };
      const center = { x: this._canvas.w / 2, y: this._canvas.h / 2 };
      const clearance = t.centerClearance * Math.min(this._canvas.w, this._canvas.h);

      for (let i = 0; i < t.findAttempts; i++) {
        const cand = {
          x: minX + Math.random() * (maxX - minX),
          y: minY + Math.random() * (maxY - minY),
        };
        const c = { x: cand.x + this._buttonOffset.x, y: cand.y + this._buttonOffset.y };
        const fromPrev = Math.hypot(cand.x - prev.x, cand.y - prev.y);
        const fromCenter = Math.hypot(c.x - center.x, c.y - center.y);

        if (best === null) {
          best = cand; // first appearance: previous is (0,0), any spot wins
          bestScore = Math.min(fromPrev, fromCenter);
          continue;
        }
        // A good spot: clearly new AND nowhere near dead center.
        if (fromPrev >= t.minAppearDistance && fromCenter >= clearance) return cand;
        const score = Math.min(fromPrev, fromCenter);
        if (score > bestScore) {
          bestScore = score;
          best = cand;
        }
      }
      return best;
    },

    /* Lights on: new spot, a shout, then the countdown to vanish. */
    appear() {
      if (this.caught) return;

      this.pos = this.rollSpot();
      this.quip = pickBlinkLine(LEVEL6_BANTER.appears, this.quip);
      this.quipTick++;
      this.visible = true;

      this.later(() => this.vanish(), LEVEL6_TUNING.visibleFor);
    },

    /* Lights out: the button goes, its parting quip stays a beat,
       then the whole show starts over somewhere else.
       Pinned down mid-press? It cannot vanish out from under a finger
       — check back shortly; the press either lands (caught) or lets go. */
    vanish() {
      if (this.caught) return;
      if (this._pressing) {
        this.later(() => this.vanish(), 150);
        return;
      }

      this.visible = false;
      this.quip = pickBlinkLine(LEVEL6_BANTER.vanishes, this.quip);
      this.quipTick++;

      this.later(() => this.appear(), LEVEL6_TUNING.hiddenFor);
    },

    onPressStart() {
      this._pressing = true;
    },

    /* The one press that matters. Kills the cycle dead, delivers the
       last word, then the shared success ceremony. */
    onSuccess() {
      if (this.caught || !this.visible) return;
      this.caught = true;

      // Kill every pending cycle timer before the ceremony takes over.
      this._timers.forEach(clearTimeout);
      this._timers = [];
      this.visible = true; // hold it in place for the press to finish

      GameStore.recordPress();
      GameStore.completeLevel();

      this.quip = LEVEL6_BANTER.success;
      this.quipTick++;
      this.burstCount++;

      this.later(() => {
        this.leaving = true;
        this.flashing = true;
        this.hitTick = true;
        this.later(() => {
          this.flashing = false;
          this.hitTick = false;
        }, 280);
      }, LEVEL6_TUNING.bowDelay);

      this.later(() => (this.panelVisible = true), LEVEL6_TUNING.panelDelay);
    },
  },
};
