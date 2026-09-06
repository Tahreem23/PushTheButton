/* ============================================================
   MobileCrowdScreen — mobile Level 4: "The Crowd."

   Exact replica of the desktop CrowdScreen gameplay. Five small
   identical buttons, one real. Pop-up pleas, wrong-press
   rejections, one press on the real button wins.

   All globals are prefixed MOBILE_ to avoid collisions with the
   desktop CrowdScreen (same page, no modules).

   Emits: next, replay, home.
   ============================================================ */

const MOBILE_CROWD_TUNING = {
  buttonCount: 5,
  spotMarginX: 14,
  spotMarginY: 21,
  minSpotDistance: 24,
  buttonScale: 0.55,
  popScale: 1.4,
  popDuration: 1000,
  minPopInterval: 1500,
  maxPopInterval: 3600,
  staggerStep: 420,
  dialogueGap: 500,
  feedbackDuration: 900,
  shakeDuration: 320,
  bowDelay: 1000,
  panelDelay: 1600,
};

function mobileCrowdScatterSpots(t) {
  const spots = [];
  let guard = 0;
  while (spots.length < t.buttonCount && guard++ < 400) {
    const candidate = {
      x: t.spotMarginX + Math.random() * (100 - 2 * t.spotMarginX),
      y: t.spotMarginY + Math.random() * (100 - 2 * t.spotMarginY),
    };
    const clear = spots.every(
      (s) => Math.hypot(s.x - candidate.x, s.y - candidate.y) >= t.minSpotDistance
    );
    if (clear) spots.push(candidate);
  }
  while (spots.length < t.buttonCount) {
    spots.push({ x: 15 + spots.length * 14, y: 50 });
  }
  return spots;
}

const MOBILE_CROWD_BANTER = {
  success: "Ah, you got me again!",
  invites: [
    "Press me!",
    "I'm the real one!",
    "Click me!",
    "Push me!",
    "I'm the button!",
    "Come on, press me!",
    "I'm definitely the button!",
    "I'm the one you're looking for!",
  ],
  rejects: [
    "Haha! It's not me!",
    "Nope!",
    "Wrong one!",
    "Nice try!",
    "Not me!",
    "You wish!",
    "Keep looking!",
    "Haha, got you!",
  ],
};

function mobileCrowdPickLine(pool, current) {
  let next = current;
  while (next === current) {
    next = pool[Math.floor(Math.random() * pool.length)];
  }
  return next;
}

const MobileCrowdScreen = {
  name: "MobileCrowdScreen",
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
    <div class="screen crowd-screen" :class="{ 'is-hit': hitTick, 'is-leaving': leaving }">
      <level-header :level="store.level" />

      <game-area>
        <div class="crowd-canvas">
          <div class="crowd-intro">
            <p class="crowd-intro__title">Push the real button</p>
            <p class="crowd-intro__hint">Don't let the other buttons deceive you</p>
          </div>
          <div
            v-for="btn in buttons"
            :key="btn.id"
            class="crowd-btn"
            :style="[{ left: btn.x + '%', top: btn.y + '%' }, slotStyle]"
          >
            <div class="crowd-bubble-anchor">
              <speech-bubble
                v-if="btn.popped || btn.feedback"
                :key="btn.tick"
                class="speech-bubble--banter"
                :text="btn.feedback || btn.line"
              />
            </div>

            <div class="crowd-pop" :class="{ 'is-popped': btn.popped, 'is-real': btn.isReal }">
              <div class="crowd-slot" :class="{ 'is-shaking': btn.shaking }">
                <push-button
                  :ref="(el) => setBtnRef(btn.id, el)"
                  :disabled="!store.buttonEnabled"
                  @success="onPress(btn)"
                />
                <celebration-burst v-if="btn.isReal" :burst="burstCount" />
              </div>
            </div>
          </div>
        </div>
      </game-area>

      <div v-if="panelVisible" class="crowd-overlay">
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
    const realId = Math.floor(Math.random() * MOBILE_CROWD_TUNING.buttonCount);
    return {
      store: GameStore,
      tune: MOBILE_CROWD_TUNING,

      buttons: mobileCrowdScatterSpots(MOBILE_CROWD_TUNING).map((spot, id) => ({
        id,
        isReal: id === realId,
        x: spot.x,
        y: spot.y,
        popped: false,
        line: "",
        feedback: "",
        shaking: false,
        tick: 0,
      })),

      burstCount: 0,
      flashing: false,
      hitTick: false,
      caught: false,
      leaving: false,
      panelVisible: false,
    };
  },

  computed: {
    slotStyle() {
      return {
        "--button-size": `calc(clamp(120px, 26vmin, 176px) * ${this.tune.buttonScale})`,
        "--pop-scale": this.tune.popScale,
      };
    },
  },

  created() {
    GameStore.startLevel("crowd");

    this._timers = [];
    this._btnRefs = {};
    this.busyUntil = 0;
  },

  mounted() {
    this.buttons.forEach((btn, i) =>
      this.schedulePop(btn, 400 + i * this.tune.staggerStep + Math.random() * 350)
    );
  },

  unmounted() {
    this._timers.forEach(clearTimeout);
  },

  methods: {
    later(fn, ms) {
      const id = setTimeout(fn, ms);
      this._timers.push(id);
      return id;
    },

    setBtnRef(id, el) {
      this._btnRefs[id] = el;
    },

    schedulePop(btn, delay) {
      const t = this.tune;
      const d =
        delay ?? t.minPopInterval + Math.random() * (t.maxPopInterval - t.minPopInterval);
      this.later(() => this.pop(btn), d);
    },

    pop(btn) {
      if (this.caught) return;
      const now = performance.now();
      if (now < this.busyUntil) {
        this.schedulePop(btn, this.busyUntil - now + 60);
        return;
      }
      btn.line = mobileCrowdPickLine(MOBILE_CROWD_BANTER.invites, btn.line);
      btn.tick++;
      btn.popped = true;
      this.busyUntil = now + this.tune.popDuration + this.tune.dialogueGap;
      this.later(() => {
        btn.popped = false;
        this.schedulePop(btn);
      }, this.tune.popDuration);
    },

    onPress(btn) {
      if (this.caught) return;
      btn.isReal ? this.onCaught(btn) : this.onWrongPress(btn);
    },

    onWrongPress(btn) {
      btn.popped = false;
      btn.feedback = mobileCrowdPickLine(MOBILE_CROWD_BANTER.rejects, btn.feedback);
      btn.tick++;
      btn.shaking = true;
      this.busyUntil = performance.now() + this.tune.feedbackDuration + this.tune.dialogueGap;

      this.later(() => (btn.shaking = false), this.tune.shakeDuration);
      this.later(() => (btn.feedback = ""), this.tune.feedbackDuration);
      this.later(() => this._btnRefs[btn.id]?.reset(), 480);
    },

    onCaught(btn) {
      if (this.caught) return;
      this.caught = true;

      this._timers.forEach(clearTimeout);
      this._timers = [];

      this.buttons.forEach((b) => {
        b.popped = false;
        b.feedback = "";
      });
      btn.feedback = MOBILE_CROWD_BANTER.success;
      btn.tick++;

      GameStore.recordPress();
      GameStore.completeLevel();

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
