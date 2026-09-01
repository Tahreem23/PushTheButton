/* ============================================================
   Level 1 — screen assembly (mockup).

   This file owns Level 1's flow only. It composes the reusable
   components and plays the success sequence:

     press → burst + subtle screen feedback
           → soft transition sweep
           → (mockup) reset so the design can be reviewed again

   The real game loops here (routing / game state) will replace
   the reset once the architecture is defined.
   ============================================================ */

const app = Vue.createApp({
  name: "LevelOneScreen",

  components: {
    LevelHeader,
    SettingsButton,
    GameArea,
    PushButton,
    SpeechBubble,
    CelebrationBurst,
  },

  template: /* html */ `
    <div class="screen" :class="{ 'is-hit': hitTick, 'is-leaving': leaving }">
      <level-header :level="1" />

      <game-area>
        <div class="level1">
          <div class="level1__bubble-slot">
            <transition name="bubble-pop">
              <speech-bubble v-if="bubbleVisible" />
            </transition>
          </div>

          <div class="level1__button-slot">
            <push-button ref="button" @success="onSuccess" />
            <celebration-burst :burst="burstCount" />
          </div>
        </div>
      </game-area>

      <div class="screen-flash" :class="{ 'is-active': flashing }"></div>
    </div>
  `,

  data() {
    return {
      burstCount: 0,
      bubbleVisible: true,
      flashing: false,
      hitTick: false,
      leaving: false,
    };
  },

  methods: {
    onSuccess() {
      // 1. Celebrate — restrained.
      this.burstCount++;
      this.bubbleVisible = false;
      this.flashing = true;
      this.hitTick = true;
      setTimeout(() => ((this.flashing = false), (this.hitTick = false)), 280);

      // 2. Transition toward the next level…
      setTimeout(() => (this.leaving = true), 800);

      // 3. …then reset. (Mockup behavior; becomes "navigate to Level 2".)
      setTimeout(() => {
        this.leaving = false;
        this.$refs.button.reset();
        setTimeout(() => (this.bubbleVisible = true), 150);
      }, 1400);
    },
  },
});

app.mount("#app");
