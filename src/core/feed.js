import { TIMING } from './config.js';
import { before, computeLedger, scoreEvents } from './ledger.js';
import { MIN, localDate, localTime } from './time.js';

// prompts older than this are stale (cap synced late), so skip them
const FRESH_MS = 10 * MIN;

function fmt12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${suffix}`;
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

  for (const s of app.slots) {
    if (s.start > now) continue;
    const when = fmt12(s.timeStr);
    const capSide = capById.get(s.id);
    const phase = phaseOn(s.date);

    // cap glows at the routine time unless it already knows the dose is done
    if (s.time <= now && !(capSide?.completedAt != null && capSide.completedAt <= s.time)) {
      push({ at: s.time, to: 'patient', channel: 'cap', kind: 'cap_glow', slotId: s.id, text: `Cap glows for the ${when} ${s.medName} dose.` });
    }

    const phoneAt = s.time + TIMING.phoneDelayMin[phase] * MIN;
    if (phoneAt <= now && phoneAt < s.end && !(s.knewAt != null && s.knewAt <= phoneAt)) {
      push({
        at: phoneAt,
        to: 'patient',
        channel: profile.reminderChannel,
        kind: 'reminder',
        slotId: s.id,
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
        slotId: s.id,
        text: `${name} hasn't taken the ${when} ${s.medName} dose.`,
        action: `Check in with ${name}. If they say they took it, the cap may need charging or to be near their phone to sync.`,
      });
      if (s.knewAt != null && s.knewAt <= now) {
        push({
          at: s.knewAt,
          to: 'caregiver',
          channel: 'push',
          kind: 'correction',
          slotId: s.id,
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
        push({ at: a.receivedAt, to: 'patient', channel: 'in_app', kind: 'retry', slotId: s.id, text });
      }
      if (a.result.tips.length > 0) {
        push({ at: a.receivedAt, to: 'patient', channel: 'in_app', kind: 'coach', slotId: s.id, text: a.result.tips.join(' ') });
      }
    }

    for (const x of s.extras) {
      if (x.receivedAt - x.occurredAt <= FRESH_MS) {
        push({ at: x.receivedAt, to: 'patient', channel: 'in_app', kind: 'already_done', slotId: s.id, text: 'This dose was already done. No need for another drop.' });
      }
    }

    if (s.knewAt != null && s.knewAt <= now) {
      if (kid) stickers++;
      const fresh = s.knewAt - s.completedAt <= FRESH_MS;
      if (fresh && kid) {
        push({ at: s.knewAt, to: 'patient', channel: 'in_app', kind: 'celebrate', slotId: s.id, text: `You did it! Sticker #${stickers} added.` });
      } else if (fresh && phase !== 'maintaining') {
        push({ at: s.knewAt, to: 'patient', channel: 'in_app', kind: 'encourage', slotId: s.id, text: s.retried ? 'Got it on the retry. Nice work.' : 'Dose confirmed. Nice work.' });
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
