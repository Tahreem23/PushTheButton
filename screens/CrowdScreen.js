/* ============================================================
   CrowdScreen — the "crowd" level: which one is me?

   Five small identical buttons, all real-looking, all loudly
   convinced it is THEM. Exactly one is the real button. There
   is no clue and there never will be: keep pressing until you
   find it — the entertainment is the audience participation.

   Every button pops larger on its own staggered timer and pleads
   its case; a wrong press earns an instant cheeky rejection and
   costs nothing. One press on the real button wins the level.

   Data-driven: `buttons` is the only state that matters.

   Emits: next, replay, home.
   ============================================================ */

/* Every tunable for this puzzle lives here — nowhere else. */
const CROWD_TUNING = {
  buttonCount: 5,
  /* Spots are scattered randomly per mount, in % of the stage, kept
     inside a safe margin (button + bubble must never clip the boundary)
     and never closer than minSpotDistance (also % of the stage). */
  spotMarginX: 14,
  spotMarginY: 21,        // keeps top-row bubbles clear of the intro line
  minSpotDistance: 24,
  buttonScale: 0.55,      // crowd buttons are small (token × this)
  popScale: 1.4,          // how big a pop grows the button
  popDuration: 1000,      // ms a pop stays up (its plea is visible)
  minPopInterval: 1500,   // idle bounds between one button's pops
  maxPopInterval: 3600,
  staggerStep: 420,       // initial rhythm so the crowd never syncs
  dialogueGap: 500,       // ms of silence after ANY dialogue — pop-ups
                          // and replies never overlap, never back-to-back
  feedbackDuration: 900,  // ms a "wrong one!" line lingers
  shakeDuration: 320,     // wrong-press wiggle
  bowDelay: 1000,         // let the success line land, then stage bows out
  panelDelay: 1600,       // … then the success panel takes over
};

/* A fresh crowd layout every mount: random spots inside the safe
   margins, each a comfortable minimum distance from its neighbours. */
function scatterSpots(t) {
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
  // Practically unreachable fallback for a tiny stage: a loose fan.
  while (spots.length < t.buttonCount) {
    spots.push({ x: 15 + spots.length * 14, y: 50 });
  }
  return spots;
}

/* Every line the crowd knows. Short only — they're buttons. */
const CROWD_BANTER = {
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

/* Pick from a pool, never repeating the same line twice in a row. */
function pickLine(pool, current) {
  let next = current;
  while (next === current) {
    next = pool[Math.floor(Math.random() * pool.length)];
  }
  return next;
}

const CrowdScreen = {
  name: "CrowdScreen",
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
              <!-- Entrance only: the --enter class pops it in; leaving is
                   instant (no fade-out — the next voice comes right away). -->
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
    // Scatter the crowd and choose the real button once per mount (a
    // replay re-does both); the real one never changes mid-attempt.
    const realId = Math.floor(Math.random() * CROWD_TUNING.buttonCount);
    return {
      store: GameStore,
      tune: CROWD_TUNING,

      buttons: scatterSpots(CROWD_TUNING).map((spot, id) => ({
        id,
        isReal: id === realId,
        x: spot.x,
        y: spot.y,
        popped: false,   // currently grown + pleading
        line: "",        // its current pop-up plea
        feedback: "",    // a wrong-press reply (takes precedence over line)
        shaking: false,  // wrong-press wiggle
        tick: 0,         // bumped per new line so the bubble re-pops
      })),

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
    /* Small crowd buttons: same approved design, scaled whole via the
       --button-size token. --pop-scale feeds the CSS pop transition. */
    slotStyle() {
      return {
        "--button-size": `calc(clamp(120px, 26vmin, 176px) * ${this.tune.buttonScale})`,
        "--pop-scale": this.tune.popScale,
      };
    },
  },

  created() {
    // Entering the level resets its session state (replay included).
    GameStore.startLevel("crowd");

    this._timers = [];   // every timeout the level owns
    this._btnRefs = {};  // PushButton instances by id (to un-stick wrongs)
    this.busyUntil = 0;  // crowd-wide: someone is talking until this time
                         // (includes fade-out + the dialogueGap silence)
  },

  mounted() {
    // Staggered first pops so the five never march in sync.
    this.buttons.forEach((btn, i) =>
      this.schedulePop(btn, 400 + i * this.tune.staggerStep + Math.random() * 350)
    );
  },

  unmounted() {
    this._timers.forEach(clearTimeout);
  },

  methods: {
    /* Self-cleaning timeout — every timer dies with the screen. */
    later(fn, ms) {
      const id = setTimeout(fn, ms);
      this._timers.push(id);
      return id;
    },

    setBtnRef(id, el) {
      this._btnRefs[id] = el;
    },

    /* One button's endless little loop: wait a while, pop up, plead,
       sink back down, wait again. Frequency is per-button random. */
    schedulePop(btn, delay) {
      const t = this.tune;
      const d =
        delay ?? t.minPopInterval + Math.random() * (t.maxPopInterval - t.minPopInterval);
      this.later(() => this.pop(btn), d);
    },

    pop(btn) {
      if (this.caught) return;
      // One voice at a time — and only once the previous bubble has
      // fully faded out plus a beat of silence. Otherwise, wait.
      const now = performance.now();
      if (now < this.busyUntil) {
        this.schedulePop(btn, this.busyUntil - now + 60);
        return;
      }
      btn.line = pickLine(CROWD_BANTER.invites, btn.line);
      btn.tick++;
      btn.popped = true;
      // What shows is what counts: plea up for popDuration, then silence.
      this.busyUntil = now + this.tune.popDuration + this.tune.dialogueGap;
      this.later(() => {
        btn.popped = false;
        this.schedulePop(btn);
      }, this.tune.popDuration);
    },

    /* A completed press. Exactly one of the five matters. */
    onPress(btn) {
      if (this.caught) return;
      btn.isReal ? this.onCaught(btn) : this.onWrongPress(btn);
    },

    /* Wrong. Cheeky reply, a wiggle, and the button stands back up
       ready to be pressed again — no penalty, no waiting. */
    onWrongPress(btn) {
      btn.popped = false;
      btn.feedback = pickLine(CROWD_BANTER.rejects, btn.feedback);
      btn.tick++;
      btn.shaking = true;
      // The reply counts as crowd chatter: ambient pop-ups hold
      // until the line is gone (plus the dialogue gap).
      this.busyUntil = performance.now() + this.tune.feedbackDuration + this.tune.dialogueGap;

      this.later(() => (btn.shaking = false), this.tune.shakeDuration);
      this.later(() => (btn.feedback = ""), this.tune.feedbackDuration);
      // PushButton finished its press in the "success" state; stand it
      // back up (after the pop) or it would refuse further presses.
      this.later(() => this._btnRefs[btn.id]?.reset(), 480);
    },

    /* The real one. Stop EVERYTHING, let it say its line, celebrate
       with the same ceremony every level shares, then the panel. */
    onCaught(btn) {
      if (this.caught) return;
      this.caught = true;

      // Kill all pop scheduling before the ceremony borrows the timers.
      this._timers.forEach(clearTimeout);
      this._timers = [];

      // The crowd falls silent; the winner gets the last word.
      this.buttons.forEach((b) => {
        b.popped = false;
        b.feedback = "";
      });
      btn.feedback = CROWD_BANTER.success;
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
