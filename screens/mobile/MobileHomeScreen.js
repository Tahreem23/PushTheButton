/* ============================================================
   MobileHomeScreen — the front door of the mobile game.

   A touch-first echo of the desktop home: one button, one
   whispered invitation, and level pills for replay. Pressing
   the button starts the frontier mobile level (emits `start`);
   a pill replays that level (emits `start` with the level id).
   The mobile router (app.js) animates into the chosen scene.

   Emits: start.
   ============================================================ */

const MobileHomeScreen = {
  name: "MobileHomeScreen",
  emits: ["start"],

  components: {
    SettingsButton,
    PushButton,
  },

  template: /* html */ `
    <div class="screen home-screen mobile-home">
      <header class="home__bar">
        <settings-button />
      </header>

      <main class="home__main">
        <h1 class="home__title">PUSH THE BUTTON</h1>

        <div class="home__button-slot">
          <push-button label="START" @success="$emit('start')" />
        </div>

        <p class="home__invite">Go on...</p>

        <nav class="home__levels" aria-label="Choose a level">
          <button
            v-for="(id, i) in order"
            :key="id"
            type="button"
            class="home__level"
            :class="{
              'is-locked': !store.isUnlocked(id),
              'is-done': store.completedLevels.includes(id),
            }"
            :disabled="!store.isUnlocked(id)"
            :aria-label="'Level ' + (i + 1)"
            @click="$emit('start', id)"
          >
            {{ i + 1 }}
          </button>
        </nav>
      </main>
    </div>
  `,

  data() {
    return {
      store: GameStore,
      order: LEVEL_ORDER,
    };
  },
};
