import { Dropwise } from '../src/core/engine.js';
import { scenarioReading } from '../src/sim/cap.js';
import { MIN, zonedToEpoch } from '../src/core/time.js';

export const TZ = 'America/New_York';
export const at = (date, hhmm) => zonedToEpoch(date, hhmm, TZ);

export function makeApp(overrides = {}) {
  const app = new Dropwise();
  app.setup(
    {
      patientName: 'Grandma',
      timezone: TZ,
      startDate: '2026-10-01',
      routine: { anchor: 'brushing teeth', placement: 'next to the toothbrush' },
      medications: [{ name: 'Latanoprost', capId: 'cap-1', doses: [{ time: '08:00', eyes: ['left'] }, { time: '20:00', eyes: ['left'] }] }],
      caregivers: [{ name: 'Avi' }],
      ...overrides,
    },
    at('2026-10-01', '07:00'),
  );
  return app;
}

export function drop(app, scenario, occurredAt, { eye = null, syncDelayMin = 0, capId = 'cap-1', batteryPct = 80 } = {}) {
  return app.ingest({ capId, reading: scenarioReading(scenario, eye), occurredAt, receivedAt: occurredAt + syncDelayMin * MIN, batteryPct });
}

export { MIN };
