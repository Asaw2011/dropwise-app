import { TIMING } from './config.js';
import { adherence, computeLedger } from './ledger.js';
import { MIN, addDays, localDate, localTime } from './time.js';

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

function drops(ledger) {
  const fromSlots = ledger.slots.flatMap((s) => s.attempts);
  return [...fromSlots, ...ledger.offSchedule].filter((e) => e.result.kind === 'drop');
}

function aimStats(dropList) {
  const scored = dropList.filter((d) => d.result.aim.distance !== 'unknown' && d.result.aim.angle !== 'unknown');
  return {
    attempts: dropList.length,
    goodAimPct: pct(scored.filter((d) => d.result.aim.good).length, scored.length),
    medianDistanceMm: median(dropList.map((d) => d.result.aim.tofMm).filter((n) => n != null)),
    medianTiltDeg: median(dropList.map((d) => d.result.aim.tiltDeg).filter((n) => n != null).map(Math.abs)),
  };
}

function slotBrief(s, tz) {
  return { id: s.id, date: s.date, time: s.timeStr, med: s.medName, eyes: s.eyes, eyesDone: s.eyesDone, status: s.status, completedAt: s.completedAt && localTime(s.completedAt, tz), retried: s.retried, lateSync: s.lateSync };
}

// what the green/glow light on each cap is doing right now. uses cap side knowledge
export function capIndicators(profile, events, now) {
  const tz = profile.timezone;
  const today = localDate(now, tz);
  const { slots } = computeLedger({ profile, events, now, from: addDays(today, -1), to: addDays(today, 1), view: 'cap' });
  return profile.medications.map((med) => {
    const mine = slots.filter((s) => s.medId === med.id);
    const current = mine.find((s) => s.start <= now && now < s.end);
    let light = 'off';
    if (current && current.completedAt != null) light = 'green';
    else if (current && now >= current.time) light = 'glow';
    else {
      const last = mine.filter((s) => s.end <= now && s.date === today).at(-1);
      if (last?.completedAt != null) light = 'green';
    }
    const lastBattery = events
      .filter((e) => e.capId === med.capId && e.occurredAt <= now && typeof e.batteryPct === 'number')
      .sort((a, b) => a.occurredAt - b.occurredAt)
      .at(-1)?.batteryPct ?? null;
    return { capId: med.capId, med: med.name, light, batteryPct: lastBattery };
  });
}

export function todayView(profile, events, now) {
  const tz = profile.timezone;
  const today = localDate(now, tz);
  // look into tomorrow too so theres always a next dose after the last one today
  const { slots } = computeLedger({ profile, events, now, from: today, to: addDays(today, 1) });
  const todays = slots.filter((s) => s.date === today);
  const next = slots.find((s) => s.status === 'open' || s.status === 'upcoming');
  return {
    date: today,
    doses: todays.map((s) => slotBrief(s, tz)),
    nextDose: next ? { at: next.time, date: next.date, time: next.timeStr, med: next.medName, eyes: next.eyes, status: next.status } : null,
  };
}

function weekWindow(profile, events, now, endDate) {
  const ledger = computeLedger({ profile, events, now, from: addDays(endDate, -6), to: endDate });
  return { ledger, adh: adherence(ledger.slots), aim: aimStats(drops(ledger)) };
}

export function weeklySummary(profile, events, now) {
  const tz = profile.timezone;
  const today = localDate(now, tz);
  const cur = weekWindow(profile, events, now, today);
  const prev = weekWindow(profile, events, now, addDays(today, -7));
  let aimTrend = null;
  if (cur.aim.goodAimPct != null && prev.aim.goodAimPct != null) {
    const diff = cur.aim.goodAimPct - prev.aim.goodAimPct;
    aimTrend = diff >= 5 ? 'improving' : diff <= -5 ? 'slipping' : 'steady';
  }
  return {
    from: addDays(today, -6),
    to: today,
    dosesDone: cur.adh.done,
    dosesDue: cur.adh.due,
    adherencePct: pct(cur.adh.done, cur.adh.due),
    missed: cur.ledger.slots.filter((s) => s.status === 'missed' || s.status === 'partial_missed').map((s) => slotBrief(s, tz)),
    goodAimPct: cur.aim.goodAimPct,
    aimTrend,
  };
}

// caregiver only ever sees what the patient chose to share
export function caregiverView(profile, events, now, feedItems) {
  const sh = profile.sharing;
  if (sh.paused) return { patientName: profile.patientName, paused: true, pausedAt: sh.pausedAt };
  const week = weeklySummary(profile, events, now);
  const out = { patientName: profile.patientName, paused: false };
  if (sh.adherence) {
    out.adherence = { dosesDone: week.dosesDone, dosesDue: week.dosesDue, adherencePct: week.adherencePct, missed: week.missed, today: todayView(profile, events, now).doses };
  }
  if (sh.technique) out.technique = { goodAimPct: week.goodAimPct, aimTrend: week.aimTrend };
  out.notifications = feedItems.filter((i) => i.to === 'caregiver' && (sh.alerts || i.kind === 'low_battery'));
  return out;
}

export function doctorReport(profile, events, now, from, to) {
  const tz = profile.timezone;
  const ledger = computeLedger({ profile, events, now, from, to });
  const adh = adherence(ledger.slots);
  const done = ledger.slots.filter((s) => s.status === 'complete');
  const onTime = done.filter((s) => s.completedAt - s.time <= TIMING.onTimeMin * MIN);
  const all = drops(ledger);
  return {
    patientName: profile.patientName,
    medications: profile.medications.map((m) => ({ name: m.name, doses: m.doses })),
    from,
    to,
    dosesDue: adh.due,
    dosesDone: adh.done,
    adherencePct: pct(adh.done, adh.due),
    onTimePct: pct(onTime.length, done.length),
    missedEyeAttempts: all.filter((d) => d.result.outcome === 'missed_eye').length,
    unconfirmedAttempts: all.filter((d) => d.result.outcome === 'unconfirmed').length,
    dosesSavedByRetry: done.filter((s) => s.retried).length,
    wrongEyeDrops: ledger.slots.reduce((n, s) => n + s.wrongEye.length, 0),
    offScheduleDrops: ledger.offSchedule.filter((e) => e.result.outcome === 'delivered').length,
    ignoredFalseTriggers: ledger.noise.length,
    technique: aimStats(all),
    missed: ledger.slots.filter((s) => s.status === 'missed' || s.status === 'partial_missed').map((s) => slotBrief(s, tz)),
    note: 'Research prototype data. Not a medical device and not clinically validated.',
  };
}
