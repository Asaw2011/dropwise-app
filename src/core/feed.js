import { TIMING } from './config.js';
import { SHORT_TIPS } from './classify.js';
import { before, computeLedger, scoreEvents } from './ledger.js';
import { MIN, localDate, localTime } from './time.js';

// prompts older than this are stale (cap synced late), so skip them
const FRESH_MS = 10 * MIN;

function fmt12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

const MILESTONES = new Set([3, 5, 10, 14, 21, 30]);

// picks the most useful thing to say instead of "nice work" every single time
function encouragement({ slot, streak, total, dayDone, next }) {
  if (slot.retried) return 'Got it on the second try. That counts.';
  if (total === 1) return "First dose confirmed. You're all set up.";
  if (MILESTONES.has(streak) || (streak > 30 && streak % 10 === 0)) return `${streak} doses in a row without a miss.`;
  if (dayDone) return "That's all of today's drops.";
  if (next) return `Done. Next drop at ${fmt12(next.timeStr)}.`;
  return 'Dose confirmed.';
}

// every reminder, prompt, and alert that has fired up to `now`.
// derived from data every time so it cant drift out of sync with the ledger
export function computeFeed({ profile, events, cheers, now, phaseOn }) {
  const tz = profile.timezone;
  const today = localDate(now, tz);
  const name = profile.patientName;
  const sharing = profile.sharing;
  const caregiverAlertsOn = sharing.alerts && !sharing.paused;
  const kid = profile.mode === 'kid';

  const range = { profile, events, now, from: profile.startDate, to: today };
  const app = computeLedger({ ...range, view: 'app' });
  const cap = computeLedger({ ...range, view: 'cap' });
  const capById = new Map(cap.slots.map((s) => [s.id, s]));

  const items = [];
  const push = (it) => items.push({ ...it, atLocal: `${localDate(it.at, tz)} ${localTime(it.at, tz)}` });
  let stickers = 0;
  let streak = 0;
  let total = 0;
  let lastTipKey = null;
  let lastTipDate = null;

  for (const [idx, s] of app.slots.entries()) {
    if (s.start > now) continue;
    const when = fmt12(s.timeStr);
    const capSide = capById.get(s.id);
    const slotInfo = { slotId: s.id, slotDate: s.date, slotTime: s.timeStr };
    const phase = phaseOn(s.date);

    // cap glows at the routine time unless it already knows the dose is done
    if (s.time <= now && !(capSide?.completedAt != null && capSide.completedAt <= s.time)) {
      push({ at: s.time, to: 'patient', channel: 'cap', kind: 'cap_glow', ...slotInfo, text: `Cap glows for the ${when} ${s.medName} dose.` });
    }

    const phoneAt = s.time + TIMING.phoneDelayMin[phase] * MIN;
    if (phoneAt <= now && phoneAt < s.end && !(s.knewAt != null && s.knewAt <= phoneAt)) {
      push({
        at: phoneAt,
        to: 'patient',
        channel: profile.reminderChannel,
        kind: 'reminder',
        ...slotInfo,
        text: `Time for your ${s.medName} drops (${when}).`,
      });
    }

    const alertFired = s.end <= now && !(s.knewAt != null && s.knewAt <= s.end) && caregiverAlertsOn;
    if (alertFired) {
      push({
        at: s.end,
        to: 'caregiver',
        channel: 'push',
        kind: 'missed_alert',
        ...slotInfo,
        text: `${name} hasn't taken the ${when} ${s.medName} dose.`,
        action: `Check in with ${name}. If they say they took it, the cap may need charging or to be near their phone to sync.`,
      });
      if (s.knewAt != null && s.knewAt <= now) {
        push({
          at: s.knewAt,
          to: 'caregiver',
          channel: 'push',
          kind: 'correction',
          ...slotInfo,
          text: `Update: ${name} did take the ${when} dose at ${fmt12(localTime(s.completedAt, tz))}. The cap synced late.`,
        });
      }
    }

    for (const a of s.attempts) {
      const fresh = a.receivedAt - a.occurredAt <= FRESH_MS;
      if (!fresh) continue;
      const beforeDone = s.knower == null || before(a, s.knower, 'receivedAt');
      if (a.result.outcome !== 'delivered' && beforeDone && a.receivedAt < s.end) {
        const text = a.result.outcome === 'unconfirmed'
          ? "Couldn't confirm that drop landed. Try one more."
          : "That drop didn't land in your eye. Try one more.";
        push({ at: a.receivedAt, to: 'patient', channel: 'in_app', kind: 'retry', ...slotInfo, text });
      }
      if (a.result.tips.length > 0) {
        const key = a.result.tipKeys.join('+');
        // short version only if the same fix came up earlier the same day
        const text = key === lastTipKey && s.date === lastTipDate
          ? `Same fix as last time: ${a.result.tipKeys.map((k) => SHORT_TIPS[k]).join(', ')}.`
          : a.result.tips.join(' ');
        lastTipKey = key;
        lastTipDate = s.date;
        push({ at: a.receivedAt, to: 'patient', channel: 'in_app', kind: 'coach', ...slotInfo, text });
      }
    }

    for (const x of s.extras) {
      if (x.receivedAt - x.occurredAt <= FRESH_MS) {
        push({ at: x.receivedAt, to: 'patient', channel: 'in_app', kind: 'already_done', ...slotInfo, text: 'This dose was already done. No need for another drop.' });
      }
    }

    if (s.status === 'complete') {
      streak++;
      total++;
    } else if (s.status === 'missed' || s.status === 'partial_missed') {
      streak = 0;
    }

    if (s.knewAt != null && s.knewAt <= now) {
      if (kid) stickers++;
      const fresh = s.knewAt - s.completedAt <= FRESH_MS;
      if (fresh && kid) {
        push({ at: s.knewAt, to: 'patient', channel: 'in_app', kind: 'celebrate', ...slotInfo, text: `You did it! Sticker #${stickers} added.` });
      } else if (fresh && phase !== 'maintaining') {
        const sameDay = app.slots.filter((x) => x.date === s.date);
        const dayDone = sameDay.length > 1 && sameDay.every((x) => x.status === 'complete') && sameDay.at(-1).id === s.id;
        const next = app.slots.slice(idx + 1).find((x) => x.medId === s.medId) ?? null;
        const text = encouragement({ slot: s, streak, total, dayDone, next });
        push({ at: s.knewAt, to: 'patient', channel: 'in_app', kind: 'encourage', ...slotInfo, text });
      }
    }
  }

  // cheer shows up with the next confirmed drop after it was sent
  const delivered = scoreEvents(events.filter((e) => e.receivedAt <= now))
    .filter((e) => e.result.kind === 'drop' && e.result.outcome === 'delivered')
    .sort((a, b) => a.receivedAt - b.receivedAt);
  for (const c of cheers) {
    // cheers share the id counter with events so id order breaks same-minute ties
    const hit = delivered.find((d) => d.receivedAt > c.at || (d.receivedAt === c.at && d.id > c.id));
    if (hit) push({ at: hit.receivedAt, to: 'patient', channel: 'in_app', kind: 'cheer', text: `${c.from} sent you a heart.` });
  }

  // low battery, fires once then rearms after a real charge
  const byCap = new Map();
  for (const e of [...events].filter((e) => e.receivedAt <= now && typeof e.batteryPct === 'number').sort((a, b) => a.receivedAt - b.receivedAt)) {
    const armed = byCap.get(e.capId) ?? true;
    if (armed && e.batteryPct < TIMING.lowBatteryPct) {
      push({ at: e.receivedAt, to: 'patient', channel: 'push', kind: 'low_battery', text: `Cap battery is at ${e.batteryPct}%. Charge it soon.` });
      if (!sharing.paused) push({ at: e.receivedAt, to: 'caregiver', channel: 'push', kind: 'low_battery', text: `${name}'s cap battery is at ${e.batteryPct}%.` });
      byCap.set(e.capId, false);
    } else if (!armed && e.batteryPct >= TIMING.lowBatteryPct + 10) {
      byCap.set(e.capId, true);
    }
  }

  items.sort((a, b) => a.at - b.at);
  return { items, stickers, app, cap };
}
