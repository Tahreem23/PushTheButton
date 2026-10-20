/* ============================================================
   MobileShyScreen — mobile placeholder for the "shy" level.

   The desktop mechanic (shrinks as the cursor approaches) needs
   hover, which touch doesn't have. Until a touch version is
   designed, this is a plain one-tap level so mobile progression
   isn't blocked on its way to the later levels.

   Emits: next, replay, home.
   ============================================================ */

const MobileShyScreen = {
  name: "MobileShyScreen",
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
    <div class="screen level1-screen" :class="{ 'is-hit': hitTick, 'is-leaving': leaving }">
      <level-header :level="store.level" />

      <game-area>
        <div class="level1">
          <div class="speech-anchor">
            <speech-bubble v-if="bubbleVisible" text="I'm a little shy…" />
          </div>

          <div class="level1__button-slot">
            <push-button
              :disabled="!store.buttonEnabled"
              @success="onSuccess"
            />
            <celebration-burst :burst="burstCount" />
          </div>
        </div>
      </game-area>

      <div v-if="panelVisible" class="level1-overlay">
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
      burstCount: 0,
      bubbleVisible: true,
      flashing: false,
      hitTick: false,
      leaving: false,
      panelVisible: false,
    };
  },

  created() {
    GameStore.startLevel("shy");
    this._timers = [];
  },

  unmounted() {
    this._timers.forEach(clearTimeout);
  },

  methods: {
    onSuccess() {
      if (this.leaving) return;
      this.leaving = true;

      GameStore.recordPress();
      GameStore.completeLevel();

      this.burstCount++;
      this.bubbleVisible = false;
      this.flashing = true;
      this.hitTick = true;
      this._timers.push(setTimeout(() => ((this.flashing = false), (this.hitTick = false)), 280));
      this._timers.push(setTimeout(() => (this.panelVisible = true), 550));
    },
  },
};
