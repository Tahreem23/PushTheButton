/* ============================================================
   SmugButtonScreen — mobile Level 3: "The Smug Button."

   Escalation from Level 2 (ElusiveButtonScreen):
     - ~30% faster movement
     - ~30% smaller button (still a comfortable touch target)
     - Smug banter: occasional taunts while roaming

   Same core mechanic: continuous rAF-driven bouncing zigzag,
   random deflection on wall hits, one tap to catch. No mouse
   proximity, no teleportation, no decoys.

   Movement logic mirrors Level 2 exactly (copy, not import —
   globals, no modules). The only differences are the tuning
   numbers, the banter system, and the level id ("smug").

   All rAF loops, timers, and listeners die in unmounted().

   Emits: next, replay, home.
   ============================================================ */

/* ---- Tuning -------------------------------------------------- */

const SMUG_MOBILE_TUNING = {
  speed: 224,           // 40% faster than Level 2's 160
  edgeMargin: 10,
  buttonScale: 0.56,    // ~30% smaller than Level 2's 0.8
  bounceDeflect: 15,    // degrees of random deflection per bounce
  banterInterval: 3000, // ms between automatic taunts
  bowDelay: 650,
  panelDelay: 1500,
};

/* ---- Dialogue ------------------------------------------------ */

const SMUG_MOBILE_BANTER = {
  start: "Catch me!",
  success: "Oh darn it… you got me!",
  taunts: [
    "Haha, you can't catch me!",
    "Too slow!",
    "Catch me if you can!",
    "You missed me!",
    "Almost!",
    "Nice try!",
    "Not so fast!",
    "You're getting closer!",
  ],
};

/* ============================================================ */

const SmugButtonScreen = {
  name: "SmugButtonScreen",
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
      class="screen evasive-screen elusive-screen smug-mobile-screen"
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

      /* ---- movement ---- */
      pos: { x: 0, y: 0 },
      ready: false,
      caught: false,

      /* ---- banter ---- */
      bubbleText: SMUG_MOBILE_BANTER.start,
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
        "--button-size": `calc(clamp(120px, 26vmin, 176px) * ${SMUG_MOBILE_TUNING.buttonScale})`,
      };
    },
  },

  created() {
    GameStore.startLevel("smug");

    this._raf = null;
    this._lastTime = null;
    this._velocity = { x: 0, y: 0 };
    this._timers = [];
    this._banterTimer = null;
    this._onResize = () => this.onResize();
    window.addEventListener("resize", this._onResize);
  },

  mounted() {
    this.$nextTick(() => {
      this.measure();
      this.placeInitial();

      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          this.ready = true;
          this.startMovement();
          this.startBanterCycle();
        })
      );
    });
  },

  unmounted() {
    this.stopMovement();
    this.stopBanterCycle();
    window.removeEventListener("resize", this._onResize);
    this._timers.forEach(clearTimeout);
  },

  methods: {
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
      const m = SMUG_MOBILE_TUNING.edgeMargin;
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
      const cx = (b.minX + b.maxX) / 2;
      const cy = (b.minY + b.maxY) / 2;
      const spread = Math.min(b.maxX - b.minX, b.maxY - b.minY) * 0.25;
      this.pos = {
        x: clampToRange(cx + (Math.random() * 2 - 1) * spread, b.minX, b.maxX),
        y: clampToRange(cy + (Math.random() * 2 - 1) * spread, b.minY, b.maxY),
      };

      const quadrant = Math.floor(Math.random() * 4);
      const base = (quadrant * Math.PI) / 2;
      const offset = (25 + Math.random() * 40) * (Math.PI / 180);
      const angle = base + offset;
      this._velocity = {
        x: Math.cos(angle) * SMUG_MOBILE_TUNING.speed,
        y: Math.sin(angle) * SMUG_MOBILE_TUNING.speed,
      };
    },

    /* ---- Continuous movement via rAF ---- */

    startMovement() {
      this._lastTime = performance.now();
      this._raf = requestAnimationFrame((t) => this.tick(t));
    },

    tick(now) {
      if (this.caught) return;

      const dt = Math.min((now - this._lastTime) / 1000, 0.05);
      this._lastTime = now;

      const b = this.bounds();
      let { x, y } = this.pos;
      let vx = this._velocity.x;
      let vy = this._velocity.y;

      x += vx * dt;
      y += vy * dt;

      let bounced = false;

      if (x <= b.minX) { x = b.minX; vx = Math.abs(vx); bounced = true; }
      else if (x >= b.maxX) { x = b.maxX; vx = -Math.abs(vx); bounced = true; }

      if (y <= b.minY) { y = b.minY; vy = Math.abs(vy); bounced = true; }
      else if (y >= b.maxY) { y = b.maxY; vy = -Math.abs(vy); bounced = true; }

      if (bounced) {
        const maxDeg = SMUG_MOBILE_TUNING.bounceDeflect;
        const deflect = ((Math.random() * 2 - 1) * maxDeg * Math.PI) / 180;
        const cos = Math.cos(deflect);
        const sin = Math.sin(deflect);
        const nvx = vx * cos - vy * sin;
        const nvy = vx * sin + vy * cos;
        vx = nvx;
        vy = nvy;

        const spd = Math.hypot(vx, vy);
        if (spd > 0) {
          const scale = SMUG_MOBILE_TUNING.speed / spd;
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

    /* ---- Banter ---- */

    startBanterCycle() {
      this._banterTimer = this.later(
        () => this.nextTaunt(),
        SMUG_MOBILE_TUNING.banterInterval
      );
    },

    nextTaunt() {
      if (this.caught || this.leaving) return;

      const pool = SMUG_MOBILE_BANTER.taunts;
      let line = this.bubbleText;
      while (line === this.bubbleText) {
        line = pool[Math.floor(Math.random() * pool.length)];
      }
      this.bubbleText = line;
      this.bubbleTick++;

      this._banterTimer = this.later(
        () => this.nextTaunt(),
        SMUG_MOBILE_TUNING.banterInterval
      );
    },

    stopBanterCycle() {
      if (this._banterTimer) {
        clearTimeout(this._banterTimer);
        this._banterTimer = null;
      }
    },

    /* ---- Interaction ---- */

    /* Freeze movement while the finger is down so the button can't
       slide out from under the tap. If the press cancels (finger
       slides off), resume movement from wherever it stopped. */
    onPressStart() {
      if (this.caught) return;
      this.stopMovement();
      this._pressing = true;

      // PushButton doesn't emit cancel, so listen on the element
      // directly for the gesture's end.
      const el = this.$refs.button?.$refs?.el;
      if (!el) return;

      const cleanup = () => {
        el.removeEventListener("pointerup", cleanup);
        el.removeEventListener("pointercancel", cleanup);
        el.removeEventListener("pointerleave", cleanup);
        this._pressing = false;
        // Delay one tick: if pointerup also triggers onSuccess,
        // caught will be true by then and we skip the restart.
        this.later(() => {
          if (!this.caught) this.startMovement();
        }, 0);
      };
      el.addEventListener("pointerup", cleanup);
      el.addEventListener("pointercancel", cleanup);
      el.addEventListener("pointerleave", cleanup);
    },

    onSuccess() {
      if (this.caught) return;
      this.caught = true;
      this.stopMovement();
      this.stopBanterCycle();

      GameStore.recordPress();
      GameStore.completeLevel();

      this.bubbleText = SMUG_MOBILE_BANTER.success;
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
      }, SMUG_MOBILE_TUNING.bowDelay);

      this.later(() => (this.panelVisible = true), SMUG_MOBILE_TUNING.panelDelay);
    },
  },
};
