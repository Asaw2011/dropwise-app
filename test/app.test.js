import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN, at, drop, makeApp } from './helpers.js';
import { simulateHistory } from '../src/sim/cap.js';

const D = '2026-10-01';
const kinds = (snap, who = 'patient') => (who === 'patient' ? snap.patient.feed : snap.caregiver.notifications).map((i) => i.kind);

test('on time dose: glow, no phone reminder, no caregiver alert', () => {
  const app = makeApp();
  drop(app, 'good', at(D, '08:05'));
  const s = app.snapshot(at(D, '12:00'));
  const dose = s.patient.today.doses[0];
  assert.equal(dose.status, 'complete');
  assert.deepEqual(kinds(s), ['cap_glow', 'encourage']);
  assert.deepEqual(kinds(s, 'caregiver'), []);
});

test('dose taken before the scheduled time means the cap never glows', () => {
  const app = makeApp();
  drop(app, 'good', at(D, '07:30'));
  const s = app.snapshot(at(D, '09:00'));
  assert.equal(s.patient.today.doses[0].status, 'complete');
  assert.ok(!kinds(s).includes('cap_glow'));
});

test('forgotten dose escalates: glow, phone at +30 during habit building, caregiver at window end', () => {
  const app = makeApp();
  const s = app.snapshot(at(D, '11:30'));
  const feed = s.patient.feed.map((i) => [i.kind, i.atLocal]);
  assert.deepEqual(feed, [['cap_glow', `${D} 08:00`], ['reminder', `${D} 08:30`]]);
  assert.equal(s.patient.today.doses[0].status, 'missed');
  const alerts = s.caregiver.notifications;
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].kind, 'missed_alert');
  assert.equal(alerts[0].atLocal, `${D} 11:00`);
  assert.ok(alerts[0].action);
});

test('dose taken between glow and phone reminder cancels the phone reminder', () => {
  const app = makeApp();
  drop(app, 'good', at(D, '08:20'));
  const s = app.snapshot(at(D, '10:00'));
  assert.ok(!kinds(s).includes('reminder'));
});

test('missed eye then successful retry gets full credit and a retry prompt', () => {
  const app = makeApp();
  drop(app, 'missed_cheek', at(D, '08:02'));
  drop(app, 'good', at(D, '08:03'));
  const s = app.snapshot(at(D, '12:00'));
  const dose = s.patient.today.doses[0];
  assert.equal(dose.status, 'complete');
  assert.equal(dose.retried, true);
  assert.deepEqual(kinds(s), ['cap_glow', 'retry', 'coach', 'encourage']);
  assert.equal(s.doctorReport.dosesSavedByRetry, 1);
  assert.equal(s.doctorReport.missedEyeAttempts, 1);
});

test('miss and retry in the same minute still counts as a retry, in order', () => {
  const app = makeApp();
  const t = at(D, '08:10');
  drop(app, 'missed_cheek', t);
  app.cheer('Avi', t);
  drop(app, 'good', t);
  const s = app.snapshot(at(D, '08:11'));
  assert.equal(s.patient.today.doses[0].retried, true);
  assert.deepEqual(kinds(s), ['cap_glow', 'retry', 'coach', 'encourage', 'cheer']);
});

test('next dose rolls over to tomorrow after the last one today', () => {
  const app = makeApp();
  drop(app, 'good', at(D, '20:01'));
  const next = app.snapshot(at(D, '21:00')).patient.today.nextDose;
  assert.equal(next.date, '2026-10-02');
  assert.equal(next.time, '08:00');
  assert.equal(next.at, at('2026-10-02', '08:00'));
  assert.equal(app.snapshot(at(D, '21:00')).patient.today.doses.length, 2);
});

test('only failed attempts means missed, not complete', () => {
  const app = makeApp();
  drop(app, 'missed_cheek', at(D, '08:02'));
  drop(app, 'unsure', at(D, '08:04'));
  const s = app.snapshot(at(D, '12:00'));
  assert.equal(s.patient.today.doses[0].status, 'missed');
  assert.equal(s.doctorReport.unconfirmedAttempts, 1);
});

test('extra drop after dose is done gets an already done notice and counts once', () => {
  const app = makeApp();
  drop(app, 'good', at(D, '08:01'));
  drop(app, 'good', at(D, '08:40'));
  const s = app.snapshot(at(D, '12:00'));
  assert.ok(kinds(s).includes('already_done'));
  assert.equal(s.doctorReport.dosesDone, 1);
});

test('false triggers are ignored', () => {
  const app = makeApp();
  drop(app, 'false_trigger', at(D, '08:01'));
  const s = app.snapshot(at(D, '12:00'));
  assert.equal(s.patient.today.doses[0].status, 'missed');
  assert.equal(s.doctorReport.ignoredFalseTriggers, 1);
});

test('both eyes need a drop each, unknown eye can cover either', () => {
  const app = makeApp({ medications: [{ name: 'Timolol', capId: 'cap-1', doses: [{ time: '08:00', eyes: ['left', 'right'] }] }] });
  drop(app, 'good', at(D, '08:01'), { eye: 'left' });
  let s = app.snapshot(at(D, '08:10'));
  assert.equal(s.patient.today.doses[0].status, 'open');
  assert.deepEqual(s.patient.today.doses[0].eyesDone, ['left']);
  drop(app, 'good', at(D, '08:02'));
  s = app.snapshot(at(D, '08:10'));
  assert.equal(s.patient.today.doses[0].status, 'complete');
});

test('two drops in the same eye dont complete a both eyes dose', () => {
  const app = makeApp({ medications: [{ name: 'Timolol', capId: 'cap-1', doses: [{ time: '08:00', eyes: ['left', 'right'] }] }] });
  drop(app, 'good', at(D, '08:01'), { eye: 'left' });
  drop(app, 'good', at(D, '08:02'), { eye: 'left' });
  const s = app.snapshot(at(D, '12:00'));
  assert.equal(s.patient.today.doses[0].status, 'partial_missed');
});

test('drop in the wrong eye does not count', () => {
  const app = makeApp();
  drop(app, 'good', at(D, '08:01'), { eye: 'right' });
  const s = app.snapshot(at(D, '12:00'));
  assert.equal(s.patient.today.doses[0].status, 'missed');
  assert.equal(s.doctorReport.wrongEyeDrops, 1);
});

test('late bluetooth sync: caregiver gets alert then a correction, dose counts', () => {
  const app = makeApp();
  // cap was away from the phone, synced at 13:00
  drop(app, 'good', at(D, '08:05'), { syncDelayMin: 295 });
  const before = app.snapshot(at(D, '12:00'));
  assert.equal(before.patient.today.doses[0].status, 'missed');
  assert.equal(before.caps[0].light, 'green');
  assert.equal(before.unsyncedEvents, 1);

  const after = app.snapshot(at(D, '13:30'));
  assert.equal(after.patient.today.doses[0].status, 'complete');
  assert.equal(after.patient.today.doses[0].lateSync, true);
  assert.deepEqual(kinds(after, 'caregiver'), ['missed_alert', 'correction']);
  // no stale "try again" or encouragement hours later
  assert.ok(!kinds(after).includes('encourage'));
});

test('cap light: glow when due, green when done, off before time', () => {
  const app = makeApp();
  assert.equal(app.snapshot(at(D, '07:30')).caps[0].light, 'off');
  assert.equal(app.snapshot(at(D, '08:10')).caps[0].light, 'glow');
  drop(app, 'good', at(D, '08:15'));
  assert.equal(app.snapshot(at(D, '08:20')).caps[0].light, 'green');
  assert.equal(app.snapshot(at(D, '15:00')).caps[0].light, 'green');
  // evening window opens at 19:00 but not due yet, morning still shows green
  assert.equal(app.snapshot(at(D, '19:30')).caps[0].light, 'green');
  assert.equal(app.snapshot(at(D, '20:05')).caps[0].light, 'glow');
});

test('paused sharing hides everything from the caregiver including alerts', () => {
  const app = makeApp();
  app.setSharing({ paused: true }, at(D, '07:00'));
  const s = app.snapshot(at(D, '12:00'));
  assert.equal(s.caregiver.paused, true);
  assert.equal(s.caregiver.adherence, undefined);
  assert.equal(s.caregiver.notifications, undefined);
  app.setSharing({ paused: false }, at(D, '12:00'));
  assert.equal(app.snapshot(at(D, '12:00')).caregiver.paused, false);
});

test('patient can share adherence but keep technique private', () => {
  const app = makeApp();
  app.setSharing({ technique: false }, at(D, '07:00'));
  const s = app.snapshot(at(D, '12:00'));
  assert.ok(s.caregiver.adherence);
  assert.equal(s.caregiver.technique, undefined);
});

test('cheer shows up with the next confirmed drop, not before', () => {
  const app = makeApp();
  app.cheer('Avi', at(D, '07:00'));
  assert.ok(!kinds(app.snapshot(at(D, '07:59'))).includes('cheer'));
  drop(app, 'missed_cheek', at(D, '08:01'));
  assert.ok(!kinds(app.snapshot(at(D, '08:02'))).includes('cheer'));
  drop(app, 'good', at(D, '08:03'));
  const s = app.snapshot(at(D, '08:04'));
  const cheer = s.patient.feed.find((i) => i.kind === 'cheer');
  assert.equal(cheer.text, 'Avi sent you a heart.');
});

test('kid mode celebrates and counts stickers', () => {
  const app = makeApp({ mode: 'kid' });
  drop(app, 'good', at(D, '08:01'));
  drop(app, 'good', at(D, '20:01'));
  const s = app.snapshot(at(D, '21:00'));
  assert.equal(s.patient.stickers, 2);
  assert.equal(s.patient.feed.filter((i) => i.kind === 'celebrate').length, 2);
  assert.ok(!kinds(s).includes('encourage'));
});

test('habit phases: building first 59 days, then maintaining, then supporting after a bad week', () => {
  const app = makeApp();
  const now = at('2026-12-15', '07:00');
  simulateHistory(app, { days: 70, adherenceRate: 1 }, now);
  let s = app.snapshot(now);
  assert.equal(s.phase, 'maintaining');
  // maintaining = phone reminder waits 60 min instead of 30
  const later = at('2026-12-15', '08:45');
  s = app.snapshot(later);
  assert.ok(!s.patient.feed.some((i) => i.kind === 'reminder' && i.atLocal.startsWith('2026-12-15')));
  assert.ok(!s.patient.feed.some((i) => i.kind === 'encourage' && i.atLocal.startsWith('2026-12-15')));

  const fresh = makeApp();
  simulateHistory(fresh, { days: 10, adherenceRate: 1 }, now);
  assert.equal(fresh.snapshot(now).phase, 'building');

  const slipping = makeApp();
  simulateHistory(slipping, { days: 70, adherenceRate: 0.5, seed: 7 }, now);
  assert.equal(slipping.snapshot(now).phase, 'supporting');
});

test('weekly summary counts only closed doses', () => {
  const app = makeApp();
  drop(app, 'good', at(D, '08:01'));
  const s = app.snapshot(at(D, '12:00'));
  assert.equal(s.patient.week.dosesDue, 1);
  assert.equal(s.patient.week.dosesDone, 1);
  assert.equal(s.patient.week.adherencePct, 100);
});

test('low battery warns once and rearms after charging', () => {
  const app = makeApp();
  drop(app, 'good', at(D, '08:01'), { batteryPct: 12 });
  drop(app, 'good', at(D, '20:01'), { batteryPct: 11 });
  let s = app.snapshot(at(D, '21:00'));
  assert.equal(s.patient.feed.filter((i) => i.kind === 'low_battery').length, 1);
  drop(app, 'good', at('2026-10-02', '08:01'), { batteryPct: 95 });
  drop(app, 'good', at('2026-10-02', '20:01'), { batteryPct: 10 });
  s = app.snapshot(at('2026-10-02', '21:00'));
  assert.equal(s.patient.feed.filter((i) => i.kind === 'low_battery').length, 2);
});

test('setup rejects bad input with a clear message', () => {
  const bad = [
    { medications: [] },
    { medications: [{ name: 'X', doses: [{ time: '25:00', eyes: ['left'] }] }] },
    { medications: [{ name: 'X', doses: [{ time: '08:00', eyes: ['middle'] }] }] },
    { medications: [{ name: 'X', doses: [{ time: '08:00', eyes: ['left'] }, { time: '08:00', eyes: ['right'] }] }] },
    { timezone: 'Mars/Base', medications: [{ name: 'X', doses: [{ time: '08:00', eyes: ['left'] }] }] },
  ];
  for (const input of bad) assert.throws(() => makeApp(input), { name: 'Error' });
});

test('drop from an unknown cap is rejected', () => {
  const app = makeApp();
  assert.throws(() => drop(app, 'good', at(D, '08:00'), { capId: 'nope' }), /unknown cap/);
});

test('close dose times split the window so a drop only counts once', () => {
  const app = makeApp({ medications: [{ name: 'X', capId: 'cap-1', doses: [{ time: '08:00', eyes: ['left'] }, { time: '10:00', eyes: ['left'] }] }] });
  drop(app, 'good', at(D, '08:59'));
  let s = app.snapshot(at(D, '09:30'));
  assert.deepEqual(s.patient.today.doses.map((d) => d.status), ['complete', 'open']);
  drop(app, 'good', at(D, '09:01'));
  s = app.snapshot(at(D, '09:30'));
  assert.deepEqual(s.patient.today.doses.map((d) => d.status), ['complete', 'complete']);
});

test('state survives a save and load round trip', async () => {
  const { Dropwise } = await import('../src/core/engine.js');
  const app = makeApp();
  drop(app, 'good', at(D, '08:01'));
  app.cheer('Avi', at(D, '09:00'));
  const copy = new Dropwise(JSON.parse(JSON.stringify(app)));
  assert.deepEqual(copy.snapshot(at(D, '21:00')), app.snapshot(at(D, '21:00')));
});

