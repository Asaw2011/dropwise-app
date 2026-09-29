import { EYES } from './config.js';
import { isValidTimezone, localDate } from './time.js';

export class ValidationError extends Error {}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(msg) {
  throw new ValidationError(msg);
}

function str(v, field, max = 80) {
  if (typeof v !== 'string' || !v.trim()) fail(`${field} is required`);
  if (v.length > max) fail(`${field} is too long`);
  return v.trim();
}

// one time setup. the only thing anyone has to fill in
export function normalizeProfile(input, now) {
  if (!input || typeof input !== 'object') fail('profile must be an object');
  const timezone = input.timezone ?? 'America/New_York';
  if (!isValidTimezone(timezone)) fail(`unknown timezone ${timezone}`);

  const mode = input.mode ?? 'adult';
  if (!['adult', 'kid'].includes(mode)) fail('mode must be adult or kid');

  const reminderChannel = input.reminderChannel ?? 'push';
  if (!['push', 'call'].includes(reminderChannel)) fail('reminderChannel must be push or call');

  const startDate = input.startDate ?? localDate(now, timezone);
  if (!DATE_RE.test(startDate)) fail('startDate must be YYYY-MM-DD');

  const meds = input.medications;
  if (!Array.isArray(meds) || meds.length === 0) fail('add at least one medication');
  const capIds = new Set();
  const medications = meds.map((m, i) => {
    const name = str(m?.name, `medications[${i}].name`);
    const capId = str(m?.capId ?? `cap-${i + 1}`, `medications[${i}].capId`);
    if (capIds.has(capId)) fail(`cap ${capId} is used twice`);
    capIds.add(capId);
    if (!Array.isArray(m.doses) || m.doses.length === 0) fail(`${name} needs at least one dose time`);
    const seen = new Set();
    const doses = m.doses.map((d, j) => {
      if (!TIME_RE.test(d?.time ?? '')) fail(`${name} dose ${j + 1}: time must be HH:MM (24h)`);
      if (seen.has(d.time)) fail(`${name} has ${d.time} twice`);
      seen.add(d.time);
      const eyes = [...new Set(d.eyes ?? [])];
      if (eyes.length === 0 || !eyes.every((e) => EYES.includes(e))) fail(`${name} dose ${d.time}: eyes must be left and/or right`);
      return { time: d.time, eyes };
    });
    doses.sort((a, b) => a.time.localeCompare(b.time));
    return { id: m.id ?? `med-${i + 1}`, name, capId, doses };
  });

  const routine = input.routine ?? {};
  return {
    patientName: str(input.patientName ?? 'Patient', 'patientName'),
    mode,
    timezone,
    startDate,
    reminderChannel,
    routine: {
      anchor: routine.anchor ? str(routine.anchor, 'routine.anchor') : null,
      placement: routine.placement ? str(routine.placement, 'routine.placement') : null,
    },
    medications,
    caregivers: (input.caregivers ?? []).map((c, i) => ({ name: str(c?.name, `caregivers[${i}].name`) })),
    sharing: { paused: false, pausedAt: null, adherence: true, technique: true, alerts: true, ...(input.sharing ?? {}) },
  };
}

// the routine anchor becomes the placement suggestion, e.g. brushing teeth -> keep it by the toothbrush
export function placementHint(profile) {
  const r = profile.routine;
  if (r.placement) return `Keep the bottle ${r.placement} so you see it when you're ${r.anchor ?? 'there'}.`;
  if (r.anchor) return `Keep the bottle right where you do this: ${r.anchor}. Seeing it is the reminder.`;
  return null;
}
