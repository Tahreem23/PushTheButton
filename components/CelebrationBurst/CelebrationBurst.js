/* ============================================================
   CelebrationBurst — one-shot particle burst on success.

   Props: burst (Number) — bump this value to fire once.
   Renders nothing while dormant.
   ============================================================ */

const CelebrationBurst = {
  name: "CelebrationBurst",

  props: {
    burst: { type: Number, default: 0 },
  },

  template: /* html */ `
    <div v-if="visible" class="celebration-burst" aria-hidden="true">
      <span class="celebration-burst__ring"></span>
      <span
        v-for="dot in dots"
        :key="dot.id"
        class="celebration-burst__dot"
        :style="{ '--angle': dot.angle + 'deg', '--dist': dot.dist }"
      ></span>
    </div>
  `,

  data() {
    return { visible: false, dots: [] };
  },

  watch: {
    burst(next, prev) {
      if (next !== prev) this.fire();
    },
  },

  methods: {
    fire() {
      // 10 dots: evenly spread with humanizing jitter, modest distances.
      this.dots = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        angle: i * 36 + (Math.random() * 22 - 11),
        dist: `calc(var(--button-size) * ${(0.75 + Math.random() * 0.5).toFixed(2)})`,
      }));
      this.visible = true;
      setTimeout(() => (this.visible = false), 700);
    },
  },
};
