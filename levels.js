/* ============================================================
   levels.js — THE level registry. The one place progression
   order lives. Everything else (router, unlocks, home pills,
   saved progress) follows this list.

   Reorder levels  → move an id in LEVEL_ORDER. Done. Nothing else
                     to touch — screens are named by their mechanic,
                     and saves track ids, not positions.
   Add a level     → 1. create screens/<Name>Screen.js
                        (its created() calls GameStore.startLevel("<id>"))
                     2. append the id to LEVEL_ORDER
                     3. add id → component in LEVEL_SCREENS
                     4. add its css/script includes to index.html
                     Router, unlocks, pills and "Next level →" all
                     pick it up automatically; the old final level's
                     Next button leads to a stub until then.

   NOTE: loaded AFTER the screens, because LEVEL_SCREENS holds the
   component objects themselves.
   ============================================================ */

const LEVEL_ORDER = [
  "simple",   // press it. that's it.
  "evasive",  // it moves when you get close
  "smug",     // smaller, faster, and mouthy
  "teleport", // pops in, shouts, vanishes — catch it in time
  "crowd",    // five lookalikes; one is real
  "seeker",   // invisible; sweep the cursor, follow the whispers
];

/* id → the screen component. Kept in sync with screens/. */
const LEVEL_SCREENS = {
  simple: SimpleScreen,
  evasive: EvasiveScreen,
  smug: SmugScreen,
  teleport: TeleportScreen,
  crowd: CrowdScreen,
  seeker: SeekerScreen,
};
