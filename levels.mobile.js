/* ============================================================
   levels.mobile.js — the MOBILE level registry.

   Progression ORDER is shared with the desktop game: it is
   LEVEL_ORDER from levels.js. There is exactly ONE order list;
   this file never duplicates it.

   The only thing that differs on mobile is WHICH screen an id
   resolves to. MOBILE_LEVEL_SCREENS maps an id to its mobile
   screen. Ids without a mobile entry fall through to the mobile
   stub (handled by the mobile app shell in app.js), so the
   existing level-order system keeps driving progression even
   for levels whose mobile version isn't built yet.

   Add a mobile level → 1. create screens/mobile/<Name>Screen.js
                          (its created() calls GameStore.startLevel("<id>"))
                       2. add id → component here
                       The mobile router, frontier, and "Next level →"
                       all pick it up automatically.

   NOTE: loaded AFTER the mobile screens (it holds component
   object references), and AFTER levels.js (it references
   LEVEL_ORDER).
   ============================================================ */

const MOBILE_LEVEL_SCREENS = {
  evasive: ElusiveButtonScreen, // Level 2 on mobile: "The Elusive Button"
};
