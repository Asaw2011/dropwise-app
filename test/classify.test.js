import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyReading } from '../src/core/classify.js';
import { scenarioReading } from '../src/sim/cap.js';

test('clean drop with both sensors agreeing is delivered, high confidence, no tips', () => {
  const r = classifyReading(scenarioReading('good'));
  assert.equal(r.outcome, 'delivered');
  assert.equal(r.confidence, 'high');
  assert.deepEqual(r.tips, []);
});

test('beam break outside 2 to 15 ms is noise and never counts', () => {
  assert.equal(classifyReading(scenarioReading('false_trigger')).kind, 'noise');
  assert.equal(classifyReading({ beamBreak: { triggered: true, durationMs: 1 } }).kind, 'noise');
  assert.equal(classifyReading({ beamBreak: { triggered: false } }).kind, 'noise');
  assert.equal(classifyReading({}).kind, 'noise');
  assert.equal(classifyReading({ beamBreak: { triggered: true, durationMs: 2 } }).kind, 'drop');
  assert.equal(classifyReading({ beamBreak: { triggered: true, durationMs: 15 } }).kind, 'drop');
});

test('missed drop gets distance and angle tips', () => {
  const r = classifyReading(scenarioReading('missed_cheek'));
  assert.equal(r.outcome, 'missed_eye');
  assert.equal(r.aim.distance, 'too_far');
  assert.equal(r.aim.angle, 'tilted');
  assert.equal(r.tips.length, 2);
});

test('closed eye is a miss even if other sensors look fine', () => {
  const reading = scenarioReading('good');
  reading.camera.eyeOpen = false;
  const r = classifyReading(reading);
  assert.equal(r.outcome, 'missed_eye');
  assert.match(r.tips[0], /eye open/);
});

test('sensors disagreeing is unconfirmed, not free credit', () => {
  assert.equal(classifyReading(scenarioReading('unsure')).outcome, 'unconfirmed');
});

test('one confident sensor with the other blind still counts, medium confidence', () => {
  const r = classifyReading(scenarioReading('camera_blind'));
  assert.equal(r.outcome, 'delivered');
  assert.equal(r.confidence, 'medium');
});

test('both sensors blind is unconfirmed', () => {
  const r = classifyReading({ beamBreak: { triggered: true, durationMs: 5 } });
  assert.equal(r.outcome, 'unconfirmed');
});

test('low confidence camera is ignored', () => {
  const r = classifyReading({ ...scenarioReading('good'), camera: { landedOnEye: true, confidence: 0.3, eyeOpen: true }, thermopile: null });
  assert.equal(r.outcome, 'unconfirmed');
});

test('missed with good aim still gives one useful tip', () => {
  const reading = scenarioReading('missed_cheek');
  reading.tofMm = 20;
  reading.tiltDeg = 3;
  const r = classifyReading(reading);
  assert.equal(r.outcome, 'missed_eye');
  assert.equal(r.tips.length, 1);
});
