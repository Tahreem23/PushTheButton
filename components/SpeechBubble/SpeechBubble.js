/* ============================================================
   SpeechBubble — small friendly line of dialog near the button.
   Props: text (String, default "Press me!")
   ============================================================ */

const SpeechBubble = {
  name: "SpeechBubble",
  props: {
    text: { type: String, default: "Press me!" },
  },
  template: /* html */ `
    <div class="speech-bubble speech-bubble--enter" role="status">
      {{ text }}
    </div>
  `,
};
