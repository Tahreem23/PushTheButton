/* ============================================================
   LevelStubScreen — placeholder destination for the "Next level →"
   action of the latest finished level. The level itself is not
   designed yet.
   Props: level (Number). Emits: home.
   ============================================================ */

const LevelStubScreen = {
  name: "LevelStubScreen",
  emits: ["home"],

  props: {
    level: { type: Number, required: true },
  },

  components: {
    LevelHeader,
    SettingsButton,
  },

  template: /* html */ `
    <div class="screen level-stub">
      <level-header :level="level" />

      <main class="level-stub__main">
        <p class="level-stub__text">Level {{ level }} is being designed.</p>
        <button type="button" class="level-stub__home" @click="$emit('home')">
          Back to home
        </button>
      </main>
    </div>
  `,
};
