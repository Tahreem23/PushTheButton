/* ============================================================
   LevelComplete — success panel shown after a level solves.
   Emits: next (proceed), replay (reset this level fresh).
   ============================================================ */

const LevelComplete = {
  name: "LevelComplete",
  emits: ["next", "replay"],

  props: {
    level: { type: Number, required: true },
  },

  template: /* html */ `
    <div class="level-complete" role="dialog" aria-label="Level complete">
      <p class="level-complete__label">Level {{ level }} — complete</p>
      <h2 class="level-complete__heading">Nice one.</h2>

      <div class="level-complete__actions">
        <button type="button" class="level-complete__next" @click="$emit('next')">
          Next level →
        </button>
        <button type="button" class="level-complete__replay" @click="$emit('replay')">
          Replay level {{ level }}
        </button>
      </div>
    </div>
  `,
};
