/* ============================================================
   HomeScreen — the front door of the game.

   One button, one whispered invitation… plus a quiet row of
   level pills so finished levels stay replayable. Pressing the
   button starts the frontier level (emits `start`); a pill
   replays that level (emits `start` with the level number).
   The router (app.js) animates into the chosen scene.
   ============================================================ */

const HomeScreen = {
  name: "HomeScreen",
  emits: ["start"],

  components: {
    SettingsButton,
    PushButton,
    SpeechBubble,
  },

  template: /* html */ `
    <div class="screen home-screen">
      <header class="home__bar">
        <settings-button />
      </header>

      <main class="home__main">
        <h1 class="home__title">PUSH THE BUTTON</h1>

        <div class="speech-anchor">
          <speech-bubble />
        </div>

        <div class="home__button-slot">
          <push-button @success="$emit('start')" />
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
      order: LEVEL_ORDER, // pills follow the registry, not a count
    };
  },
};
