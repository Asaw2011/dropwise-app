import { computeFeed } from './feed.js';
import { makePhaseLookup } from './habit.js';
import { ValidationError, normalizeProfile, placementHint } from './profile.js';
import { capIndicators, caregiverView, doctorReport, journeyStats, todayView, weeklySummary } from './reports.js';
import { addDays, localDate } from './time.js';

// holds raw data only (profile, cap events, cheers). everything else is derived on read
export class Dropwise {
  constructor(data = {}) {
    this.profile = data.profile ?? null;
    this.events = data.events ?? [];
    this.cheers = data.cheers ?? [];
    this.nextId = data.nextId ?? 1;
  }

  toJSON() {
    return { profile: this.profile, events: this.events, cheers: this.cheers, nextId: this.nextId };
  }

  requireProfile() {
    if (!this.profile) throw new ValidationError('run setup first');
    return this.profile;
  }

  setup(input, now) {
    this.profile = normalizeProfile(input, now);
    this.events = [];
    this.cheers = [];
    return this.profile;
  }

  // one reading from a cap. receivedAt > occurredAt means it sat on the cap until the phone was nearby
  ingest({ capId, reading, occurredAt, receivedAt, batteryPct }) {
    const p = this.requireProfile();
    if (!p.medications.some((m) => m.capId === capId)) throw new ValidationError(`unknown cap ${capId}`);
    if (!Number.isFinite(occurredAt)) throw new ValidationError('occurredAt must be a timestamp');
    const recv = receivedAt ?? occurredAt;
    if (!Number.isFinite(recv) || recv < occurredAt) throw new ValidationError('receivedAt cant be before occurredAt');
    if (batteryPct != null && !(batteryPct >= 0 && batteryPct <= 100)) throw new ValidationError('batteryPct must be 0 to 100');
    const ev = { id: this.nextId++, capId, reading, occurredAt, receivedAt: recv, batteryPct: batteryPct ?? null };
    this.events.push(ev);
    return ev;
  }

  cheer(from, at) {
    this.requireProfile();
    if (typeof from !== 'string' || !from.trim()) throw new ValidationError('cheer needs a sender name');
    const c = { id: this.nextId++, from: from.trim().slice(0, 40), at };
    this.cheers.push(c);
    return c;
  }

  // change settings without wiping history (kid mode, reminder method, names, routine)
  updateProfile(patch, now) {
    const p = this.requireProfile();
    const allowed = ['patientName', 'mode', 'reminderChannel', 'routine', 'caregivers'];
    for (const k of Object.keys(patch ?? {})) {
      if (!allowed.includes(k)) throw new ValidationError(`can't change ${k} here`);
    }
    const next = normalizeProfile({ ...p, ...patch }, now);
    next.sharing = p.sharing;
    this.profile = next;
    return next;
  }

  setSharing(patch, now) {
    const p = this.requireProfile();
    const allowed = ['paused', 'adherence', 'technique', 'alerts'];
    for (const [k, v] of Object.entries(patch ?? {})) {
      if (!allowed.includes(k)) throw new ValidationError(`unknown sharing setting ${k}`);
      if (typeof v !== 'boolean') throw new ValidationError(`${k} must be true or false`);
    }
    const wasPaused = p.sharing.paused;
    p.sharing = { ...p.sharing, ...patch };
    if (p.sharing.paused && !wasPaused) p.sharing.pausedAt = now;
    if (!p.sharing.paused) p.sharing.pausedAt = null;
    return p.sharing;
  }

  snapshot(now) {
    const p = this.requireProfile();
    const today = localDate(now, p.timezone);
    const phaseOn = makePhaseLookup(p, this.events);
    const feed = computeFeed({ profile: p, events: this.events, cheers: this.cheers, now, phaseOn });
    const unsynced = this.events.filter((e) => e.occurredAt <= now && e.receivedAt > now).length;
    return {
      now,
      today,
      phase: phaseOn(today),
      profile: p,
      placementHint: placementHint(p),
      caps: capIndicators(p, this.events, now),
      unsyncedEvents: unsynced,
      patient: {
        today: todayView(p, this.events, now),
        week: weeklySummary(p, this.events, now),
        stickers: p.mode === 'kid' ? feed.stickers : undefined,
        feed: feed.items.filter((i) => i.to === 'patient'),
      },
      caregiver: caregiverView(p, this.events, now, feed.items),
      journey: journeyStats(p, this.events, now),
      doctorReport: doctorReport(p, this.events, now, addDays(today, -29), today),
    };
  }
}
