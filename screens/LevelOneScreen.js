/* ============================================================
   LevelOneScreen — the first bite of gameplay.

   Flow: bubble begs → press → celebrate (burst + warm flash +
   stage nod) → the stage leans away → emit `finished` so the
   router can sweep us toward Level 2.
   ============================================================ */

const LevelOneScreen = {
  name: "LevelOneScreen",
  emits: ["finished"],

  components: {
    LevelHeader,
    SettingsButton,
    GameArea,
    PushButton,
    SpeechBubble,
    CelebrationBurst,
  },

  template: /* html */ `
    <div class="screen level1-screen" :class="{ 'is-hit': hitTick, 'is-leaving': leaving }">
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
      if (this.leaving) return;
      this.leaving = true;

      // Celebrate — restrained.
      this.burstCount++;
      this.bubbleVisible = false;
      this.flashing = true;
      this.hitTick = true;
      setTimeout(() => ((this.flashing = false), (this.hitTick = false)), 280);

      // Hand the moment to the router — it takes us toward Level 2.
      setTimeout(() => this.$emit("finished"), 900);
    },
  },
};
