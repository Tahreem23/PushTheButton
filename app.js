/* ============================================================
   Push the Button — app shell + screen router.

   A single Vue app owns the whole game. Screens are scenes,
   swapped under a soft warm wipe so the player never feels
   a page load.

   Two flavors of the app share this file:
     desktop — the original mouse-driven game
     mobile  — a touch-first variant accessed via #mobile hash

   Routing rules (both flavors):
     home              → home screen
     level:<id>        → the screen registered for that id in the
                         active registry — remounted fresh on every
                         entry/replay via the `run` key bump
     stub              → placeholder beyond the last designed level

   There is deliberately NO level-number logic here. Progression
   order lives entirely in levels.js (LEVEL_ORDER) — the single
   source of truth — and BOTH flavors follow it. The only thing
   that differs is which screen an id resolves to:
     desktop  → LEVEL_SCREENS        (levels.js)
     mobile   → MOBILE_LEVEL_SCREENS (levels.mobile.js)

   Mobile detection:
     Hash-based — no server rewrites needed. On a page load without
     #mobile, a touch-only device gets the hash set and mounts the
     mobile app (no navigation, no reload). #mobile is always
     directly accessible for testing (yoursite.com/#mobile).
     Detection uses the hover/pointer media queries (the canonical
     "touch-only" profile) so touch-screen laptops with a mouse
     stay on desktop.
   ============================================================ */

/* ---- Device detection ----------------------------------------
   Reliable touch-only detection without resorting to viewport
   width. A touch-screen laptop has a mouse + hover, so it stays
   on desktop; a phone/tablet has no hover and a coarse pointer. */
function isTouchOnlyDevice() {
  if (!window.matchMedia) return false;
  // Primary signal: no hover, coarse pointer.
  if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) return true;
  // Fallback for older engines: touch events + no hover capability.
  if ("ontouchstart" in window && window.matchMedia("(hover: none)").matches) return true;
  return false;
}

/* ---- Route → which flavor? -----------------------------------
   Hash-based: #mobile → mobile app. No hash (or anything else) on
   a touch-only device → set #mobile and mount the mobile app (no
   page reload). Directly visiting /#mobile always works for testing.
   Everything else is the desktop app. */
function resolveFlavor() {
  if (window.location.hash === "#mobile") return "mobile";

  if (isTouchOnlyDevice()) {
    // Set the hash so a manual reload stays on mobile, and so the
    // URL is shareable. replaceState avoids a history entry.
    history.replaceState(null, "", "#mobile");
    return "mobile";
  }

  return "desktop";
}

/* ============================================================
   Desktop app — the original mouse-driven game.
   ============================================================ */

const desktopApp = Vue.createApp({
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
        v-else-if="screen === 'stub' || isLevelRoute"
        :level="stubLevel"
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

    /* The screen component registered for this id (null → the id
       has no desktop screen yet; the stub catches it). */
    levelComponent() {
      return this.currentLevelId ? LEVEL_SCREENS[this.currentLevelId] ?? null : null;
    },

    /* The number the stub shows: the unbuilt level's own position,
       or one past the level just finished. */
    stubLevel() {
      return this.isLevelRoute ? LEVEL_ORDER.indexOf(this.currentLevelId) + 1 : this.store.level + 1;
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

/* ============================================================
   Mobile app — touch-first variant. Same progression order
   (LEVEL_ORDER), different screen registry
   (MOBILE_LEVEL_SCREENS). Levels without a mobile screen yet
   fall through to the shared stub.
   ============================================================ */

const mobileApp = Vue.createApp({
  name: "PushTheButtonMobile",

  components: {
    MobileHomeScreen,
    LevelStubScreen,
  },

  template: /* html */ `
    <div class="app-root is-mobile">
      <mobile-home-screen v-if="screen === 'home'" @start="startGame" />

      <component
        v-else-if="levelComponent"
        :is="levelComponent"
        :key="screen + '-' + run"
        @next="goForward"
        @replay="replayLevel"
        @home="goTo('home')"
      />

      <level-stub-screen
        v-else-if="screen === 'stub' || isLevelRoute"
        :level="store.level"
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

    /* The MOBILE screen registered for this id. Falls back to null
       → the stub catches it as a level without a mobile version. */
    levelComponent() {
      return this.currentLevelId
        ? (MOBILE_LEVEL_SCREENS[this.currentLevelId] ?? null)
        : null;
    },
  },

  created() {
    GameStore.load();
  },

  methods: {
    /* The home button continues at the frontier; progression order
       is shared with desktop (LEVEL_ORDER). */
    startGame(id) {
      const target =
        typeof id === "string" && GameStore.isUnlocked(id)
          ? id
          : GameStore.frontierLevel();
      this.goTo("level:" + target);
    },

    /* "Next level →": the next id in the shared LEVEL_ORDER, or the
       stub when the current level is the last designed one. */
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

/* ---- Boot --------------------------------------------------- */
const flavor = resolveFlavor();
if (flavor === "mobile") {
  mobileApp.mount("#app");
} else {
  desktopApp.mount("#app");
}
