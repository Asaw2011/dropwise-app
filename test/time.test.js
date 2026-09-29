import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, localDate, localTime, zonedToEpoch } from '../src/core/time.js';

test('local time round trips in normal and DST days', () => {
  for (const [d, t] of [['2026-10-01', '08:00'], ['2026-03-08', '08:00'], ['2026-11-01', '08:00'], ['2026-11-01', '00:30'], ['2026-12-31', '23:59']]) {
    const ms = zonedToEpoch(d, t, 'America/New_York');
    assert.equal(localDate(ms, 'America/New_York'), d);
    assert.equal(localTime(ms, 'America/New_York'), t);
  }
});

test('date math crosses months and years', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-10-01', '2026-11-29'), 59);
});
