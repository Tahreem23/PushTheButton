/* ============================================================
   HomeScreen — the front door of the game.

   One button, one whispered invitation, nothing else.
   Pressing the button emits `start`; the router (app.js)
   animates into the next scene.
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
      </main>
    </div>
  `,
};
