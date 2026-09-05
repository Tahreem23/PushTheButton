/* ============================================================
   MobileHomeScreen — the front door of the mobile game.

   A touch-first echo of the desktop home: one button, one
   whispered invitation. Pressing it starts the frontier mobile
   level (emits `start`); the mobile router (app.js) animates
   into the chosen scene.

   No level-select pills: only one mobile level exists so far,
   so the frontier is always "The Elusive Button". Pills will
   arrive as more mobile levels are added.

   Emits: start.
   ============================================================ */

const MobileHomeScreen = {
  name: "MobileHomeScreen",
  emits: ["start"],

  components: {
    SettingsButton,
    PushButton,
    SpeechBubble,
  },

  template: /* html */ `
    <div class="screen home-screen mobile-home">
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
