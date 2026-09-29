# Dropwise App: Core Features (v0.1, core only)

Status as of 2026-09-28: every feature below is built, tested (36 automated tests), and runnable on localhost. There is no designed UI yet. The page at `http://localhost:4321` is a plain test harness for driving the simulated cap and clock.

The core idea: **the cap does the work.** The patient only puts the drop in. The app stays quiet unless something is actually wrong.

## Features in the build

| # | Feature | What it does | Code |
|---|---|---|---|
| 1 | **Automatic dose confirmation** | Each cap reading is classified as `delivered`, `missed_eye`, `unconfirmed`, or `noise`. A dose only counts when the camera and thermopile back it up. If they disagree, the dose gets no credit. Beam breaks outside 2 to 15 ms are ignored as false triggers. | `src/core/classify.js` |
| 2 | **Dose schedule and ledger** | Each scheduled dose gets a window: it opens 60 min before the scheduled time and closes 3 hours after. When two doses are close together, their windows split so no drop counts twice. Tracks each eye separately, so a both-eyes dose needs one drop per eye. Flags drops in the wrong eye and drops outside any window. | `src/core/ledger.js` |
| 3 | **Retry with full credit** | If a drop misses, the app asks for one more. A successful retry counts as a fully completed dose. | `ledger.js`, `feed.js` |
| 4 | **Aim coaching** | Gives a short tip only when something needs fixing (too far, too close, tilted, eye closed). Nothing is shown after a clean drop. | `classify.js` |
| 5 | **Routine anchor at setup** | Setup asks what the patient does right before their drops (for example, brushing teeth) and turns that into a hint about where to keep the bottle. | `src/core/profile.js` |
| 6 | **Cap glow reminder** | The cap glows at the dose time, unless the dose is already done. | `feed.js`, `reports.js` |
| 7 | **Cap "done" light** | The cap light turns green once the dose is confirmed, which answers "did I already take it?" Taking an extra drop triggers an "already done" notice. | `reports.js`, `feed.js` |
| 8 | **Escalating reminders** | Cap glow, then a phone reminder (push notification or phone call), then a caregiver alert when the dose window closes. Each step is skipped if the dose is already done. | `src/core/feed.js` |
| 9 | **Habit phases** | *Building* (first 59 days): phone reminder after 30 min, plus encouragement. *Maintaining*: the reminder waits 60 min and encouragement stops. *Supporting*: if last week's adherence drops below 80%, the extra support comes back automatically. | `src/core/habit.js` |
| 10 | **Late sync handling** | The cap stores drops while the phone is out of range. If a caregiver alert already went out and the drop later syncs, the caregiver gets a correction. Stale "try again" prompts are never sent. | `ledger.js`, `feed.js` |
| 11 | **Caregiver view** | A weekly summary of doses done and due, which doses were missed, and whether aim is improving or slipping. Alerts go out only when action is needed, and each one says what to do. | `src/core/reports.js` |
| 12 | **Patient-controlled sharing** | The patient chooses whether to share doses, aim, and alerts, or pause sharing entirely. When sharing is paused, the caregiver sees only "paused." | `engine.js`, `reports.js` |
| 13 | **One-tap cheer** | A caregiver taps a heart. The patient sees it right after their next confirmed drop. | `feed.js` |
| 14 | **Kid mode** | A celebration plus an automatic sticker count for every confirmed dose. | `feed.js` |
| 15 | **Doctor report** | Covers the last 30 days: adherence, on-time rate, missed-eye attempts, doses saved by a retry, wrong-eye drops, aim statistics, and ignored false triggers. It's labeled as research prototype data. | `reports.js` |
| 16 | **Low battery warning** | Warns once when the cap battery gets low, and warns again only after the cap has been recharged. | `feed.js` |
| 17 | **Simulated cap** | Six drop scenarios plus generated dose history, so the app runs without hardware. | `src/sim/cap.js` |

## Left out on purpose (for now)
- **Points, levels, and streaks.** The one medication gamification trial found no effect, and the research favored intrinsic motivation. These can be added later as an optional layer.
- **Recorded family messages.** They take too much effort from family. The one-tap cheer replaces them.
- **Any styling or UX.** That's the next milestone (see `MILESTONES.md`).

## Things to calibrate once hardware exists
All sensor thresholds are placeholders in `src/core/config.js` (distance, tilt, camera confidence, thermopile dip). Retune them from the Stage 1 bench data.
