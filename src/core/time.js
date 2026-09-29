// everything is epoch ms, timezone only matters for turning that into a local day/time

const fmtCache = new Map();

function formatter(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidTimezone(tz) {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

export function localParts(ms, tz) {
  const out = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return { y: out.year, m: out.month, d: out.day, h: out.hour, min: out.minute, s: out.second };
}

const pad = (n) => String(n).padStart(2, '0');

export function localDate(ms, tz) {
  const p = localParts(ms, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function localTime(ms, tz) {
  const p = localParts(ms, tz);
  return `${pad(p.h)}:${pad(p.min)}`;
}

function offsetMs(ms, tz) {
  const whole = Math.floor(ms / 1000) * 1000;
  const p = localParts(whole, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - whole;
}

// local wall clock -> epoch. second pass fixes the guess near DST switches
export function zonedToEpoch(dateStr, hhmm, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - offsetMs(guess, tz);
  return guess - offsetMs(first, tz);
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export const MIN = 60000;
