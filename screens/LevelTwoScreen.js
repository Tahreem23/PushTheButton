/* ============================================================
   LevelTwoScreen — Level 2: the button doesn't want to be pressed.

   The button sits innocently in the middle of the stage … until
   the pointer comes too close, at which point it glides away.
   Outsmart it — a well-aimed flick, or cornering it — and land
   ONE press to finish. The success ceremony mirrors Level 1.

   Gameplay truth lives in GameStore; this screen owns only the
   evasion: position, proximity detection, cooldowns, cleanup.
   ============================================================ */

/* All tuning for this puzzle lives here — nowhere else. */
const LEVEL2_TUNING = {
  escapeDistance: 90, // pointer gap (px, from the button's edge) that spooks it
  escapeBuffer: 40,   // extra px a landing spot must keep from the pointer
  minJump: 170,       // never flee a meaningless shuffle …
  maxJump: 360,       // … and never so far the player loses all hope
  moveDuration: 320,  // escape cooldown (ms) — matches the CSS glide
  edgeMargin: 10,     // breathing room between the button and the boundary
  candidates: 14,     // landing spots tried before settling for the best one
};

const clampToRange = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const LevelTwoScreen = {
  name: "LevelTwoScreen",
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
    <div class="screen level2-screen" :class="{ 'is-hit': hitTick, 'is-leaving': leaving }">
      <level-header :level="store.level" />

      <game-area>
        <div class="level2" ref="arena">
          <div
            ref="mover"
            class="level2__mover"
            :class="{ 'is-gliding': gliding }"
            :style="moverStyle"
          >
            <div class="level2__bubble-anchor">
              <transition name="bubble-pop">
                <speech-bubble v-if="bubbleVisible" />
              </transition>
            </div>

            <div ref="slot" class="level2__button-slot">
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

      <div v-if="panelVisible" class="level2-overlay">
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

      /* ---- evasion state ---- */
      pos: { x: 0, y: 0 }, // mover's top-left inside the stage (px)
      ready: false,        // measured & placed — safe to show
      gliding: false,      // CSS glide enabled (off during initial placement)
      escaping: false,     // mid-escape cooldown — the button commits to one jump

      /* ---- success ceremony (same beats as Level 1) ---- */
      burstCount: 0,
      bubbleVisible: true,
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
  },

  created() {
    // Entering the level resets its session state (replay included).
    GameStore.startLevel(2);

    // Session-only plumbing, all torn down in unmounted().
    this._timers = [];
    this._pressing = false;  // pointer is down on the button — never flee mid-press
    this._lastPointer = null; // tracked from the moment the level is entered

    // Listeners attach in created() so the pointer's position is known
    // by the time the button picks its opening spot.
    this._onMove = (e) => this.onPointerMove(e);
    this._onDown = (e) => this.onPointerDown(e);
    this._onUp = () => (this._pressing = false);
    this._onResize = () => this.onResize();

    window.addEventListener("pointermove", this._onMove, { passive: true });
    window.addEventListener("pointerdown", this._onDown, { passive: true });
    window.addEventListener("pointerup", this._onUp, { passive: true });
    window.addEventListener("pointercancel", this._onUp, { passive: true });
    window.addEventListener("resize", this._onResize);
  },

  mounted() {
    // First paint: measure, then place the button away from the cursor.
    this.$nextTick(() => {
      this.measure();
      this.pos = this.initialPos();
      // Two frames later: reveal + arm the glide, so the initial
      // placement never visibly animates in from 0,0.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          this.ready = true;
          this.gliding = true;
        })
      );
    });
  },

  unmounted() {
    window.removeEventListener("pointermove", this._onMove);
    window.removeEventListener("pointerdown", this._onDown);
    window.removeEventListener("pointerup", this._onUp);
    window.removeEventListener("pointercancel", this._onUp);
    window.removeEventListener("resize", this._onResize);
    this._timers.forEach(clearTimeout);
  },

  methods: {
    /* Self-cleaning timeout — every timer dies with the screen. */
    later(fn, ms) {
      this._timers.push(setTimeout(fn, ms));
    },

    /* Cache every measurement the pointer loop needs, once per layout.
       (The pointer loop itself never touches getBoundingClientRect.) */
    measure() {
      const arena = this.$refs.arena.getBoundingClientRect();
      const mover = this.$refs.mover.getBoundingClientRect();
      const slot = this.$refs.slot.getBoundingClientRect();

      this._arena = { w: arena.width, h: arena.height, left: arena.left, top: arena.top };
      this._mover = { w: mover.width, h: mover.height };

      // The button's center, as an offset inside the mover.
      this._buttonOffset = {
        x: slot.left - mover.left + slot.width / 2,
        y: slot.top - mover.top + slot.height / 2,
      };
      this._buttonRadius = Math.max(slot.width, slot.height) / 2;
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
      const m = LEVEL2_TUNING.edgeMargin;
      return {
        minX: m,
        minY: m,
        maxX: Math.max(m, this._arena.w - this._mover.w - m),
        maxY: Math.max(m, this._arena.h - this._mover.h - m),
      };
    },

    buttonCenter() {
      return {
        x: this.pos.x + this._buttonOffset.x,
        y: this.pos.y + this._buttonOffset.y,
      };
    },

    /* Pointer (client coords) → stage point if it spooks the button, else null. */
    pointerNear(clientX, clientY) {
      const p = { x: clientX - this._arena.left, y: clientY - this._arena.top };
      const c = this.buttonCenter();
      const trigger = this._buttonRadius + LEVEL2_TUNING.escapeDistance;
      return Math.hypot(p.x - c.x, p.y - c.y) < trigger ? p : null;
    },

    /* Opening spot: never under the cursor. The player just clicked
       "Next" (or the home button), so the cursor is parked over the
       stage's center — keep a safe distance from the tracked pointer,
       falling back to keeping clear of the center itself. */
    initialPos() {
      const T = LEVEL2_TUNING;
      const b = this.bounds();
      const avoid = this._lastPointer
        ? {
            x: this._lastPointer.x - this._arena.left,
            y: this._lastPointer.y - this._arena.top,
            r: this._buttonRadius + T.escapeDistance + T.escapeBuffer,
          }
        : {
            x: this._arena.w / 2,
            y: this._arena.h / 2,
            r: T.minJump,
          };

      const farEnough = (x, y, r) =>
        Math.hypot(x + this._buttonOffset.x - avoid.x, y + this._buttonOffset.y - avoid.y) >= r;

      for (let i = 0; i < T.candidates; i++) {
        const x = b.minX + Math.random() * (b.maxX - b.minX);
        const y = b.minY + Math.random() * (b.maxY - b.minY);
        if (farEnough(x, y, avoid.r)) return { x, y };
      }

      // Tiny stage / unlucky rolls: fall back to the corner of the
      // play area that is furthest from the avoided point.
      let best = { x: b.minX, y: b.minY };
      let bestDist = -Infinity;
      for (const x of [b.minX, b.maxX]) {
        for (const y of [b.minY, b.maxY]) {
          const d = Math.hypot(
            x + this._buttonOffset.x - avoid.x,
            y + this._buttonOffset.y - avoid.y
          );
          if (d > bestDist) {
            bestDist = d;
            best = { x, y };
          }
        }
      }
      return best;
    },

    evasionActive() {
      return (
        this.ready &&
        !this.escaping &&
        !this._pressing &&
        this.store.buttonEnabled &&
        !this.store.levelComplete &&
        !this.leaving
      );
    },

    onPointerMove(e) {
      // Always remember where the pointer is (even before placement).
      this._lastPointer = { x: e.clientX, y: e.clientY };
      if (!this.evasionActive()) return;
      const p = this.pointerNear(e.clientX, e.clientY);
      if (p) this.escape(p);
    },

    /* A press landed on the button. Freeze any in-flight glide right
       where it is, or the button would slide out from under the finger
       and the press would cancel — it must never steal a landed press. */
    onPressStart() {
      this._pressing = true;
      if (!this.gliding) return;

      const m = new DOMMatrixReadOnly(getComputedStyle(this.$refs.mover).transform);
      if (Math.abs(m.e - this.pos.x) < 0.5 && Math.abs(m.f - this.pos.y) < 0.5) return;

      this.gliding = false;
      this.pos = { x: m.e, y: m.f };
      requestAnimationFrame(() => (this.gliding = true));
    },

    onPointerDown(e) {
      // A press landing ON the button belongs to the PushButton.
      if (e.target.closest(".push-button")) {
        this._pressing = true;
        return;
      }
      // A tap just shy of it (touch) still counts as "getting close".
      if (!this.evasionActive()) return;
      const p = this.pointerNear(e.clientX, e.clientY);
      if (p) this.escape(p);
    },

    /* The heart of the puzzle: glide to a new, fair spot. */
    escape(pointer) {
      this.escaping = true;
      this.later(() => (this.escaping = false), LEVEL2_TUNING.moveDuration);

      const T = LEVEL2_TUNING;
      const b = this.bounds();
      const c = this.buttonCenter();
      const away = Math.atan2(c.y - pointer.y, c.x - pointer.x);
      const safeFromPointer = this._buttonRadius + T.escapeDistance + T.escapeBuffer;

      let best = null;
      let bestScore = -Infinity;

      for (let i = 0; i < T.candidates; i++) {
        // Mostly away from the pointer; widen the fan as options run out.
        const spread = Math.PI * 0.7 * (i > 5 ? 1.9 : 1);
        const angle = away + (Math.random() * 2 - 1) * spread;
        const dist = T.minJump + Math.random() * (T.maxJump - T.minJump);

        const x = clampToRange(c.x + Math.cos(angle) * dist - this._buttonOffset.x, b.minX, b.maxX);
        const y = clampToRange(c.y + Math.sin(angle) * dist - this._buttonOffset.y, b.minY, b.maxY);
        const nx = x + this._buttonOffset.x;
        const ny = y + this._buttonOffset.y;

        const fromPointer = Math.hypot(nx - pointer.x, ny - pointer.y);
        const jumped = Math.hypot(nx - c.x, ny - c.y);

        // Good spot: clear of the pointer and a real jump, not a shuffle.
        if (fromPointer >= safeFromPointer && jumped >= T.minJump * 0.7) {
          this.pos = { x, y };
          return;
        }

        // Cornered: remember the option that stays furthest from trouble.
        const score = Math.min(fromPointer, jumped);
        if (score > bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }

      // Every candidate was boxed in — slide along the boundary to the
      // least-bad spot. The player just earned a real chance to catch it.
      if (best) this.pos = best;
    },

    /* The objective: one press. Identical ceremony to Level 1. */
    onSuccess() {
      if (this.leaving) return;
      this.leaving = true;

      GameStore.recordPress();
      GameStore.completeLevel();

      // Celebrate — restrained (same success sequence as Level 1).
      this.burstCount++;
      this.bubbleVisible = false;
      this.flashing = true;
      this.hitTick = true;
      this.later(() => {
        this.flashing = false;
        this.hitTick = false;
      }, 280);

      // The stage bows out as the success panel takes the spotlight.
      this.later(() => (this.panelVisible = true), 550);
    },
  },
};
