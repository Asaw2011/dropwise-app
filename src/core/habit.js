import { TIMING } from './config.js';
import { adherence, computeLedger } from './ledger.js';
import { addDays, daysBetween, zonedToEpoch } from './time.js';

// building = first ~2 months while the habit forms
// maintaining = habit is there, app backs off
// supporting = slipped last week so support comes back
export function makePhaseLookup(profile, events) {
  const cache = new Map();
  return function phaseOn(date) {
    if (cache.has(date)) return cache.get(date);
    let phase;
    if (daysBetween(profile.startDate, date) < TIMING.habitBuildDays) {
      phase = 'building';
    } else {
      // judge last week using only what the app knew at the start of today
      const dayStart = zonedToEpoch(date, '00:00', profile.timezone);
      const { slots } = computeLedger({
        profile,
        events,
        now: dayStart,
        from: addDays(date, -TIMING.slipLookbackDays),
        to: addDays(date, -1),
      });
      const { rate } = adherence(slots);
      phase = rate != null && rate < TIMING.slipThreshold ? 'supporting' : 'maintaining';
    }
    cache.set(date, phase);
    return phase;
  };
}
