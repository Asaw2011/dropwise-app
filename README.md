# Dropwise

Companion app for the Dropwise smart eye drop cap. It confirms drops actually land, reminds only when needed, builds the habit, and keeps family in the loop without extra work.

```
npm start    # app at http://localhost:4321, old test page at /sim
npm test
```

No dependencies. Requires Node 20 or newer.

- `FEATURES.md`: what's built
- `REFERENCES.md`: the research behind each feature
- `MILESTONES.md`: where the project is and what's next

## Layout
```
src/core/     engine, pure functions (classify, ledger, feed, habit, reports, profile, time)
src/sim/      fake cap readings and dose history
src/server.js local API plus the test page
public/app/   designed app (index.html, app.css, app.js)
public/sim.html  old test harness
test/         node:test suites
data/         local state (gitignored)
```

## API (all JSON)
| Route | Body |
|---|---|
| `GET /api/state` | returns everything the UI needs |
| `POST /api/setup` | profile (see the setup box on the test page) |
| `POST /api/drop` | `{ scenario, eye?, syncDelayMin?, batteryPct?, capId? }` |
| `POST /api/clock` | `{ advanceMin }` or `{ set: "2026-09-29T08:10" }` |
| `POST /api/cheer` | `{ from }` |
| `POST /api/profile` | `{ mode?, reminderChannel?, patientName?, routine?, caregivers? }` keeps history |
| `POST /api/sharing` | `{ paused?, adherence?, technique?, alerts? }` |
| `POST /api/demo` | resets to demo data |
| `POST /api/history` | `{ days, adherenceRate }` |

Research prototype. Not a medical device.
