/* ============================================================
   Push the Button — app shell + screen router.

   A single Vue app owns the whole game. Screens are scenes,
   swapped under a soft warm wipe so the player never feels
   a page load.

   Routing rules:
     home     → home screen
     level1   → Level 1 (remounted fresh on every entry/replay)
     level2   → stub until Level 2 is designed
   ============================================================ */

const app = Vue.createApp({
  name: "PushTheButton",

  components: {
    HomeScreen,
    LevelOneScreen,
    LevelTwoStubScreen,
  },

  template: /* html */ `
    <div class="app-root">
      <home-screen v-if="screen === 'home'" @start="startGame" />

      <level-one-screen
        v-else-if="screen === 'level1'"
        :key="'level1-' + run"
        @next="goTo('level2')"
        @replay="goTo('level1')"
      />

      <level-two-stub-screen
        v-else-if="screen === 'level2'"
        @home="goTo('home')"
      />

      <div class="screen-wipe" :class="{ 'is-active': transitioning }"></div>
    </div>
  `,

  data() {
    return {
      screen: "home",
      transitioning: false,
      run: 0, // bumped to remount Level 1 in a pristine state
    };
  },

  created() {
    GameStore.load();
  },

  methods: {
    startGame() {
      this.goTo("level" + GameStore.unlockedLevel);
    },

    goTo(next) {
      if (this.transitioning) return;
      this.transitioning = true;

      // Swap the scene while the wipe covers the screen.
      setTimeout(() => {
        if (next === "level1") this.run++; // always enter Level 1 fresh
        this.screen = next;
      }, 220);
      setTimeout(() => (this.transitioning = false), 320);
    },
  },
});

app.mount("#app");
