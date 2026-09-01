/* ============================================================
   EvasiveButton — the shared "the button doesn't want to be
   pressed" mechanic, as a Vue mixin. Level 2 introduced it;
   Level 3 inherits it with different tuning and personality.

   A screen using this mixin must provide a template with:
     ref="arena"  — the absolute canvas covering the stage
     ref="mover"  — the gliding unit (bubble row + button row)
     ref="slot"   — the button slot (anchors the celebration burst)
     .evasive-screen root with reactive is-hit / is-leaving flags
     a PushButton wired to @press / @success, and the overlay panel

   Extension hooks (override in the component):
     tuning()          — gameplay numbers (merged over EVASION_DEFAULTS)
     onApproach(p)     — what "pointer is too close" means
                         (default: escape immediately)
     onPressInto()     — press landed on the button (before the freeze)
     onCaught()        — the press succeeded; react before the bow-out

   All timers die on unmount; all window listeners detach there too.
   ============================================================ */

/* Sensible baseline — Level 2 plays exactly on these values. */
const EVASION_DEFAULTS = {
  escapeDistance: 90, // pointer gap (px, from the button's edge) that spooks it
  escapeBuffer: 40,   // extra px a landing spot must keep from the pointer
  minJump: 170,       // never flee a meaningless shuffle …
  maxJump: 360,       // … and never so far the player loses all hope
  moveDuration: 300,  // glide length (ms) — drives CSS + the escape cooldown
  edgeMargin: 10,     // breathing room between the button and the boundary
  candidates: 14,     // landing spots tried before settling for the best one
  bowDelay: 0,        // pause before the stage bows out after being caught
  panelDelay: 550,    // pause before the success panel takes over
};

const clampToRange = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const EvasiveButton = {
  data() {
    return {
      /* ---- evasion state ---- */
      pos: { x: 0, y: 0 }, // mover's top-left inside the stage (px)
      ready: false,        // measured & placed — safe to show
      gliding: false,      // CSS glide enabled (off during initial placement)
      escaping: false,     // mid-escape cooldown — the button commits to one jump
      caught: false,       // the press landed for good — evasion is over

      /* ---- success ceremony (shared by every evasive level) ---- */
      burstCount: 0,
      bubbleVisible: true,
      flashing: false,
      hitTick: false,
      leaving: false,
      panelVisible: false,
    };
  },

  computed: {
    tune() {
      // Resolved once, at creation. Plain data: nothing here is
      // reactive on purpose — tuning changes require a reload anyway.
      return this._tune;
    },

    moverStyle() {
      return {
        transform: `translate(${this.pos.x}px, ${this.pos.y}px)`,
        visibility: this.ready ? "visible" : "hidden",
        "--move-duration": this.tune.moveDuration + "ms",
      };
    },
  },

  created() {
    // Merge the level's tuning over the defaults.
    this._tune = Object.assign(
      {},
      EVASION_DEFAULTS,
      typeof this.tuning === "function" ? this.tuning() : {}
    );

    // Session-only plumbing, all torn down in unmounted().
    this._timers = [];
    this._pressing = false;   // pointer is down on the button — never flee mid-press
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
      const id = setTimeout(fn, ms);
      this._timers.push(id);
      return id;
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
      const m = this.tune.edgeMargin;
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

    toStage(clientX, clientY) {
      return { x: clientX - this._arena.left, y: clientY - this._arena.top };
    },

    currentPointer() {
      return this._lastPointer
        ? this.toStage(this._lastPointer.x, this._lastPointer.y)
        : null;
    },

    /* Pointer (client coords) → stage point if it spooks the button, else null. */
    pointerNear(clientX, clientY) {
      const p = this.toStage(clientX, clientY);
      const c = this.buttonCenter();
      const trigger = this._buttonRadius + this.tune.escapeDistance;
      return Math.hypot(p.x - c.x, p.y - c.y) < trigger ? p : null;
    },

    /* Opening spot: never under the cursor. The player just clicked
       "Next" (or the home button), so the cursor is parked over the
       stage's center — keep a safe distance from the tracked pointer,
       falling back to keeping clear of the center itself. */
    initialPos() {
      const t = this.tune;
      const b = this.bounds();
      const avoid = this._lastPointer
        ? {
            ...this.toStage(this._lastPointer.x, this._lastPointer.y),
            r: this._buttonRadius + t.escapeDistance + t.escapeBuffer,
          }
        : { x: this._arena.w / 2, y: this._arena.h / 2, r: t.minJump };

      for (let i = 0; i < t.candidates; i++) {
        const x = b.minX + Math.random() * (b.maxX - b.minX);
        const y = b.minY + Math.random() * (b.maxY - b.minY);
        const d = Math.hypot(
          x + this._buttonOffset.x - avoid.x,
          y + this._buttonOffset.y - avoid.y
        );
        if (d >= avoid.r) return { x, y };
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
        !this.caught &&
        !this.escaping &&
        !this._pressing &&
        this.store.buttonEnabled &&
        !this.leaving
      );
    },

    onPointerMove(e) {
      // Always remember where the pointer is (even before placement).
      this._lastPointer = { x: e.clientX, y: e.clientY };
      if (!this.evasionActive()) return;
      const p = this.pointerNear(e.clientX, e.clientY);
      if (p) this.onApproach(p);
    },

    onPointerDown(e) {
      // A press landing ON the button belongs to the PushButton.
      if (e.target.closest(".push-button")) return;
      // A tap just shy of it (touch) still counts as "getting close".
      if (!this.evasionActive()) return;
      const p = this.pointerNear(e.clientX, e.clientY);
      if (p) this.onApproach(p);
    },

    /* What "the pointer is too close" means. Default: flee at once
       (Level 2). Levels may instead open a click window (Level 3). */
    onApproach(p) {
      this.escape(p);
    },

    /* A press landed on the button. Freeze any in-flight glide right
       where it is, or the button would slide out from under the finger
       and the press would cancel — it must never steal a landed press. */
    onPressStart() {
      this._pressing = true;
      if (typeof this.onPressInto === "function") this.onPressInto();
      if (!this.gliding) return;

      const m = new DOMMatrixReadOnly(getComputedStyle(this.$refs.mover).transform);
      if (Math.abs(m.e - this.pos.x) < 0.5 && Math.abs(m.f - this.pos.y) < 0.5) return;

      this.gliding = false;
      this.pos = { x: m.e, y: m.f };
      requestAnimationFrame(() => (this.gliding = true));
    },

    /* The heart of the puzzle: glide to a new, fair spot. */
    escape(pointer) {
      this.escaping = true;
      this.later(() => (this.escaping = false), this.tune.moveDuration);

      const t = this.tune;
      const b = this.bounds();
      const c = this.buttonCenter();
      const away = Math.atan2(c.y - pointer.y, c.x - pointer.x);
      const safeFromPointer = this._buttonRadius + t.escapeDistance + t.escapeBuffer;

      let best = null;
      let bestScore = -Infinity;

      for (let i = 0; i < t.candidates; i++) {
        // Mostly away from the pointer; widen the fan as options run out.
        const spread = Math.PI * 0.7 * (i > 5 ? 1.9 : 1);
        const angle = away + (Math.random() * 2 - 1) * spread;
        const dist = t.minJump + Math.random() * (t.maxJump - t.minJump);

        const x = clampToRange(c.x + Math.cos(angle) * dist - this._buttonOffset.x, b.minX, b.maxX);
        const y = clampToRange(c.y + Math.sin(angle) * dist - this._buttonOffset.y, b.minY, b.maxY);
        const nx = x + this._buttonOffset.x;
        const ny = y + this._buttonOffset.y;

        const fromPointer = Math.hypot(nx - pointer.x, ny - pointer.y);
        const jumped = Math.hypot(nx - c.x, ny - c.y);

        // Good spot: clear of the pointer and a real jump, not a shuffle.
        if (fromPointer >= safeFromPointer && jumped >= t.minJump * 0.7) {
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

    /* The objective: one press. Evasion stops here; the ceremony is
       identical for every evasive level — bow out, then the panel. */
    onSuccess() {
      if (this.caught) return;
      this.caught = true;
      this.escaping = false;

      GameStore.recordPress();
      GameStore.completeLevel();

      // Level-specific reaction (hide the bubble, deliver the last word…)
      if (typeof this.onCaught === "function") this.onCaught();

      this.burstCount++;

      this.later(() => {
        this.leaving = true;
        this.flashing = true;
        this.hitTick = true;
        this.later(() => {
          this.flashing = false;
          this.hitTick = false;
        }, 280);
      }, this.tune.bowDelay);

      this.later(() => (this.panelVisible = true), this.tune.panelDelay);
    },
  },
};
