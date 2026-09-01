/* ============================================================
   Push the Button — app shell + screen router.

   A single Vue app owns the whole game. Screens are scenes,
   swapped under a soft warm wipe so the player never feels
   a page load.

   Routing rules:
     home     → home screen
     level1   → Level 1 (remounted fresh on every entry/replay)
     level2   → Level 2 (remounted fresh on every entry/replay)
     level3   → Level 3 (remounted fresh on every entry/replay)
     level4   → Level 4 (remounted fresh on every entry/replay)
     level5   → stub until Level 5 is designed
   ============================================================ */

const app = Vue.createApp({
  name: "PushTheButton",

  components: {
    HomeScreen,
    LevelOneScreen,
    LevelTwoScreen,
    LevelThreeScreen,
    LevelFourScreen,
    LevelStubScreen,
  },

  template: /* html */ `
    <div class="app-root">
      <home-screen v-if="screen === 'home'" @start="startGame" />

      <level-one-screen
        v-else-if="screen === 'level1'"
        :key="'level1-' + run1"
        @next="goTo('level2')"
        @replay="goTo('level1')"
        @home="goTo('home')"
      />

      <level-two-screen
        v-else-if="screen === 'level2'"
        :key="'level2-' + run2"
        @next="goTo('level3')"
        @replay="goTo('level2')"
        @home="goTo('home')"
      />

      <level-three-screen
        v-else-if="screen === 'level3'"
        :key="'level3-' + run3"
        @next="goTo('level4')"
        @replay="goTo('level3')"
        @home="goTo('home')"
      />

      <level-four-screen
        v-else-if="screen === 'level4'"
        :key="'level4-' + run4"
        @next="goTo('level5')"
        @replay="goTo('level4')"
        @home="goTo('home')"
      />

      <level-stub-screen
        v-else-if="screen === 'level5'"
        :level="5"
        @home="goTo('home')"
      />

      <div class="screen-wipe" :class="{ 'is-active': transitioning }"></div>
    </div>
  `,

  data() {
    return {
      screen: "home",
      transitioning: false,
      run1: 0, // bumped to remount a level in a pristine state
      run2: 0,
      run3: 0,
      run4: 0,
    };
  },

  created() {
    GameStore.load();
  },

  methods: {
    /* The home button continues at the frontier; the level pills
       pass an explicit level to replay an earlier one. */
    startGame(level) {
      const target =
        typeof level === "number" && GameStore.isUnlocked(level)
          ? level
          : GameStore.frontierLevel();
      this.goTo("level" + target);
    },

    goTo(next) {
      if (this.transitioning) return;
      this.transitioning = true;

      // Swap the scene while the wipe covers the screen.
      setTimeout(() => {
        if (next === "level1") this.run1++; // always enter a level fresh
        if (next === "level2") this.run2++;
        if (next === "level3") this.run3++;
        if (next === "level4") this.run4++;
        this.screen = next;
      }, 220);
      setTimeout(() => (this.transitioning = false), 320);
    },
  },
});

app.mount("#app");
