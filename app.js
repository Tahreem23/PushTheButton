/* ============================================================
   Push the Button — app shell + screen router.

   A single Vue app owns the whole game. Screens are scenes,
   swapped under a soft warm wipe so the player never feels
   a page load.

   Two flavors of the app share this file:
     desktop — the original mouse-driven game
     mobile  — a touch-first variant routed at /mobile

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
     On the root route "/", a touch-only device is redirected to
     "/mobile" (no manual device-selection screen). Detection uses
     the hover/pointer media queries (the canonical "touch-only"
     profile) so touch-screen laptops with a mouse stay on desktop.
     "/mobile" is always directly accessible for testing, and a
     redirect never fires when already there (no loops).
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
   "/mobile" always renders the mobile app (directly testable).
   "/" on a touch-only device redirects to "/mobile" (once —
   replace() keeps the back button clean). Everything else is
   the desktop app. */
function resolveFlavor() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/mobile") return "mobile";

  if (path === "/" && isTouchOnlyDevice()) {
    // Redirect to the mobile route; replace so the back button
    // doesn't bounce back to "/" and re-trigger the redirect.
    window.location.replace("/mobile");
    return null; // the page navigates away; don't mount anything
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

    /* The MOBILE screen registered for this id. Falls back to null
       → the stub — for levels whose mobile version isn't built yet. */
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
} else if (flavor === "desktop") {
  desktopApp.mount("#app");
}
// flavor === null → a redirect is in flight; mount nothing.
