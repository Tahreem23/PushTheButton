/* ============================================================
   MobileWipeScreen — mobile Level 6: "Find the Button."

   The stage is covered by a translucent grey fog. The player
   swipes their finger to wipe it away and reveal the background.
   The real button hides underneath at a random position.

   Once the player's swipe path overlaps the button's centre,
   the fog dissolves, the button appears, and one tap finishes
   the level — same ceremony as every other level.

   The fog is a <canvas> drawn on top of the game-area stage.
   Wiping uses globalCompositeOperation = 'destination-out' to
   punch transparent circles along the pointer path.

   Emits: next, replay, home.
   ============================================================ */

/* ---- Tuning -------------------------------------------------- */

const WIPE_TUNING = {
  buttonScale: 0.45,      // moderate size — reward for finding it
  revealRadius: 36,       // px cleared per finger position
  fogColor: "rgba(180, 175, 168, 0.92)", // warm grey, nearly opaque
  edgeMargin: 40,         // keep button inside the stage
  topMargin: 20,          // clear of any instruction text
  cornerWipeRadius: 54,   // how big the hint wipe in the top-left is
  cornerWipeX: 44,        // centre of the hint wipe (px from left)
  cornerWipeY: 44,        // centre of the hint wipe (px from top)
  hitRadius: 30,          // px from button centre: counts as "found"
  foundBeats: 1200,       // ms "You found me!" stays before "Press me!"
  bowDelay: 0,
  panelDelay: 550,
};

const WIPE_BANTER = {
  found: "You found me!",
  pressMe: "Now press me!",
};

/* ============================================================ */

const MobileWipeScreen = {
  name: "MobileWipeScreen",
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
      class="screen wipe-screen"
      :class="{ 'is-hit': hitTick, 'is-leaving': leaving }"
    >
      <level-header :level="store.level" />

      <game-area>
        <div class="wipe-canvas" ref="arena">
          <!-- The hidden button (always in the DOM, under the fog) -->
          <div
            ref="station"
            class="wipe-station"
            :class="{ 'is-found': found }"
            :style="stationStyle"
          >
            <div class="wipe-bubble-anchor">
              <speech-bubble
                v-if="reaction"
                :key="reactionTick"
                class="speech-bubble--banter"
                :text="reaction"
              />
            </div>

            <div ref="slot" class="wipe-slot" :style="slotStyle">
              <push-button
                ref="button"
                :disabled="!store.buttonEnabled || !found"
                @success="onSuccess"
              />
              <celebration-burst v-if="found" :burst="burstCount" />
            </div>
          </div>

          <!-- The fog layer — a canvas drawn on top -->
          <canvas
            ref="fog"
            class="wipe-fog"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
          ></canvas>
        </div>
      </game-area>

      <div v-if="panelVisible" class="wipe-overlay">
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
      pos: { x: 0, y: 0 },   // button station top-left inside the arena (px)
      placed: false,

      /* ---- search state ---- */
      found: false,
      swiping: false,

      /* ---- dialogue ---- */
      reaction: "",
      reactionTick: 0,

      /* ---- success ceremony ---- */
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
        left: this.pos.x + "px",
        top: this.pos.y + "px",
      };
    },

    slotStyle() {
      return {
        "--button-size": `calc(clamp(120px, 26vmin, 176px) * ${WIPE_TUNING.buttonScale})`,
      };
    },
  },

  created() {
    GameStore.startLevel("wipe");

    this._timers = [];
    this._buttonCenter = { x: 0, y: 0 };
    this._ctx = null;
    this._onResize = () => this.handleResize();
  },

  mounted() {
    window.addEventListener("resize", this._onResize);

    this.$nextTick(() => {
      this.setupCanvas();
      this.placeButton();
      this.drawFog();
      this.placed = true;
    });
  },

  unmounted() {
    window.removeEventListener("resize", this._onResize);
    this._timers.forEach(clearTimeout);
  },

  methods: {
    later(fn, ms) {
      const id = setTimeout(fn, ms);
      this._timers.push(id);
      return id;
    },

    /* ---- Canvas setup ---- */

    setupCanvas() {
      const canvas = this.$refs.fog;
      const arena = this.$refs.arena;
      const rect = arena.getBoundingClientRect();

      // Size canvas to match arena pixel-for-pixel.
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";

      this._ctx = canvas.getContext("2d");
      this._ctx.scale(dpr, dpr);
      this._arenaRect = rect;
      this._arenaSize = { w: rect.width, h: rect.height };
      this._dpr = dpr;
    },

    handleResize() {
      // Rebuild canvas and re-draw fog (reveals are lost, but resizes
      // are rare mid-play on mobile).
      this.setupCanvas();
      this.drawFog();

      // Re-clamp button position.
      const t = WIPE_TUNING;
      const slot = this.$refs.slot?.getBoundingClientRect() ?? { width: 60, height: 60 };
      this.pos = {
        x: Math.min(Math.max(t.edgeMargin, this.pos.x), this._arenaSize.w - slot.width - t.edgeMargin),
        y: Math.min(Math.max(t.topMargin, this.pos.y), this._arenaSize.h - slot.height - t.edgeMargin),
      };
      this.computeButtonCenter();
    },

    /* ---- Fog drawing ---- */

    drawFog() {
      const ctx = this._ctx;
      const { w, h } = this._arenaSize;

      // Fill entire canvas with the fog colour.
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = WIPE_TUNING.fogColor;
      ctx.fillRect(0, 0, w, h);

      // Pre-wipe the hint corner so the player sees the mechanic.
      this.clearCircle(WIPE_TUNING.cornerWipeX, WIPE_TUNING.cornerWipeY, WIPE_TUNING.cornerWipeRadius);
    },

    /* Punch a transparent circle through the fog. */
    clearCircle(x, y, r) {
      const ctx = this._ctx;
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    },

    /* ---- Button placement ---- */

    placeButton() {
      const t = WIPE_TUNING;
      const slot = this.$refs.slot.getBoundingClientRect();
      const sw = slot.width;
      const sh = slot.height;
      const { w, h } = this._arenaSize;

      const minX = t.edgeMargin;
      const maxX = w - sw - t.edgeMargin;
      const minY = t.topMargin;
      const maxY = h - sh - t.edgeMargin;

      this.pos = {
        x: minX + Math.random() * (maxX - minX),
        y: minY + Math.random() * (maxY - minY),
      };

      this.computeButtonCenter();
    },

    computeButtonCenter() {
      // Button centre in arena-local coordinates.
      this.$nextTick(() => {
        const slot = this.$refs.slot;
        if (!slot) return;
        const sr = slot.getBoundingClientRect();
        const ar = this._arenaRect;
        this._buttonCenter = {
          x: sr.left - ar.left + sr.width / 2,
          y: sr.top - ar.top + sr.height / 2,
        };
      });
    },

    /* ---- Pointer handling ---- */

    pointerToLocal(e) {
      const ar = this.$refs.arena.getBoundingClientRect();
      return { x: e.clientX - ar.left, y: e.clientY - ar.top };
    },

    onPointerDown(e) {
      if (this.found || this.caught) return;
      this.swiping = true;
      // Capture so moves outside the canvas still track.
      e.target.setPointerCapture(e.pointerId);
      this.revealAt(e);
    },

    onPointerMove(e) {
      if (!this.swiping || this.found || this.caught) return;
      this.revealAt(e);
    },

    onPointerUp() {
      this.swiping = false;
    },

    revealAt(e) {
      const p = this.pointerToLocal(e);
      this.clearCircle(p.x, p.y, WIPE_TUNING.revealRadius);

      // Check if we've uncovered the button.
      const dx = p.x - this._buttonCenter.x;
      const dy = p.y - this._buttonCenter.y;
      if (Math.hypot(dx, dy) <= WIPE_TUNING.hitRadius) {
        this.reveal();
      }
    },

    /* ---- Button discovery ---- */

    reveal() {
      if (this.found) return;
      this.found = true;
      this.swiping = false;

      // Dissolve the remaining fog with a fade-out on the canvas.
      const fog = this.$refs.fog;
      if (fog) {
        fog.style.transition = "opacity 0.5s ease-out";
        fog.style.opacity = "0";
        fog.style.pointerEvents = "none";
      }

      this.reaction = WIPE_BANTER.found;
      this.reactionTick++;

      // After a beat, switch to the "press me" prompt.
      this.later(() => {
        if (this.found && !this.caught) {
          this.reaction = WIPE_BANTER.pressMe;
          this.reactionTick++;
        }
      }, WIPE_TUNING.foundBeats);
    },

    /* ---- Success ---- */

    onSuccess() {
      if (!this.found) return;
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
      }, WIPE_TUNING.bowDelay);

      this.later(() => (this.panelVisible = true), WIPE_TUNING.panelDelay);
    },
  },
};
