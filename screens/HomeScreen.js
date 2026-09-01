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
            v-for="level in store.maxLevel"
            :key="level"
            type="button"
            class="home__level"
            :class="{
              'is-locked': !store.isUnlocked(level),
              'is-done': store.completedLevels.includes(level),
            }"
            :disabled="!store.isUnlocked(level)"
            :aria-label="'Level ' + level"
            @click="$emit('start', level)"
          >
            {{ level }}
          </button>
        </nav>
      </main>
    </div>
  `,

  data() {
    return { store: GameStore };
  },
};
