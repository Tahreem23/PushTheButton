/* ============================================================
   LevelTwoScreen — Level 2: the button doesn't want to be pressed.

   The button sits innocently in the middle of the stage … until
   the pointer comes too close, at which point it glides away.
   Outsmart it — a well-aimed flick, or cornering it — and land
   ONE press to finish.

   All evasion behavior lives in the shared EvasiveButton mixin
   (shared/evasiveButton.js), tuned with EVASION_DEFAULTS as-is.
   This screen is only the template + level identity.

   Emits: next, replay, home.
   ============================================================ */

const LevelTwoScreen = {
  name: "LevelTwoScreen",
  emits: ["next", "replay", "home"],

  mixins: [EvasiveButton],

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
    <div class="screen evasive-screen level2-screen" :class="{ 'is-hit': hitTick, 'is-leaving': leaving }">
      <level-header :level="store.level" />

      <game-area>
        <div class="evasive-canvas" ref="arena">
          <div
            ref="mover"
            class="evasive-mover"
            :class="{ 'is-gliding': gliding }"
            :style="moverStyle"
          >
            <div class="evasive-bubble-anchor">
              <transition name="bubble-pop">
                <speech-bubble v-if="bubbleVisible" />
              </transition>
            </div>

            <div ref="slot" class="evasive-slot">
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
    return { store: GameStore };
  },

  created() {
    // Entering the level resets its session state (replay included).
    GameStore.startLevel(2);
  },

  methods: {
    /* Caught and speechless: the bubble bows out with the stage. */
    onCaught() {
      this.bubbleVisible = false;
    },
  },
};
