# Dropwise: App Design Brief

Design a mobile app called **Dropwise**. It's the companion app for a smart cap that fits on eye drop bottles. The cap uses an infrared sensor, a camera, and a heat sensor to confirm whether each eye drop actually landed in the eye. The app turns that into reminders, feedback, and peace of mind for family.

The core idea: **the cap does the work.** The patient only puts the drop in. They never tap "I took it." The app stays calm and quiet, and it speaks up only when something is actually wrong.

---

## Who uses it

There are three kinds of users, and each gets its own experience.

1. **The patient, usually an older adult (60 to 85+).** They take glaucoma drops once or twice a day. Their eyesight may be weaker, their hands may shake, and they may be new to smartphones. They want to feel capable and independent, not watched or talked down to. They use the app a few seconds a day, mostly to glance at it.
2. **The caregiver: an adult child, grandchild, or parent.** They're busy and often live elsewhere. They want to know everything is okay without checking constantly, and they want a clear next step when something goes wrong.
3. **A young child who needs drops.** A parent gives the drop, and the child is often scared or fights it. In kid mode the app becomes playful and celebratory.

A fourth person, **the eye doctor**, never uses the app but receives a one-page report from it.

---

## Design principles (based on research with older adults)

- **One main screen.** Everything important is on the Today screen. No hamburger menus and no hidden gestures.
- **Big and spaced out.** Large text by default (body text at least 17pt, key numbers 28 to 40pt), touch targets at least 48 by 48pt with generous spacing, high contrast, and support for the phone's text-size setting.
- **Every icon has a text label.** Never rely on an icon alone.
- **Calm, not needy.** Most days the app sends nothing. No badges piling up, no red dots, no streak guilt.
- **Respectful, grown-up tone.** No cartoon mascot and no confetti in adult mode. Warm and plain, the way a helpful pharmacist talks.
- **Progress means real things.** Show doses taken and improving aim, not points or levels.
- **The patient is in control.** They choose what family can see. Sharing is never hidden.
- **Kid mode is the one place for play.** Bright, friendly, and celebratory.

---

## The cap light (a key visual)

The physical cap has a small light, and the app should show the same state so the two always match:
- **Off (grey):** nothing is due.
- **Glowing (warm amber, gently pulsing):** a dose is due now.
- **Green (steady):** today's dose is done. This answers "did I already take it?"

Use this three-state light as a recurring visual throughout the app.

---

## Patient screens

### 1. Setup (done once, about 2 minutes, often by the caregiver)
Keep it to a few short steps, one question per screen:
1. "What's your name?"
2. "What drops do you take?" (medication name)
3. "When do you take them?" (time pickers, with an "add another time" option)
4. "Which eye?" Choose Left, Right, or Both, shown as large buttons with a simple eye illustration.
5. **"What do you do right before your drops?"** Offer examples as tappable chips: *brushing teeth, breakfast, bedtime, morning coffee*. The app then suggests where to keep the bottle: *"Keep the bottle next to the toothbrush so you see it when you're brushing teeth."* This step matters because tying drops to an existing routine is what builds the habit.
6. "How should we remind you?" Choose **Phone notification** or **Phone call**.
7. "Who should we tell if you miss a dose?" Add a caregiver's name. This step can be skipped.
8. Pair the cap: "Hold the cap near your phone." Show a success state with the cap light turning green.

### 2. Today (the home screen)
The most important screen. From top to bottom:
- **A large next-drop card:**
  - Label: "Next drop" or "Due now"
  - Time in large text: **8:00 PM**
  - Medication and eye: "Latanoprost, both eyes"
  - If half done: "Left eye done, right eye still needed" (amber)
  - A small matching cap-light indicator
- **Today's doses** as a short list, one row per dose. The status labels:
  - **Done at 8:04 PM** (green)
  - **Due now** (amber)
  - **Right eye still needed** (amber)
  - **Can take early** (blue, when the window is open but it's not yet time)
  - **Later** (grey)
  - **Missed** (red, gentle, not alarming)
  - Small secondary notes: "got it on a retry," "synced late"
- **One latest message** (see Messages), if there is one today.
- A small habit status chip: "Building the habit" for the first 2 months, then "Habit is set," or "Extra support is on" if they've slipped recently.

### 3. Right after a drop (instant feedback)
Squeezing the bottle is the moment that matters. Show a full-screen or large-sheet result for a few seconds:
- **Landed:** a green check, plus one line that changes with context:
  - "First dose confirmed. You're all set up."
  - "Done. Next drop at 8:00 PM."
  - "That's all of today's drops."
  - "5 doses in a row without a miss."
  - "Got it on the second try. That counts."
- **Missed the eye:** soft red or amber, never scolding. "That drop didn't land in your eye. Try one more." Below it, **one** coaching tip:
  - "Bring the bottle a bit closer, about 1 to 3 cm above your eye."
  - "Point the bottle straight down over your eye."
  - "Try to keep your eye open until the drop lands."
  - "Tilt your head back and look up before you squeeze."
  - If the same fix comes up again that day, use the short version: "Same fix as last time: bring it closer."
- **Couldn't confirm:** "Couldn't confirm that drop landed. Try one more."
- **Already done:** "This dose was already done. No need for another drop." (Prevents double dosing.)
- **A family heart waiting:** after a confirmed drop, if family sent one: "Avi sent you a heart ❤️." This should feel like a small warm surprise.

### 4. Messages
A simple list, newest first, grouped **Today** and **Earlier** (collapsed). Each item has a colored text label, a sentence, and a time. The types:
- **Reminder:** "Time for your Latanoprost drops (8:00 PM)."
- **Try again:** "That drop didn't land in your eye. Try one more."
- **Tip:** a coaching tip.
- **Done:** a contextual encouragement line.
- **Heart:** "Avi sent you a heart."
- **Battery:** "Cap battery is at 12%. Charge it soon."

### 5. My progress
- **This week:** "11 of 13 doses taken" with a simple 7-day row of dots (filled, missed, or today).
- **Aim:** "Good aim on 83% of drops, improving vs last week." Use a gentle line or bar trend. This is about getting better at a skill, which research shows motivates older adults more than points.
- Optional: the user's own reason, shown here and on Today ("To see Maya's recitals"), plus "days your vision was protected."

### 6. Sharing and privacy (patient controls)
Plain toggles with clear labels:
- **Pause all sharing** (when on, it greys out the others)
- **Which doses I took**
- **How my aim is going**
- **Alert them if I miss a dose**

Add a line underneath: "[Caregiver] can see that sharing is paused. Nothing is hidden."

### 7. Settings
Change dose times, routine, reminder method, and eye. Text size preview, cap battery, and re-pair cap.

---

## Kid mode (same data, different skin)

When the patient is a child, the patient screens change:
- A friendly character, and a short role-play animation before the drop ("Bunny gets his drops too!") to reduce fear.
- A countdown or "Ready?" moment before the parent squeezes.
- **A big celebration when the drop lands:** "You did it! Sticker #12 added."
- A **sticker book** that fills in automatically, one sticker per confirmed dose.
- Missed drops are handled gently and never framed as the child's fault.

Use bright colors, rounded shapes, and big playful type, while keeping the same layout structure.

---

## Caregiver screens

### 1. Home (people overview)
One tile per person they help (for example, Grandma Rose), each with:
- Name and cap-light state
- "This week: 11 of 13 doses"
- Today's doses as small chips: **8:00 AM Missed**, **8:00 PM Done**
- If sharing is paused: "Grandma Rose paused sharing" in a neutral tone, not alarming.

### 2. Person detail
- **This week** summary, plus which doses were missed ("Missed: Yesterday 8:00 PM, Today 8:00 AM")
- **Today** chips
- **Aim:** "Good aim on 83% of drops, steady."
- **Send a heart** button (one tap, and done). Helper text: "Shows up after their next confirmed drop."

### 3. Alerts
Only the last 2 days are shown, with "7 older alerts not shown." The types:
- **Missed dose** (red): the title "Missed dose: Today 8:00 AM." Only the newest missed alert shows the action: *"Check in with Grandma Rose. If they say they took it, the cap may need charging or to be near their phone to sync."*
- **False alarm** (green): "False alarm: Yesterday 8:00 PM was taken. The cap was out of range and synced late."
- **Battery** (amber): "Grandma Rose's cap battery is at 12%."

The caregiver should feel informed, not nagged. Most weeks they get zero alerts and a single weekly summary.

---

## Doctor report (one printable page, share or export as PDF)
Title: "Dropwise report, last 30 days" with the patient's name and medications. Show a grid of stats:
- Doses taken: 78% (32 of 41)
- Taken within an hour: 100%
- Doses saved by a retry: 6
- Drops that missed the eye: 13
- Drops we couldn't confirm: 0
- Drops in the wrong eye: 0
- Drops outside dose times: 0
- Drops with good aim: 83%
- Typical distance from eye: 20 mm
- Typical bottle tilt: 5°
- False triggers ignored: 0

Then the missed doses list, and a footer: "Research prototype data. Not a medical device and not clinically validated."

---

## Notifications (outside the app)
Keep the wording short and consistent:
- Patient reminder, about 30 min after the dose time and only if the dose isn't done: "Time for your Latanoprost drops (8:00 PM)."
- Caregiver, only when a dose window closes without the dose: "Grandma Rose hasn't taken the 8:00 PM Latanoprost dose."
- Caregiver correction: "Update: Grandma Rose did take the 8:00 PM dose at 8:40 PM. The cap synced late."

---

## Visual direction
- **Mood:** calm, trustworthy, warm, and clean. Think of a good hearing-aid or medical app, not a fitness game.
- **Colors:** a soft neutral background, one calm brand color (a clear teal or blue suggests eyes and water drops), plus status colors used consistently everywhere: green = done, amber = due or needs one more, red = missed (muted, not alarm-red), blue = info or tips.
- **Shapes:** rounded cards and big pill-shaped status labels, with plenty of white space.
- **Type:** a highly legible sans serif, large sizes, and strong weight contrast between the time or number and the label.
- **Motif:** a water drop and the three-state cap light.
- **Motion:** minimal. A gentle pulse for "due now," a soft check animation for "landed," and celebration only in kid mode. Respect the phone's reduce-motion setting.
- **Accessibility:** WCAG AA contrast or better, works at the largest text size, and every state is shown by text as well as color.

## Don't
- Don't add points, coins, levels, leaderboards, or streak-loss warnings.
- Don't use scolding or guilt language ("You missed again!").
- Don't use tiny icons without labels, or small gray text for important information.
- Don't hide the patient's privacy controls.
- Don't make any medical claims. This is a research prototype.

## Screens to produce
Patient: Setup (8 steps), Today (all dose states), Drop result sheet (landed, missed with tip, couldn't confirm, already done, heart waiting), Messages, Progress, Sharing, Settings.
Kid mode: Today, Pre-drop role-play, Celebration, Sticker book.
Caregiver: Home, Person detail, Alerts, Sharing paused state.
Doctor report page.
