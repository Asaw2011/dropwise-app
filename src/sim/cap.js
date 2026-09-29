import { buildSlots } from '../core/ledger.js';
import { MIN, addDays, localDate } from '../core/time.js';

// fake cap readings so the app works before the hardware exists

export const SCENARIOS = {
  good: 'Clean drop, landed in the eye',
  missed_cheek: 'Held too far and tilted, drop hit the cheek',
  eye_closed: 'Blinked, eye was closed',
  unsure: 'Camera thinks it landed, thermopile disagrees',
  camera_blind: 'Camera saw nothing useful, thermopile felt the drop',
  false_trigger: 'Something blocked the beam but it was not a drop',
};

export function scenarioReading(name, eye = null) {
  const base = {
    beamBreak: { triggered: true, durationMs: 6 },
    tofMm: 20,
    tiltDeg: 5,
    camera: { landedOnEye: true, confidence: 0.92, eyeOpen: true, eye },
    thermopile: { deltaC: -0.6 },
  };
  switch (name) {
    case 'good':
      return base;
    case 'missed_cheek':
      return { ...base, tofMm: 45, tiltDeg: 30, camera: { ...base.camera, landedOnEye: false, confidence: 0.9 }, thermopile: { deltaC: 0 } };
    case 'eye_closed':
      return { ...base, camera: { ...base.camera, eyeOpen: false, landedOnEye: false }, thermopile: { deltaC: -0.1 } };
    case 'unsure':
      return { ...base, camera: { ...base.camera, confidence: 0.75 }, thermopile: { deltaC: 0 } };
    case 'camera_blind':
      return { ...base, camera: null, thermopile: { deltaC: -0.5 } };
    case 'false_trigger':
      return { ...base, beamBreak: { triggered: true, durationMs: 40 } };
    default:
      throw new Error(`unknown scenario ${name}`);
  }
}

// tiny seeded rng so history is the same every run
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// backfill past days so habit phases and reports have something to show
export function simulateHistory(app, { days, adherenceRate = 0.9, seed = 42 }, now) {
  const p = app.requireProfile();
  const today = localDate(now, p.timezone);
  p.startDate = addDays(today, -days);
  const rand = rng(seed);
  const slots = buildSlots(p, p.startDate, addDays(today, -1));
  let battery = 100;
  for (const s of slots) {
    if (rand() > adherenceRate) continue;
    const at = s.time + Math.floor(rand() * 20) * MIN;
    // some early misses so aim coaching and retries show up in the reports
    const struggling = rand() < 0.15;
    for (const eye of s.eyes) {
      battery = Math.max(20, battery - 0.3);
      if (struggling) {
        app.ingest({ capId: s.capId, reading: scenarioReading('missed_cheek', eye), occurredAt: at, receivedAt: at + MIN, batteryPct: Math.round(battery) });
      }
      const t = at + (struggling ? 2 * MIN : 0);
      app.ingest({ capId: s.capId, reading: scenarioReading('good', eye), occurredAt: t, receivedAt: t + MIN, batteryPct: Math.round(battery) });
    }
  }
  return slots.length;
}
