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

      <h1 class="level-header__label" style="text-align: center;width:100%">
        Level <span class="level-header__number">{{ level }}</span>
      </h1>

      <settings-button />
    </header>
  `,
};
