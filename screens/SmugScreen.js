/* ============================================================
   SmugScreen — the "smug" level: the button has opinions.

   Same evasion as Level 2 (the EvasiveButton mixin), but the
   button is smaller, faster — and now it TALKS. It anticipates
   the cursor and gracefully slides away before you arrive,
   getting cheeky about it every time you come up short.

   Approach lifecycle:
     pointer gets close → escape + taunt
       → press lands  → caught (the only way to win)
       → escape lands → cooldown (further escapes stay silent)
     cooldown ends → ready for another taunt

   Emits: next, replay, home.
   ============================================================ */

/* Every tunable for this puzzle lives here — nowhere else. */
const SMUG_TUNING = {
  buttonScale: 0.6,         // ~30% smaller than Level 2's button
  moveDuration: 200,        // ~30% faster glide than Level 2's 300ms
  escapeDistance: 90,       // px from the button's edge — how early it
                            // senses the approaching cursor
  interactionCooldown: 600, // ms of sulking after a taunt (no new dialogue)
  bowDelay: 1000,           // let the last line land before the stage bows
  panelDelay: 1600,         // … and before the success panel replaces it
};

/* The button's whole vocabulary. Short lines only — it's a button. */
const SMUG_BANTER = {
  start: "Haha, you can't catch me now!",
  success: "Oh darn it... you got me!",
  taunts: [
    "Too slow!",
    "Missed me!",
    "Almost!",
    "Nice try!",
    "So close!",
    "Catch me if you can!",
    "You missed! Haha!",
    "You're getting warmer...",
  ],
};

const SmugScreen = {
  name: "SmugScreen",
  emits: ["next", "replay", "home"],

  mixins: [EvasiveButton],

  components: {
    LevelHeader,
    SettingsButton,
    GameArea,
    PushButton,
    SpeechBubble,
    CelebrationBurst,
    LevelComplete,
  },

  template: /* html */ `
    <div class="screen evasive-screen level3-screen" :class="{ 'is-hit': hitTick, 'is-leaving': leaving }">
      <level-header :level="store.level" />

      <game-area>
        <div class="evasive-canvas" ref="arena">
          <div
            ref="mover"
            class="evasive-mover"
            :class="{ 'is-gliding': gliding }"
            :style="moverStyle"
          >
            <div class="evasive-bubble-anchor">
              <!-- :key re-mounts the bubble per line, replaying its pop-in.
                   The banter bubble is dialogue, not an invitation — the
                   --banter class exempts it from the hover-excitement wobble
                   (which would otherwise restart its pop-in mid-flight). -->
              <speech-bubble :key="tauntTick" class="speech-bubble--banter" :text="taunt" />
            </div>

            <div ref="slot" class="evasive-slot" :style="slotStyle">
              <push-button
                ref="button"
                :disabled="!store.buttonEnabled"
                @press="onPressStart"
                @success="onSuccess"
              />
              <celebration-burst :burst="burstCount" />
            </div>
          </div>
        </div>
      </game-area>

      <div v-if="panelVisible" class="evasive-overlay">
        <level-complete
          :level="store.level"
          @next="$emit('next')"
          @replay="$emit('replay')"
          @home="$emit('home')"
        />
      </div>

      <div class="screen-flash" :class="{ 'is-active': flashing }"></div>
    </div>
  `,

  data() {
    return {
      store: GameStore,

      /* ---- banter state ---- */
      taunt: SMUG_BANTER.start,
      tauntTick: 0,       // bumped per line so the bubble re-pops
      bantering: false,   // post-taunt sulk — escapes stay silent
    };
  },

  created() {
    // Entering the level resets its session state (replay included).
    GameStore.startLevel("smug");
  },

  computed: {
    /* The smaller button: same approved design, scaled whole via its
       --button-size token so every part (floor, base, cap, label)
       shrinks proportionally. */
    slotStyle() {
      return {
        "--button-size": `calc(clamp(120px, 26vmin, 176px) * ${this.tune.buttonScale})`,
      };
    },
  },

  methods: {
    tuning() {
      return SMUG_TUNING;
    },

    /* Pointer got close: flee immediately (it saw you coming) and,
       unless it's still sulking from the last one, rub it in. */
    onApproach(p) {
      this.escape(p);
      if (this.bantering) return;

      this.taunt = this.pickTaunt();
      this.tauntTick++;

      this.bantering = true;
      this.later(() => (this.bantering = false), this.tune.interactionCooldown);
    },

    /* Short, varied, never the same line twice in a row. */
    pickTaunt() {
      const pool = SMUG_BANTER.taunts;
      let next = this.taunt;
      while (next === this.taunt) {
        next = pool[Math.floor(Math.random() * pool.length)];
      }
      return next;
    },

    /* Caught. It gets the last word — then the stage bows out. */
    onCaught() {
      this.taunt = SMUG_BANTER.success;
      this.tauntTick++;
      this.bantering = false;
    },
  },
};
