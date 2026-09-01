/* ============================================================
   PushButton — the toy button itself.

   States:  idle → (pointerdown) → pressed → (release) → success
            success pops back up, then the LEVEL (parent) decides
            what happens next by calling .reset() on the ref.

   Emits:   press   (finger lands)
            success (press completed — particles, celebration)
   ============================================================ */

const PushButton = {
  name: "PushButton",
  emits: ["press", "success"],

  template: /* html */ `
    <button
      ref="el"
      class="push-button"
      :class="stateClass"
      type="button"
      aria-label="Push the button"
      @pointerdown="onPress"
      @pointerup="onRelease"
      @pointercancel="onCancel"
      @pointerleave="onCancel"
    >
      <span class="push-button__floor"></span>
      <span class="push-button__base"></span>
      <span class="push-button__cap">
        <span class="push-button__side"></span>
        <span class="push-button__top"></span>
      </span>
    </button>
  `,

  data() {
    return { state: "idle" }; // idle | pressed | success
  },

  computed: {
    stateClass() {
      return this.state === "idle" ? "" : `is-${this.state}`;
    },
  },

  methods: {
    onPress() {
      if (this.state !== "idle") return;
      this.state = "pressed";
      this.$emit("press");
    },

    onRelease() {
      if (this.state !== "pressed") return;
      this.state = "success";
      this.$emit("success");
    },

    onCancel() {
      // Finger slid off before committing — quietly stand back up.
      if (this.state === "pressed") this.state = "idle";
    },

    /* Parent (the level) calls this when the celebration is over. */
    reset() {
      this.state = "idle";
    },
  },
};
