/* ============================================================
   MobileSeekerScreen — mobile Level 5: "Find the Button."

   Exact replica of the desktop SeekerScreen gameplay. One
   invisible button hidden on the stage. Sweep the cursor/finger;
   whispers appear near the pointer. Cross the hitbox and it pops
   into view. Press it once. Done.

   All globals are prefixed MOBILE_ to avoid collisions with the
   desktop SeekerScreen (same page, no modules).

   Emits: next, replay, home.
   ============================================================ */

const MOBILE_SEEKER_TUNING = {
  buttonScale: 0.3,
  warmDistance: 330,
  hotDistance: 150,
  hitSlop: 8,
  hintCooldown: 1800,
  hintMove: 45,
  hintDuration: 1400,
  hintLeadTime: 350,
  foundBeats: 1500,
  edgeMargin: 56,
  topMargin: 110,
  centerClearance: 0.3,
  bowDelay: 0,
  panelDelay: 550,
};

const MOBILE_SEEKER_BANTER = {
  found: "Ah, you found me!",
  pressMe: "Press me to go to next level!",
  warm: ["Hmm…", "You're getting warmer…", "Warm…", "Warmer…"],
  hot: ["Right there…", "So close…", "Almost on top of it…"],
};

function mobileSeekerPickLine(pool, current) {
  let next = current;
  while (next === current) {
    next = pool[Math.floor(Math.random() * pool.length)];
  }
  return next;
}

const MobileSeekerScreen = {
  name: "MobileSeekerScreen",
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

      placed: false,
      pos: { x: 0, y: 0 },

      found: false,

      hint: "",
      hintTick: 0,
      hintPos: { x: 0, y: 0 },
      reaction: "",
      reactionTick: 0,

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
        "--sx": this.pos.x + "px",
        "--sy": this.pos.y + "px",
      };
    },

    hintStyle() {
      return { left: this.hintPos.x + "px", top: this.hintPos.y + "px" };
    },

    slotStyle() {
      return {
        "--button-size": `calc(clamp(120px, 26vmin, 176px) * ${MOBILE_SEEKER_TUNING.buttonScale})`,
      };
    },
  },

  created() {
    GameStore.startLevel("seeker");

    this._timers = [];
    this._hintT = null;
    this._hintLeadT = null;
    this._lastPointer = null;
    this._lastZone = null;
    this._lastHintAt = 0;
    this._lastHintPos = null;
  },

  mounted() {
    this._onMove = (e) => this.onPointerMove(e);
    window.addEventListener("pointermove", this._onMove, { passive: true });

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
    later(fn, ms) {
      const id = setTimeout(fn, ms);
      this._timers.push(id);
      return id;
    },

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

    rollHidingSpot() {
      const t = MOBILE_SEEKER_TUNING;
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

    distanceFromEdge(clientX, clientY) {
      const p = { x: clientX - this._canvas.left, y: clientY - this._canvas.top };
      const c = this.centerAt(this.pos);
      return { p, d: Math.hypot(p.x - c.x, p.y - c.y) - this._buttonRadius };
    },

    onPointerMove(e) {
      this._lastPointer = { x: e.clientX, y: e.clientY };
      if (!this.placed || this.found || this.caught) return;

      const { p, d } = this.distanceFromEdge(e.clientX, e.clientY);

      if (d <= MOBILE_SEEKER_TUNING.hitSlop) {
        this.reveal();
        return;
      }

      const t = MOBILE_SEEKER_TUNING;
      const zone = d <= t.hotDistance ? "hot" : d <= t.warmDistance ? "warm" : null;

      if (!zone) {
        this._lastZone = null;
        return;
      }

      const entered = zone !== this._lastZone;
      this._lastZone = zone;

      const now = performance.now();
      const cooledDown = now - this._lastHintAt >= t.hintCooldown;
      const sweptFarEnough =
        !this._lastHintPos ||
        Math.hypot(p.x - this._lastHintPos.x, p.y - this._lastHintPos.y) >= t.hintMove;

      if (entered || (cooledDown && sweptFarEnough)) {
        this.queueHint();
      }
    },

    queueHint() {
      if (this._hintLeadT) return;

      this._lastHintAt = performance.now();
      this._lastHintPos = { ...this._lastPointer };

      this._hintLeadT = this.later(() => {
        this._hintLeadT = null;
        if (this.found || this.caught || !this._lastPointer) return;

        const t = MOBILE_SEEKER_TUNING;
        const { p, d } = this.distanceFromEdge(this._lastPointer.x, this._lastPointer.y);
        if (d <= t.hitSlop) {
          this.reveal();
          return;
        }
        const zone = d <= t.hotDistance ? "hot" : d <= t.warmDistance ? "warm" : null;
        if (zone) this.showHint(zone, p);
      }, MOBILE_SEEKER_TUNING.hintLeadTime);
    },

    showHint(zone, p) {
      const t = MOBILE_SEEKER_TUNING;
      const pool = zone === "hot" ? MOBILE_SEEKER_BANTER.hot : MOBILE_SEEKER_BANTER.warm;

      this.hint = mobileSeekerPickLine(pool, this.hint);
      this.hintTick++;
      this.hintPos = { ...p };
      this.$nextTick(() => this.clampHint());

      if (this._hintT) clearTimeout(this._hintT);
      this._hintT = this.later(() => (this.hint = ""), t.hintDuration);
    },

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

    reveal() {
      if (this.found) return;
      this.found = true;

      this.hint = "";
      if (this._hintT) {
        clearTimeout(this._hintT);
        this._hintT = null;
      }

      this.reaction = MOBILE_SEEKER_BANTER.found;
      this.reactionTick++;

      this.later(() => {
        if (this.found && !this.caught) {
          this.reaction = MOBILE_SEEKER_BANTER.pressMe;
          this.reactionTick++;
        }
      }, MOBILE_SEEKER_TUNING.foundBeats);
    },

    onSuccess() {
      if (!this.found) {
        this.reveal();
        this.later(() => this.$refs.button?.reset(), 480);
        return;
      }

      if (this.caught) return;
      this.caught = true;

      GameStore.recordPress();
      GameStore.completeLevel();

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
      }, MOBILE_SEEKER_TUNING.bowDelay);

      this.later(() => (this.panelVisible = true), MOBILE_SEEKER_TUNING.panelDelay);
    },
  },
};
