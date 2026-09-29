import { TIMING } from './config.js';
import { classifyReading } from './classify.js';
import { MIN, addDays, dateRange, zonedToEpoch } from './time.js';

// every scheduled dose for [from, to], windows clipped so neighbors never overlap
export function buildSlots(profile, from, to) {
  const tz = profile.timezone;
  const out = [];
  for (const med of profile.medications) {
    const raw = [];
    for (const date of dateRange(addDays(from, -1), addDays(to, 1))) {
      med.doses.forEach((dose, i) => {
        const time = zonedToEpoch(date, dose.time, tz);
        raw.push({
          id: `${med.id}:${date}#${i}`,
          medId: med.id,
          medName: med.name,
          capId: med.capId,
          date,
          timeStr: dose.time,
          time,
          eyes: [...dose.eyes],
          start: time - TIMING.earlyMin * MIN,
          end: time + TIMING.windowAfterMin * MIN,
        });
      });
    }
    raw.sort((a, b) => a.time - b.time);
    raw.forEach((s, i) => {
      const prev = raw[i - 1];
      const next = raw[i + 1];
      if (prev) s.start = Math.max(s.start, Math.floor((prev.time + s.time) / 2));
      if (next) s.end = Math.min(s.end, Math.floor((s.time + next.time) / 2));
    });
    for (const s of raw) {
      if (s.date >= from && s.date <= to && s.date >= profile.startDate) out.push(s);
    }
  }
  return out.sort((a, b) => a.time - b.time || a.medId.localeCompare(b.medId));
}

// order doesnt matter here which is the point, an unknown-eye drop can cover either eye
function isComplete(eyes, delivered) {
  const known = new Set(delivered.filter((a) => a.result.eye).map((a) => a.result.eye));
  const unknown = delivered.filter((a) => !a.result.eye).length;
  const uncovered = eyes.filter((e) => !known.has(e)).length;
  return uncovered <= unknown;
}

// same timestamp happens (fast retries, sim clock) so id breaks the tie
export const before = (a, b, key = 'occurredAt') => a[key] < b[key] || (a[key] === b[key] && a.id < b.id);

// returns the drop that finished the dose, not just the time
function firstCompleting(eyes, delivered, key) {
  const sorted = [...delivered].sort((a, b) => a[key] - b[key] || a.id - b.id);
  const acc = [];
  for (const a of sorted) {
    acc.push(a);
    if (isComplete(eyes, acc)) return a;
  }
  return null;
}

function filledEyes(eyes, delivered) {
  const known = new Set(delivered.filter((a) => a.result.eye).map((a) => a.result.eye));
  let unknown = delivered.filter((a) => !a.result.eye).length;
  return eyes.filter((e) => {
    if (known.has(e)) return true;
    if (unknown > 0) {
      unknown--;
      return true;
    }
    return false;
  });
}

export function scoreEvents(events) {
  return events.map((e) => ({ ...e, result: classifyReading(e.reading) }));
}

// view 'app' = what the phone knows (synced by now), 'cap' = what the cap itself knows
export function computeLedger({ profile, events, now, from, to, view = 'app' }) {
  const visible = events.filter((e) => (view === 'cap' ? e.occurredAt : e.receivedAt) <= now);
  const scored = scoreEvents(visible);
  const capToMed = new Map(profile.medications.map((m) => [m.capId, m.id]));
  const slots = buildSlots(profile, from, to);
  const byId = new Map(slots.map((s) => [s.id, { slot: s, attempts: [] }]));

  const noise = [];
  const offSchedule = [];
  for (const ev of scored) {
    if (ev.result.kind === 'noise') {
      noise.push(ev);
      continue;
    }
    const medId = capToMed.get(ev.capId);
    const hit = slots.find((s) => s.medId === medId && ev.occurredAt >= s.start && ev.occurredAt < s.end);
    if (hit) byId.get(hit.id).attempts.push(ev);
    else offSchedule.push(ev);
  }

  const rows = slots.map((slot) => {
    const attempts = byId.get(slot.id).attempts.sort((a, b) => a.occurredAt - b.occurredAt || a.id - b.id);
    const allDelivered = attempts.filter((a) => a.result.outcome === 'delivered');
    const wrongEye = allDelivered.filter((a) => a.result.eye && !slot.eyes.includes(a.result.eye));
    const delivered = allDelivered.filter((a) => !wrongEye.includes(a));

    const completer = firstCompleting(slot.eyes, delivered, 'occurredAt');
    const knower = firstCompleting(slot.eyes, delivered, 'receivedAt');
    const completedAt = completer?.occurredAt ?? null;
    const knewAt = knower?.receivedAt ?? null;
    const failed = attempts.filter((a) => a.result.outcome !== 'delivered');

    let status;
    if (completedAt != null) status = 'complete';
    else if (now < slot.start) status = 'upcoming';
    else if (now < slot.end) status = 'open';
    else status = delivered.length > 0 ? 'partial_missed' : 'missed';

    return {
      ...slot,
      status,
      completedAt,
      knewAt,
      knower,
      eyesDone: filledEyes(slot.eyes, delivered),
      attempts,
      extras: completer ? delivered.filter((a) => before(completer, a)) : [],
      wrongEye,
      retried: completer != null && failed.some((a) => before(a, completer)),
      failedAttempts: failed.length,
      lateSync: knewAt != null && knewAt > slot.end,
    };
  });

  return { slots: rows, noise, offSchedule };
}

export function adherence(rows) {
  const closed = rows.filter((r) => r.status === 'complete' || r.status === 'missed' || r.status === 'partial_missed');
  const done = closed.filter((r) => r.status === 'complete').length;
  return { done, due: closed.length, rate: closed.length ? done / closed.length : null };
}
