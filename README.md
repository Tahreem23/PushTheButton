# PUSH THE BUTTON

A lightweight browser puzzle game. The objective is ridiculously simple:
**press the button once.** The game is figuring out *how* — each level
introduces one new obstacle between you and the press.

| Level | Id | Idea (one sentence) |
| ----- | -- | ------------------- |
| 1 | `simple` | You just… press it. The tutorial. |
| 2 | `evasive` | The button glides away when your cursor gets close. |
| 3 | `smug` | Same chase, but the button is smaller, faster, and taunts you. |
| 4 | `teleport` | The button teleports: spot it, get there, press before it's gone. |
| 5 | `crowd` | Five(ish) identical buttons plead for the press; one is real. |
| 6 | `seeker` | One button, invisible — sweep the cursor and follow the whispers. |
| 7+ | — | Stub placeholder until another id is added to the registry. |

**Level order lives in ONE place: `levels.js` (`LEVEL_ORDER`).** Level
numbers are derived from position, ids are the identity — reordering is
literally moving a string.

> **Read `AGENTS.md` first.** It is the source of truth for game rules,
> UI lock-in, code quality, and the testing checklist. This README is the
> technical map; AGENTS.md is the law.

---

## Tech stack

- **Vue 3 via CDN** (`vue.global.prod.js`, pinned 3.5.13) — global builds,
  no bundler, no transpiler, no npm dependencies.
- Vanilla JS, HTML, CSS. Everything is plain `<script>` / `<link>` tags in
  `index.html`, load order matters.
- **No build step.** Serving the folder statically is the entire build.
- Deployed on **Vercel** via Git integration: pushing to `main` deploys.

### Run locally

Any static file server pointed at the repo root works, e.g.:

```bash
npx serve .
# or
python -m http.server
```

---

## Repository structure

```
index.html                  Entry point. Declares ALL css/js includes, in order.
levels.js                   THE level registry: LEVEL_ORDER + id → screen.
app.js                      Vue app shell + data-driven router (one Vue instance).
stores/game.js              GameStore — single source of truth for progress/session.
shared/evasiveButton.js     EvasiveButton mixin + EVASION_DEFAULTS (evasive & smug).
screens/                    One file per level, named by MECHANIC (id), never number.
  HomeScreen.js             Front door: big button + level-select pills.
  SimpleScreen.js           "simple" — press it.
  EvasiveScreen.js          "evasive" (thin: mixin + template + identity).
  SmugScreen.js             "smug" (mixin + SMUG_TUNING + SMUG_BANTER).
  TeleportScreen.js         "teleport" — appear/vanish cycle (standalone).
  CrowdScreen.js            "crowd" — pick the real button (standalone).
  SeekerScreen.js           "seeker" — the invisible button (standalone).
  LevelStubScreen.js        "Level N is being designed" placeholder (prop: level).
components/<Name>/          One folder per component: <Name>.js + <Name>.css.
  LevelHeader               "LEVEL n" header + settings button slot.
  SettingsButton            Top-right settings button.
  GameArea                  The shared play-stage boundary every level renders in.
  PushButton                THE button. All presses flow through it.
  SpeechBubble              Short text bubble. Props: text; class: --banter.
  CelebrationBurst          One-shot particle burst; bump `burst` prop to fire.
  LevelComplete             Success panel. Emits: next / replay / home.
css/
  variables.css             Design tokens (colors, sizes, easings). Start here for design.
  base.css                  Resets, .screen shell, .screen-flash.
  screens/transitions.css   The warm screen-wipe between scenes.
  screens/home.css          Home composition (+ level pills).
  screens/level1.css        Level 1 composition + shared success keyframes
                            (stage-nod, stage-leave, bubble-pop — reused elsewhere!).
  screens/evasive.css       Shared layout for the evasive/smug levels.
  screens/crowd.css         "crowd" — spots, pop/shake layers, intro line.
  screens/seeker.css        "seeker" — hidden station, reveal pop, hint bubble.
  screens/teleport.css      "teleport" — appear/vanish cycle, quip bubble.
  screens/stub.css          Stub screen.
```

---

## Architecture

### App shell & routing (`app.js`)

One Vue app owns the whole game. "Routing" is a `screen` string swapped
under a warm wipe overlay. The router is **data-driven**: it knows nothing
about specific levels.

```
home → level:<id> → level:<next-id> → stub (past the last level)
```

Key patterns to know:

- **The registry (`levels.js`).** `LEVEL_ORDER` is the progression order;
  `LEVEL_SCREENS` maps id → component object. `level:<id>` routes resolve
  through it via a dynamic `<component :is>`. Reordering levels = moving
  one string; nothing else changes. (`levels.js` loads AFTER the screens,
  because it references the component objects directly.)
- **Fresh-remount key.** Level routes render with `:key="screen + '-' + run"`;
  `goTo()` bumps `run` for any `level:` destination, so *entering or
  replaying a level always mounts a pristine component*. This IS the reset
  mechanism for every level — there are no manual reset methods.
- `startGame(id?)`: the home button continues at `GameStore.frontierLevel()`;
  home pill clicks pass an explicit level id.
- `@next` from a level → the next id in `LEVEL_ORDER` (`goForward()`), or
  the stub when the current level is last.
- Transitions: `goTo()` flips the screen 220ms into a 320ms wipe.

### Game state (`stores/game.js`)

`GameStore` is a `Vue.reactive` object used directly as `store` in screens.
Groups — note identity is by **id**, never number:

- **Persisted progress**: `completedLevels` (level ids), `load()`, `save()`
  behind the `PERSIST_PROGRESS` flag (top of file, currently `true` —
  progress survives reloads; flip to `false` for fresh starts without
  deleting stored data). Legacy saves stored level NUMBERS: `load()`
  migrates those to ids by position in the *current* order, once.
- **Derived navigation**: `unlockedIndex()` (all completed + the next id),
  `isUnlocked(id)` (completed ids are always replayable), `frontierLevel()`.
- **Session state**: `levelId`, `level` (display number, derived),
  `attempts`, `levelComplete`, `buttonEnabled`. Every level screen calls
  `GameStore.startLevel("<id>")` in `created()` and
  `GameStore.completeLevel()` on the winning press. `recordPress()` counts
  presses.

### Level anatomy

Every implemented level screen follows the same skeleton:

1. `created()` → `GameStore.startLevel("<id>")` (its own thematic id).
2. Template: `.screen` root → `level-header` → `game-area` → level-specific
   content → success overlay (`level-complete`) → `.screen-flash` div.
3. Success ceremony: burst → stage nod (`is-hit`) → stage bows out
   (`is-leaving`, keyframes shared from `level1.css`) → `level-complete`
   panel after ~550ms.
4. Panel actions: `next` → next route, `replay` → remount via run-key,
   `home` → home route.
5. **Cleanup**: anything a level creates (listeners, timers, loops) must
   die in `unmounted()`. Remount-on-entry guarantees a clean slate.

### The evasive mechanic (`shared/evasiveButton.js`)

Levels 2 and 3 share one mixin, `EvasiveButton`. It owns:

- pointer tracking (from `created()`, so the cursor is known before mount),
- proximity detection (`escapeDistance` from the button's *edge*),
- escape: up to `candidates` landing spots, biased away from the pointer,
  clamped to bounds, must clear the pointer by `escapeBuffer` and be a real
  jump (`minJump`); when cornered, it slides to the least-bad spot (this is
  what keeps the button catchable — never impossible),
- initial placement that avoids the cursor/stage center,
- **press freeze**: if a press lands mid-glide, the mover freezes exactly
  under the finger (a started press can never be stolen),
- the whole success ceremony + all listener/timer cleanup.
- Measurements are cached (`measure()` on mount/resize); the pointermove
  hot loop never forces layout. Movement is CSS `transform` transitions
  driven by `--move-duration`.

Contract: the template must provide `ref="arena"` (absolute canvas),
`ref="mover"` (gliding unit = bubble row + button row), `ref="slot"`
(button slot), and a PushButton wired to `@press="onPressStart"` /
`@success="onSuccess"`.

Extension hooks (override in the screen):

| Hook | Purpose | evasive | smug |
| ---- | ------- | ------- | ---- |
| `tuning()` | numbers merged over `EVASION_DEFAULTS` | defaults | `SMUG_TUNING` |
| `onApproach(p)` | "pointer is too close" — default escapes | default (flee) | flee + taunt |
| `onPressInto()` | press landed, pre-freeze | — | — |
| `onCaught()` | winning press reaction | hide bubble | success line |

The "smug" level adds banter on top: `SMUG_TUNING` (all gameplay numbers)
+ `SMUG_BANTER` (all dialogue), bubble re-pops per line via
`:key="tauntTick"`, cooldown-gated (`interactionCooldown — escapes still
happen silently during the sulk).

### Components worth respecting

- `PushButton` — pure presentation + press state machine:
  `idle → pressed → success`. The parent decides what success means.
  Never add gameplay to it. Sizing is ALL derived from `--button-size`
  (Level 3's shrink is just that token × its `buttonScale` tuning).
- `GameArea` — the stage. All level coordinates/motion are relative to it.
- `SpeechBubble` — the `--banter` class exempts a bubble from the
  hover-excitement rule (which would restart its pop-in animation as the
  cursor crosses the button — this was a real bug).

---

## How to add a new level

1. Create `screens/<Name>Screen.js` (copy the closest existing level;
   reuse `EvasiveButton` if it's a chase level). Its `created()` calls
   `GameStore.startLevel("<id>")` with its own thematic id.
2. In `levels.js`: append the id to `LEVEL_ORDER` and add
   `id: <Name>Screen` to `LEVEL_SCREENS`.
3. Add its script tag to `index.html` (screens block, before `levels.js`)
   plus a stylesheet link if it has one.
4. Run the AGENTS.md §17 testing checklist.

Router, unlocks, home pills, the header number, and the previous level's
"Next level →" (which used to hit the stub) all follow automatically.

---

## Gotchas (hard-won, don't rediscover)

- **Vue 3 instance fields:** `data()` keys starting with `_` are NOT
  proxied — housekeeping (`_timers`, `_pressing`, …) is assigned in
  `created()`, not declared in `data()`.
- **CSS animation restarts:** any rule that overrides `animation` on an
  element replays the entrance when the override stops applying. Hence
  `--banter` above.
- **Clicks on a moving button cancel** unless the glide is frozen on
  `@press` (`pointerleave` fires as the button slides away — the
  PushButton quietly cancels). The mixin's `onPressStart` freeze exists
  for this reason.
- **`--button-size` duplication:** Level 3's `slotStyle` repeats the
  `clamp(120px, 26vmin, 176px)` expression from `variables.css` to scale
  it — keep them in sync if the master size changes.
- **Load order in `index.html`:** `stores/game.js` → `shared/` mixins →
  components → screens → `levels.js` → `app.js`. Everything is globals;
  there are no modules. `levels.js` MUST load after the screens (it
  holds component object references).
- **Save format is id-based.** `completedLevels` holds ids like
  `"smug"`, so reordering levels never corrupts progress. Numeric saves
  from before the registry existed are migrated by position on load.
- **Persistence is ON** (`PERSIST_PROGRESS = true` in `stores/game.js`).
  Progress survives reloads. (It was briefly off by request — check the
  flag if a reload unexpectedly resets to Level 1.)
