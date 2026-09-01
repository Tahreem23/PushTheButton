/* ============================================================
   LevelOneScreen — Level 1: press the button once. That's it.

   All gameplay state lives in GameStore; this screen owns only
   the moment's presentation state (burst, flash, bubble, panel).

   Emits: next (player chooses to proceed), replay (restart fresh),
          home (back to the home screen).
   ============================================================ */

const LevelOneScreen = {
  name: "LevelOneScreen",
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
            <transition name="bubble-pop">
              <speech-bubble v-if="bubbleVisible" />
            </transition>
          </div>

          <div class="level1__button-slot">
            <push-button
              ref="button"
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
    // Entering the level resets its session state (replay included).
    GameStore.startLevel(1);
  },

  methods: {
    /* The objective: one press. Store completes the level here. */
    onSuccess() {
      if (this.leaving) return;
      this.leaving = true;

      GameStore.recordPress();
      GameStore.completeLevel();

      // Celebrate — restrained (existing success sequence, unchanged).
      this.burstCount++;
      this.bubbleVisible = false;
      this.flashing = true;
      this.hitTick = true;
      setTimeout(() => ((this.flashing = false), (this.hitTick = false)), 280);

      // The stage bows out as the success panel takes the spotlight.
      setTimeout(() => (this.panelVisible = true), 550);
    },
  },
};
