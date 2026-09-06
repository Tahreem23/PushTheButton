/* ============================================================
   ElusiveButtonScreen — mobile Level 2: "The Elusive Button."

   The button moves continuously around the play area, bouncing
   off boundaries. The player must time a tap to catch it. No
   mouse-proximity detection — the button just keeps moving and
   the player watches, anticipates, and taps.

   Movement is driven by requestAnimationFrame for smooth,
   frame-rate-independent motion. The button travels in a
   straight line at constant speed, reversing the relevant
   velocity component when it hits a wall.

   One tap on the moving button is the whole objective:
     1. movement freezes under the finger,
     2. the existing button press animation plays,
     3. the button delivers its last line,
     4. the level completes and the next id in LEVEL_ORDER loads.

   All animation frames and timers are cleaned up in unmounted().

   Emits: next, replay, home.
   ============================================================ */

/* Every tunable for this puzzle lives here — nowhere else.
   Speed is in px/s; adjust after playtesting. */
const ELUSIVE_TUNING = {
  speed: 160,           // px per second — moderate, forgiving
  edgeMargin: 10,       // px breathing room from the stage edge
  buttonScale: 0.8,     // smaller than home, still a comfy touch target
  bounceDeflect: 15,    // max degrees of random deflection on each wall bounce
  bowDelay: 650,        // let success line land before the stage bows
  panelDelay: 1500,     // …and before the success panel takes over
};

/* The button's vocabulary — Level 2 keeps it simple: just
   "Press me!" at all times, with a single success line.
   Banter/taunts are reserved for Level 3. */
const ELUSIVE_BANTER = {
  start: "Press me!",
  success: "Nice catch!",
};

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

      <game-area>
        <div class="evasive-canvas" ref="arena">
          <div
            ref="mover"
            class="evasive-mover"
            :style="moverStyle"
          >
            <div class="evasive-bubble-anchor">
              <speech-bubble
                :key="bubbleTick"
                class="speech-bubble--banter"
                :text="bubbleText"
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
      pos: { x: 0, y: 0 },
      ready: false,
      caught: false,

      /* ---- speech bubble ---- */
      bubbleText: ELUSIVE_BANTER.start,
      bubbleTick: 0,

      /* ---- success ceremony ---- */
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
      };
    },

    slotStyle() {
      return {
        "--button-size": `calc(clamp(120px, 26vmin, 176px) * ${ELUSIVE_TUNING.buttonScale})`,
      };
    },
  },

  created() {
    GameStore.startLevel("evasive");

    // Session-only plumbing — all torn down in unmounted().
    this._raf = null;
    this._lastTime = null;
    this._velocity = { x: 0, y: 0 };
    this._timers = [];
    this._onResize = () => this.onResize();
    window.addEventListener("resize", this._onResize);
  },

  mounted() {
    this.$nextTick(() => {
      this.measure();
      this.placeInitial();

      // Two frames so the initial position is painted before we
      // reveal the mover — avoids a flash at 0,0.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          this.ready = true;
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

    /* ---- Measurement ---- */

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

    bounds() {
      const m = ELUSIVE_TUNING.edgeMargin;
      return {
        minX: m,
        minY: m,
        maxX: Math.max(m, this._arena.w - this._mover.w - m),
        maxY: Math.max(m, this._arena.h - this._mover.h - m),
      };
    },

    /* ---- Initial placement ---- */

    placeInitial() {
      const b = this.bounds();
      // Start near center with a little randomness.
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      const spread = Math.min(b.maxX - b.minX, b.maxY - b.minY) * 0.25;
      this.pos = {
        x: clampToRange(cx + (Math.random() * 2 - 1) * spread, b.minX, b.maxX),
        y: clampToRange(cy + (Math.random() * 2 - 1) * spread, b.minY, b.maxY),
      };

      // Pick a diagonal-ish angle so the path is always interesting.
      // Quadrant chosen randomly, then biased 25°–65° off the axis
      // so the button never travels nearly straight up/down or sideways.
      const quadrant = Math.floor(Math.random() * 4);
      const base = (quadrant * Math.PI) / 2;
      const offset = (25 + Math.random() * 40) * (Math.PI / 180); // 25°–65°
      const angle = base + offset;
      this._velocity = {
        x: Math.cos(angle) * ELUSIVE_TUNING.speed,
        y: Math.sin(angle) * ELUSIVE_TUNING.speed,
      };
    },

    /* ---- Continuous movement via rAF ---- */

    startMovement() {
      this._lastTime = performance.now();
      this._raf = requestAnimationFrame((t) => this.tick(t));
    },

    tick(now) {
      if (this.caught) return;

      const dt = Math.min((now - this._lastTime) / 1000, 0.05); // cap at 50ms to avoid big jumps
      this._lastTime = now;

      const b = this.bounds();
      let { x, y } = this.pos;
      let vx = this._velocity.x;
      let vy = this._velocity.y;

      x += vx * dt;
      y += vy * dt;

      // Bounce off walls with a random deflection so the path
      // never settles into a boring repeating loop.
      let bounced = false;

      if (x <= b.minX) { x = b.minX; vx = Math.abs(vx); bounced = true; }
      else if (x >= b.maxX) { x = b.maxX; vx = -Math.abs(vx); bounced = true; }

      if (y <= b.minY) { y = b.minY; vy = Math.abs(vy); bounced = true; }
      else if (y >= b.maxY) { y = b.maxY; vy = -Math.abs(vy); bounced = true; }

      if (bounced) {
        // Rotate velocity by a small random angle on each bounce.
        const maxDeg = ELUSIVE_TUNING.bounceDeflect;
        const deflect = ((Math.random() * 2 - 1) * maxDeg * Math.PI) / 180;
        const cos = Math.cos(deflect);
        const sin = Math.sin(deflect);
        const nvx = vx * cos - vy * sin;
        const nvy = vx * sin + vy * cos;
        vx = nvx;
        vy = nvy;

        // Ensure speed stays constant after deflection (no drift from
        // floating-point accumulation across many bounces).
        const spd = Math.hypot(vx, vy);
        if (spd > 0) {
          const scale = ELUSIVE_TUNING.speed / spd;
          vx *= scale;
          vy *= scale;
        }
      }

      this._velocity.x = vx;
      this._velocity.y = vy;
      this.pos = { x, y };

      this._raf = requestAnimationFrame((t) => this.tick(t));
    },

    stopMovement() {
      if (this._raf) {
        cancelAnimationFrame(this._raf);
        this._raf = null;
      }
    },

    /* ---- Interaction ---- */

    /* A tap landed on the button — freeze movement immediately so the
       press can commit. The button must never slide away mid-press. */
    onPressStart() {
      if (this.caught) return;
      this.stopMovement();
    },

    /* The objective: one tap. The ceremony mirrors every other level. */
    onSuccess() {
      if (this.caught) return;
      this.caught = true;
      this.stopMovement();

      GameStore.recordPress();
      GameStore.completeLevel();

      // Swap the bubble to the success line.
      this.bubbleText = ELUSIVE_BANTER.success;
      this.bubbleTick++;

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
