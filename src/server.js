import { createServer } from 'node:http';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyReading } from './core/classify.js';
import { Dropwise } from './core/engine.js';
import { ValidationError } from './core/profile.js';
import { MIN } from './core/time.js';
import { SCENARIOS, scenarioReading, simulateHistory } from './sim/cap.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data', 'state.json');
const PORT = Number(process.env.PORT ?? 4321);

export const DEMO_PROFILE = {
  patientName: 'Grandma Rose',
  mode: 'adult',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
  reminderChannel: 'push',
  routine: { anchor: 'brushing teeth', placement: 'next to the toothbrush' },
  medications: [{ name: 'Latanoprost', capId: 'cap-1', doses: [{ time: '08:00', eyes: ['left', 'right'] }, { time: '20:00', eyes: ['left', 'right'] }] }],
  caregivers: [{ name: 'Avi' }],
};

// simulated clock so you can jump ahead instead of waiting for 8pm
let state = { now: Date.now(), app: new Dropwise() };

function save() {
  mkdirSync(dirname(DATA), { recursive: true });
  const tmp = `${DATA}.tmp`;
  writeFileSync(tmp, JSON.stringify({ now: state.now, app: state.app }, null, 2));
  renameSync(tmp, DATA);
}

function loadDemo() {
  state.app = new Dropwise();
  state.app.setup(DEMO_PROFILE, state.now);
  simulateHistory(state.app, { days: 20, adherenceRate: 0.85 }, state.now);
}

function load() {
  if (existsSync(DATA)) {
    try {
      const raw = JSON.parse(readFileSync(DATA, 'utf8'));
      state = { now: raw.now, app: new Dropwise(raw.app) };
      return;
    } catch (err) {
      console.error('state file unreadable, starting fresh with the demo:', err.message);
    }
  }
  loadDemo();
  save();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) {
        reject(new ValidationError('body too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new ValidationError('body must be JSON'));
      }
    });
    req.on('error', reject);
  });
}

function snapshot() {
  return state.app.profile ? state.app.snapshot(state.now) : { now: state.now, profile: null };
}

const routes = {
  'GET /api/state': () => snapshot(),
  'GET /api/scenarios': () => SCENARIOS,

  'POST /api/setup': (b) => {
    state.app.setup(b, state.now);
    return snapshot();
  },
  'POST /api/demo': () => {
    loadDemo();
    return snapshot();
  },
  'POST /api/history': (b) => {
    const days = Number(b.days);
    const rate = Number(b.adherenceRate ?? 0.9);
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new ValidationError('days must be 1 to 365');
    if (!(rate >= 0 && rate <= 1)) throw new ValidationError('adherenceRate must be 0 to 1');
    const profile = state.app.requireProfile();
    state.app.setup(profile, state.now);
    simulateHistory(state.app, { days, adherenceRate: rate }, state.now);
    return snapshot();
  },
  'POST /api/clock': (b) => {
    if (b.toNextDose) {
      const next = state.app.snapshot(state.now).patient.today.nextDose;
      if (!next) throw new ValidationError('no upcoming dose');
      // land a minute after it's due so the cap is already glowing
      state.now = Math.max(state.now, next.at + MIN);
    } else if (b.set != null) {
      const t = Date.parse(b.set);
      if (Number.isNaN(t)) throw new ValidationError('set must be a date string');
      state.now = t;
    } else {
      const m = Number(b.advanceMin);
      if (!Number.isFinite(m) || m < 0 || m > 60 * 24 * 60) throw new ValidationError('advanceMin must be 0 to 86400');
      state.now += m * MIN;
    }
    return snapshot();
  },
  'POST /api/drop': (b) => {
    if (!SCENARIOS[b.scenario]) throw new ValidationError(`scenario must be one of ${Object.keys(SCENARIOS).join(', ')}`);
    const delay = Number(b.syncDelayMin ?? 0);
    if (!Number.isFinite(delay) || delay < 0) throw new ValidationError('syncDelayMin must be 0 or more');
    const eye = b.eye === 'left' || b.eye === 'right' ? b.eye : null;
    const battery = b.batteryPct === '' || b.batteryPct == null ? null : Number(b.batteryPct);
    const reading = scenarioReading(b.scenario, eye);
    const ev = state.app.ingest({
      capId: b.capId ?? state.app.requireProfile().medications[0].capId,
      reading,
      occurredAt: state.now,
      receivedAt: state.now + delay * MIN,
      batteryPct: battery,
    });
    return { ...snapshot(), lastDrop: { id: ev.id, synced: delay === 0, result: classifyReading(reading) } };
  },
  'POST /api/cheer': (b) => {
    state.app.cheer(b.from ?? 'Family', state.now);
    return snapshot();
  },
  'POST /api/sharing': (b) => {
    state.app.setSharing(b, state.now);
    return snapshot();
  },
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (code, body, type = 'application/json') => {
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(type === 'application/json' ? JSON.stringify(body) : body);
  };
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      return send(200, readFileSync(join(ROOT, 'public', 'index.html')), 'text/html; charset=utf-8');
    }
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) return send(404, { error: 'not found' });
    const body = req.method === 'POST' ? await readBody(req) : {};
    const out = handler(body);
    if (req.method === 'POST') save();
    send(200, out);
  } catch (err) {
    if (err instanceof ValidationError) return send(400, { error: err.message });
    console.error(err);
    send(500, { error: 'internal error, check the server log' });
  }
});

load();
server.listen(PORT, '127.0.0.1', () => {
  console.log(`dropwise core running at http://localhost:${PORT}`);
});
