/* ============================================================
   LevelTwoStubScreen — placeholder destination for the Level 1
   "Next level →" action. Level 2 itself is not designed yet.
   Emits: home.
   ============================================================ */

const LevelTwoStubScreen = {
  name: "LevelTwoStubScreen",
  emits: ["home"],

  components: {
    LevelHeader,
    SettingsButton,
  },

  template: /* html */ `
    <div class="screen level2-stub">
      <level-header :level="2" />

      <main class="level2-stub__main">
        <p class="level2-stub__text">Level 2 is being designed.</p>
        <button type="button" class="level2-stub__home" @click="$emit('home')">
          Back to home
        </button>
      </main>
    </div>
  `,
};
