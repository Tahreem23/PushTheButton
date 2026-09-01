/* ============================================================
   GameArea — the play-area boundary every level shares.
   Levels are slotted inside <game-area>; coordinate systems,
   obstacles and movement all live relative to this stage.
   ============================================================ */

const GameArea = {
  name: "GameArea",
  template: /* html */ `
    <main class="game-area">
      <div class="game-area__stage" ref="stage">
        <slot />
      </div>
    </main>
  `,
};
