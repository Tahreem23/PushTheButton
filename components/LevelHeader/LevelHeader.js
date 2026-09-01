/* ============================================================
   LevelHeader — "LEVEL 1" indicator with centered layout.
   Props: level (Number)
   ============================================================ */

const LevelHeader = {
  name: "LevelHeader",
  props: {
    level: { type: Number, required: true },
  },
  template: /* html */ `
    <header class="level-header">
      <div class="level-header__spacer" aria-hidden="true"></div>

      <h1 class="level-header__label">
        Level <span class="level-header__number">{{ level }}</span>
      </h1>

      <settings-button />
    </header>
  `,
};
