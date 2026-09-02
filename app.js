/* ============================================================
   Push the Button — app shell + screen router.

   A single Vue app owns the whole game. Screens are scenes,
   swapped under a soft warm wipe so the player never feels
   a page load.

   Routing rules:
     home              → home screen
     level:<id>        → the screen registered for that id in
                         levels.js — remounted fresh on every
                         entry/replay via the `run` key bump
     stub              → placeholder beyond the last level

   There is deliberately NO level-number logic here. Progression
   order lives entirely in levels.js (LEVEL_ORDER).
   ============================================================ */

const app = Vue.createApp({
  name: "PushTheButton",

  components: {
    HomeScreen,
    LevelStubScreen,
  },

  template: /* html */ `
    <div class="app-root">
      <home-screen v-if="screen === 'home'" @start="startGame" />

      <component
        v-else-if="levelComponent"
        :is="levelComponent"
        :key="screen + '-' + run"
        @next="goForward"
        @replay="replayLevel"
        @home="goTo('home')"
      />

      <level-stub-screen
        v-else-if="screen === 'stub'"
        :level="store.level + 1"
        @home="goTo('home')"
      />

      <div class="screen-wipe" :class="{ 'is-active': transitioning }"></div>
    </div>
  `,

  data() {
    return {
      store: GameStore,
      screen: "home",
      transitioning: false,
      run: 0, // bumped to remount the current level in a pristine state
    };
  },

  computed: {
    isLevelRoute() {
      return this.screen.startsWith("level:");
    },

    currentLevelId() {
      return this.isLevelRoute ? this.screen.slice(6) : null;
    },

    /* The screen component registered for this id (null → falls back
       to nothing renders — unreachable via normal navigation). */
    levelComponent() {
      return this.currentLevelId ? LEVEL_SCREENS[this.currentLevelId] ?? null : null;
    },
  },

  created() {
    GameStore.load();
  },

  methods: {
    /* The home button continues at the frontier; the level pills
       pass an explicit level id to replay an earlier one. */
    startGame(id) {
      const target =
        typeof id === "string" && GameStore.isUnlocked(id)
          ? id
          : GameStore.frontierLevel();
      this.goTo("level:" + target);
    },

    /* LevelComplete's "Next level →": the next id in LEVEL_ORDER,
       or the stub when the current level is the last designed one. */
    goForward() {
      const i = LEVEL_ORDER.indexOf(this.currentLevelId);
      const next = LEVEL_ORDER[i + 1];
      this.goTo(next ? "level:" + next : "stub");
    },

    replayLevel() {
      this.goTo(this.screen); // same route — the run bump remounts it
    },

    goTo(next) {
      if (this.transitioning) return;
      this.transitioning = true;

      // Swap the scene while the wipe covers the screen.
      setTimeout(() => {
        if (next.startsWith("level:")) this.run++; // always enter a level fresh
        this.screen = next;
      }, 220);
      setTimeout(() => (this.transitioning = false), 320);
    },
  },
});

app.mount("#app");
