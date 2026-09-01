/* ============================================================
   GameStore — the game's single source of truth.

   Presentation (screens/components) never mutates gameplay rules
   directly; everything flows through this store.

   Persisted to localStorage:
     unlockedLevel    — the highest level the player may enter
     completedLevels  — levels finished at least once

   Session-only (reset on every level entry):
     level, attempts, levelComplete, buttonEnabled, gameComplete
   ============================================================ */

const SAVE_KEY = "ptb.save.v1";

const GameStore = Vue.reactive({
  /* ---- persisted progress ------------------------------------ */
  unlockedLevel: 1,
  completedLevels: [],

  /* Highest level that actually exists in this build. Progress may
     unlock levels beyond this (the stub stands in for them), but
     navigation should never send the player past it. */
  maxLevel: 3,

  /* ---- session state (current level) -------------------------- */
  level: 1,
  attempts: 0,          // presses this attempt
  levelComplete: false,
  gameComplete: false,  // reserved — no "last level" exists yet
  buttonEnabled: true,  // false once the level is solved

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const save = JSON.parse(raw);
      if (Array.isArray(save.completedLevels)) this.completedLevels = save.completedLevels;
      if (typeof save.unlockedLevel === "number") {
        this.unlockedLevel = Math.max(1, save.unlockedLevel);
      }
    } catch {
      /* corrupted save → start fresh */
    }
  },

  save() {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        unlockedLevel: this.unlockedLevel,
        completedLevels: this.completedLevels,
      })
    );
  },

  /* Begin (or restart) a level: session state returns to zero. */
  startLevel(level) {
    this.level = level;
    this.attempts = 0;
    this.levelComplete = false;
    this.buttonEnabled = true;
  },

  recordPress() {
    if (this.buttonEnabled && !this.levelComplete) this.attempts++;
  },

  /* Playable = exists in this build AND unlocked by progress. */
  isUnlocked(level) {
    return level >= 1 && level <= this.maxLevel && level <= this.unlockedLevel;
  },

  /* Where "Press the button" on the home screen should take the
     player: the current frontier, never past what exists. */
  frontierLevel() {
    return Math.max(1, Math.min(this.unlockedLevel, this.maxLevel));
  },

  /* Mark the current level solved and unlock the next one. */
  completeLevel() {
    if (this.levelComplete) return;
    this.levelComplete = true;
    this.buttonEnabled = false;

    if (!this.completedLevels.includes(this.level)) {
      this.completedLevels.push(this.level);
    }
    this.unlockedLevel = Math.max(this.unlockedLevel, this.level + 1);
    this.save();
  },

  /* Full progress wipe (future: settings screen hook). */
  resetProgress() {
    localStorage.removeItem(SAVE_KEY);
    this.unlockedLevel = 1;
    this.completedLevels = [];
    this.gameComplete = false;
  },
});
