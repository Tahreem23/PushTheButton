# PUSH THE BUTTON — AGENTS.md

## Project Overview

**Push the Button** is a lightweight browser puzzle game built with:

* Vue.js via CDN
* Vanilla JavaScript
* HTML
* CSS

The project is intentionally simple. Do not introduce a build system or unnecessary dependencies.

The core game concept is:

> **The player must press the button exactly once to complete each level.**

The difficulty comes from figuring out **HOW to successfully press it**.

---

# 1. NON-NEGOTIABLE GAME RULES

### Every level

* Has one primary objective: **press the button**.
* Completes after **one successful button press**.
* Must NOT require repetitive clicking as the primary mechanic.
* Must NOT add arbitrary grinding, lives, scores, or timers unless explicitly specified.
* Should make the player think, experiment, observe, or react.

### Difficulty philosophy

Increase difficulty by manipulating:

* Button position
* Movement
* Timing
* Visibility
* Accessibility
* Decoys
* Environment
* Physics
* Player input
* Rules
* Combinations of previously introduced mechanics

Do not make levels difficult through meaningless repetition or random punishment.

### Puzzle quality

Every level should have a clear underlying idea.

Before implementing a level, be able to explain it in one sentence.

Example:

> "The button moves whenever the cursor gets close."

If the mechanic is confusing because of poor implementation rather than intentional puzzle design, fix the implementation.

---

# 2. LEVEL 1

Level 1 is intentionally trivial.

### Rules

* Button is visible.
* Button is accessible.
* Player presses it once.
* Existing button animation plays.
* Level immediately completes.
* Player proceeds to Level 2.

Do NOT add:

* 10 clicks
* Timer
* Lives
* Score
* Hidden mechanics
* Random behavior
* Artificial difficulty

Level 1 establishes the basic interaction.

---

# 3. UI RULES

The existing Home Page and Level 1 design are **approved and locked**.

Do not redesign or unnecessarily modify:

* Button appearance
* Button animation
* Colors
* Typography
* Layout
* Spacing
* General visual style

Reuse existing styles/components wherever possible.

Do not "improve" approved UI without explicit instruction.

The button should remain the visual focus of gameplay.

Avoid unnecessary HUD/UI clutter.

---

# 4. TECHNICAL RULES

Use the existing stack:

```text
Vue.js CDN
Vanilla JavaScript
HTML
CSS
```

Do NOT migrate to:

* Vite
* Vue CLI
* Nuxt
* React
* Angular
* TypeScript
* Another build system

Do not add libraries unless there is a clear requirement.

Keep the project lightweight.

---

# 5. CODE QUALITY

## Keep it simple

This is a small game.

Prefer:

```text
simple + readable + maintainable
```

over:

```text
abstract + clever + over-engineered
```

Avoid unnecessary:

* Design patterns
* State-management libraries
* Classes
* Abstraction layers
* Utility libraries
* Dependencies

---

# 6. GAME LOGIC VS UI

Keep gameplay logic separate from presentation.

Gameplay logic should live in JavaScript/Vue state rather than large template expressions.

Avoid:

```javascript
@click="count++; if(count === 7) completeLevel()"
```

Prefer:

```javascript
handleButtonPress() {
    // Validate interaction
    // Apply level rules
    // Complete level if successful
}
```

Vue state should represent the actual game state.

Do not use DOM manipulation as the source of truth for gameplay.

---

# 7. LEVEL ARCHITECTURE

The game must be structured so additional levels can be added without rewriting the application.

A level should conceptually define:

```text
initial state
interaction rules
success condition
failure behavior
reset behavior
cleanup
```

Avoid turning the application into one giant:

```javascript
if (level === 1) ...
else if (level === 2) ...
else if (level === 3) ...
```

Level-specific logic should remain reasonably isolated.

Adding a new level should be straightforward.

---

# 8. STATE

Vue should be the source of truth.

At minimum, support concepts equivalent to:

```javascript
{
    currentLevel,
    levelState,
    levelCompleted,
    gameCompleted
}
```

Individual levels may maintain additional state.

Do not duplicate game state between Vue and manually manipulated DOM elements.

---

# 9. RESET & CLEANUP

Every level must be resettable.

Reset must restore:

* Button position
* Visibility
* Obstacles
* Variables
* Timers
* Animations
* Temporary state

Clean up anything created by a level:

* `setTimeout`
* `setInterval`
* Event listeners
* Animation loops
* Temporary DOM elements

A previous level must never continue executing after the player leaves it.

---

# 10. INPUT

Support appropriate input methods:

* Mouse
* Touch
* Keyboard where required

Interactive controls should have:

* Hover state
* Press state
* Focus state
* Disabled state where applicable

Do not make gameplay dependent on hover alone.

---

# 11. PERSISTENCE

Use `localStorage` only for lightweight progress.

Example:

```javascript
{
    completedLevels: [1, 2, 3]
}
```

Do not build a complex save system.

Invalid or missing localStorage data must not crash the game.

---

# 12. PERFORMANCE

Keep the game lightweight.

Prefer:

* CSS animations for visual effects
* Vue state for gameplay state
* JavaScript for gameplay logic

Avoid unnecessary:

* Polling
* DOM manipulation
* Animation loops
* Layout recalculation
* Network requests
* Dependencies

---

# 13. FAILURE & FAIRNESS

Hard is good.

Broken or arbitrary is not.

When the player fails:

* Give immediate feedback.
* Allow quick retry.
* Preserve useful information learned from the attempt.

Avoid failure based purely on luck unless randomness is explicitly part of the puzzle.

The player should eventually understand why an attempt failed.

---

# 14. DO NOT INVENT FEATURES

Do not independently add:

* Lives
* Health
* Scores
* Currency
* Power-ups
* Achievements
* Leaderboards
* Accounts
* Multiplayer
* Ads
* Purchases
* Complex progression systems

unless explicitly requested.

If a major design decision is missing, ask/flag it rather than inventing a system.

---

# 15. DEVELOPMENT WORKFLOW

Before changing code:

1. Inspect the existing implementation.
2. Understand how the current UI works.
3. Identify reusable code.
4. Make the smallest necessary change.

When implementing a level:

1. Define the puzzle mechanic.
2. Define the exact successful button interaction.
3. Define failure states.
4. Implement gameplay logic.
5. Test the puzzle.
6. Add visual polish.
7. Test again.

**Gameplay first. Polish second.**

---

# 16. PRESERVE EXISTING WORK

Do not rewrite working code unnecessarily.

Do not modify unrelated pages.

Do not replace approved UI.

Do not change deployment configuration unless required.

Do not introduce unrelated refactors while implementing a level.

Keep commits/changes focused on the requested task.

---

# 17. TESTING CHECKLIST

Before declaring a level complete, verify:

### Gameplay

* [ ] Level loads correctly.
* [ ] Objective is clear.
* [ ] Puzzle can be solved.
* [ ] Successful button press completes the level.
* [ ] Level transition works.

### Failure

* [ ] Incorrect interactions behave correctly.
* [ ] Player can retry.
* [ ] No broken state remains after failure.

### Reset

* [ ] Reset restores the initial state.
* [ ] Timers/listeners are cleaned up.
* [ ] Animations do not leave stale state.

### Persistence

* [ ] Completed progress survives refresh.
* [ ] Invalid saved data does not crash the game.

### Technical

* [ ] No console errors.
* [ ] Existing Home Page still works.
* [ ] Existing levels still work.
* [ ] Desktop interaction works.
* [ ] Touch interaction works where applicable.

---

# 18. PRIORITY ORDER

When making a decision, use this priority:

1. **Fun gameplay**
2. **Correct puzzle behavior**
3. **Preserve approved visual design**
4. **Simple maintainable code**
5. **Performance**
6. **Polish**

Do not sacrifice the puzzle experience for unnecessary technical complexity.

---

# 19. THE CORE PRINCIPLE

Never lose sight of what makes the game different.

The objective is ridiculously simple:

> **PRESS THE BUTTON.**

The game becomes interesting because the player increasingly has to figure out how.

Every level should make the player think:

> **"I just need to press that damn button. How hard can it be?"**

Then make it harder.

**The button is simple. Getting to press it is the game.**
