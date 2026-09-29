# Milestones

## M1: Core functions done (2026-09-28), git tag `core-v0.1`
- All 17 core features in `FEATURES.md` are built with no UI or UX. 36 automated tests pass (`npm test`).
- Runs at `http://localhost:4321` (`npm start`) with a plain test harness and a simulated cap.
- Sources for each feature are in `REFERENCES.md`.

## M1.1: Minimal simulator UI (2026-09-28), git tag `core-v0.2`
- The test page is now a readable simulator: the cap, the patient's phone, and the caregiver's phone side by side, plus the doctor report and a setup form.
- Adds "Skip to next dose", a plain-language result after each squeeze, and which eye is still needed on both-eye doses. The caregiver's phone only shows alerts from the last 2 days.
- Checked by clicking through it in headless Chrome: 21 checks, no JS errors. 37 engine tests pass.

## M2: Designed app UI, first pass (2026-09-28), git tag `app-v0.1`
- `http://localhost:4321` now shows the real app design. The patient's phone and the caregiver's phone sit side by side, with demo controls to simulate time and squeezes. The old test harness moved to `/sim`.
- The style follows the reference Avi picked: soft violet, rounded cards, a droplet mascot whose face changes (calm, happy, worried, cheering), a journey path, and a tab bar with the cap light as the center button.
- Patient screens: an 11-step setup (welcome through pairing, with a "How Dropwise works" timeline), Today, Journey (habit path up to day 59, or a sticker book in kid mode), Cap, Messages, and Me (sharing, reminder method, doctor report). A result sheet appears after each squeeze.
- Caregiver screen: a weekly summary, today's doses, aim, compact alerts, and a one-tap heart.
- Motion is soft and short: screens fade up, setup steps slide, sheets glide, buttons press down. It's all turned off when the device has reduce motion enabled.
- Checked in headless Chrome: 30 click-through checks, no JS errors. 44 engine tests pass.

## M2.1: Calmer, nature redesign for older users (2026-09-29), git tag `app-v0.2`
- Cream, forest, and sage palette with sky blue and a sunny amber for "due". The Lexend font is built for easy reading.
- Bigger everything: 18px base text, 30px headings, 60px buttons.
- Four tabs instead of five (Today, Progress, Messages, Me). The cap's status moved into the Today card and a "My cap" section in Me.
- Today is just a greeting, one big card that answers "what do I do now?", and today's drops.
- Progress is a plant that grows with the habit (seed, sprout, seedling, growing, budding, in bloom at day 59). Kid mode shows a flower garden.
- The mascot is a dewdrop with a sprout on top. Older messages are hidden behind "Show earlier". The caregiver sees at most 2 alerts.
- 31 browser checks and 44 engine tests pass.

## M3: UI/UX polish (Avi, in progress)
- Build the designed screens on top of the core. Every screen can get its data from `GET /api/state`, which returns the patient today view, feed, week, caregiver view, cap lights, and doctor report.
- The core should not need changes for this. If a screen needs data the API doesn't return, add it to `src/core/reports.js`.

## Later
- Real Bluetooth link to the Stage 1 bench rig (swap `src/sim/cap.js` for real readings).
- Recalibrate the thresholds in `src/core/config.js` from the bench data.
- Accounts and push notifications for caregivers (right now everything runs locally).
