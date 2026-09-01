/* ============================================================
   Push the Button — app shell + screen router.

   A single Vue app owns the whole game. Screens are scenes,
   swapped under a soft warm wipe so the player never feels
   a page load.
   ============================================================ */

const app = Vue.createApp({
  name: "PushTheButton",

  components: {
    HomeScreen,
    LevelOneScreen,
  },

  template: /* html */ `
    <div class="app-root">
      <home-screen v-if="screen === 'home'" @start="goTo('level1')" />
      <level-one-screen v-else-if="screen === 'level1'" @finished="goTo('home')" />

      <div class="screen-wipe" :class="{ 'is-active': transitioning }"></div>
    </div>
  `,

  data() {
    return {
      screen: "home",
      transitioning: false,
    };
  },

  methods: {
    goTo(next) {
      if (this.transitioning) return;
      this.transitioning = true;

      // Swap the scene while the wipe covers the screen.
      setTimeout(() => (this.screen = next), 220);
      setTimeout(() => (this.transitioning = false), 320);
    },
  },
});

app.mount("#app");
