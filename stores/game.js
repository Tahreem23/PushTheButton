/* ============================================================
   GameStore — the game's single source of truth.

   Presentation (screens/components) never mutates gameplay rules
   directly; everything flows through this store.

   Level identity is the ID ("simple", "evasive", …), never the
   position. Reordering levels.js reshuffles nothing in a save.
   Legacy saves stored level NUMBERS — load() migrates them by
   position in the current order, once.

   Persisted to localStorage (behind PERSIST_PROGRESS):
     completedLevels — level ids finished at least once

   Session-only (reset on every level entry):
     levelId, level, attempts, levelComplete, buttonEnabled
   ============================================================ */

const SAVE_KEY = "ptb.save.v1";

/* Progress persistence switch — currently ON: completed levels and
   unlocks survive a reload via localStorage. Set to false to make
   every reload start fresh at Level 1 without deleting saved data. */
const PERSIST_PROGRESS = false;

const GameStore = Vue.reactive({
  /* ---- persisted progress ------------------------------------ */
  completedLevels: [],   // level ids, e.g. ["simple", "evasive"]

  /* ---- session state (current level) -------------------------- */
  levelId: null,        // id of the level being played
  level: 1,             // its display number (position in LEVEL_ORDER)
  attempts: 0,          // presses this attempt
  levelComplete: false,
  gameComplete: false,  // reserved — no "last level" exists yet
  buttonEnabled: true,  // false once the level is solved

  load() {
    if (!PERSIST_PROGRESS) return;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const save = JSON.parse(raw);
      if (Array.isArray(save.completedLevels)) {
        this.completedLevels = save.completedLevels
          // migrate legacy numeric saves by position; keep ids as-is
          .map((v) => (typeof v === "number" ? LEVEL_ORDER[v - 1] : v))
          .filter((id) => typeof id === "string" && LEVEL_ORDER.includes(id));
      }
    } catch {
      /* corrupted save → start fresh */
    }
  },

  save() {
    if (!PERSIST_PROGRESS) return;
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ completedLevels: this.completedLevels })
    );
  },

  /* Highest playable index: every completed level, plus the next one
     in LEVEL_ORDER. All-completed → the last level stays playable. */
  unlockedIndex() {
    const firstTodo = LEVEL_ORDER.findIndex((id) => !this.completedLevels.includes(id));
    if (firstTodo === -1) return LEVEL_ORDER.length - 1;
    return Math.min(firstTodo, LEVEL_ORDER.length - 1);
  },

  /* Playable = in the registry AND reached by progress (or solved
     before — a completed level is always replayable). */
  isUnlocked(id) {
    const idx = LEVEL_ORDER.indexOf(id);
    return idx !== -1 && (this.completedLevels.includes(id) || idx <= this.unlockedIndex());
  },

  /* Where "Press the button" on the home screen takes the player. */
  frontierLevel() {
    return LEVEL_ORDER[this.unlockedIndex()];
  },

  /* Begin (or restart) a level: session state returns to zero.
     Unknown ids are impossible via the router, but never crash. */
  startLevel(id) {
    if (!LEVEL_ORDER.includes(id)) id = LEVEL_ORDER[0];
    this.levelId = id;
    this.level = LEVEL_ORDER.indexOf(id) + 1;
    this.attempts = 0;
    this.levelComplete = false;
    this.buttonEnabled = true;
  },

  recordPress() {
    if (this.buttonEnabled && !this.levelComplete) this.attempts++;
  },

  /* Mark the current level solved; the next in LEVEL_ORDER unlocks. */
  completeLevel() {
    if (this.levelComplete) return;
    this.levelComplete = true;
    this.buttonEnabled = false;

    if (!this.completedLevels.includes(this.levelId)) {
      this.completedLevels.push(this.levelId);
    }
    this.save();
  },

  /* Full progress wipe (future: settings screen hook). */
  resetProgress() {
    localStorage.removeItem(SAVE_KEY);
    this.completedLevels = [];
    this.levelId = null;
    this.level = 1;
    this.gameComplete = false;
  },
});
