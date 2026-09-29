// dropwise app ui. all data comes from /api/state, this file only draws it

const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ui = {
  S: null,
  tab: 'today',
  lastTab: null,
  ob: null,
  sheet: null,
  eye: 'left',
  eyeManual: false,
  sync: 0,
  battery: 80,
  result: 'Squeeze the bottle to see both phones react.',
  cgDrawn: false,
};

// ---------- data ----------

async function api(path, body) {
  try {
    const res = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) {
      ui.result = `Error: ${data.error}`;
      renderDev();
      return null;
    }
    ui.S = data;
    renderAll();
    return data;
  } catch {
    ui.result = "Can't reach the app server. Is npm start running?";
    renderDev();
    return null;
  }
}

// ---------- formatting ----------

const tz = () => ui.S.profile.timezone;
const fmt = (ms, opts) => new Intl.DateTimeFormat('en-US', { timeZone: tz(), ...opts }).format(ms);
const clock = (ms) => fmt(ms, { hour: 'numeric', minute: '2-digit' });
const t12 = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const eyesText = (eyes) => (eyes.length === 2 ? 'both eyes' : `${eyes[0]} eye`);
const cgName = () => ui.S.profile.caregivers[0]?.name ?? 'Family';
const first = (name) => name.split(' ')[0];

function dayName(date) {
  const S = ui.S;
  if (date === S.today) return 'Today';
  const d = new Date(`${date}T12:00:00Z`);
  const y = new Date(`${S.today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (d.getTime() === y.getTime()) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(d);
}

function whenText(ms) {
  const same = fmt(ms, { dateStyle: 'short' }) === fmt(ui.S.now, { dateStyle: 'short' });
  return same ? clock(ms) : fmt(ms, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function nowMinutes() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz(), hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(ui.S.now);
  return +parts.find((p) => p.type === 'hour').value * 60 + +parts.find((p) => p.type === 'minute').value;
}

function doseStatus(d) {
  if (d.status === 'complete') return [`Done ${d.completedAt ? t12(d.completedAt) : ''}`.trim(), 'done'];
  if (d.status === 'missed') return ['Missed', 'miss'];
  if (d.status === 'partial_missed') return ['Missed one eye', 'miss'];
  if (d.status === 'open' && d.eyesDone.length) return [`${d.eyes.find((e) => !d.eyesDone.includes(e))} eye next`, 'due'];
  if (d.status === 'open') {
    const [h, m] = d.time.split(':').map(Number);
    return nowMinutes() >= h * 60 + m ? ['Due now', 'due'] : ['Can take early', 'info'];
  }
  return ['Later', ''];
}

// ---------- art ----------

let gid = 0;
// droplet buddy. moods: happy, calm, oops, cheer
function mascot(mood = 'happy', size = 72, cls = '') {
  const id = `g${gid++}`;
  const ink = '#221c38';
  let face;
  if (mood === 'calm') {
    face = `<path d="M34 68 q6 6 12 0" stroke="${ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
            <path d="M56 68 q6 6 12 0" stroke="${ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
            <path d="M46 80 q5 4 10 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  } else if (mood === 'oops') {
    face = `<circle cx="40" cy="68" r="4.8" fill="${ink}"/><circle cx="62" cy="68" r="4.8" fill="${ink}"/>
            <path d="M33 59 l10 -4" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><path d="M69 59 l-10 -4" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
            <ellipse cx="51" cy="82" rx="4" ry="4.8" fill="${ink}"/>`;
  } else {
    face = `<circle cx="40" cy="68" r="5" fill="${ink}"/><circle cx="62" cy="68" r="5" fill="${ink}"/>
            <circle cx="41.8" cy="66.2" r="1.7" fill="#fff"/><circle cx="63.8" cy="66.2" r="1.7" fill="#fff"/>
            <path d="M44 79 q7 ${mood === 'cheer' ? 9 : 7} 14 0" stroke="${ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  }
  const sparkles = mood === 'cheer'
    ? `<path d="M10 20 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#f7c948"/><path d="M92 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#f7c948"/>`
    : '';
  return `<svg class="${cls}" width="${size}" height="${size * 1.08}" viewBox="0 0 102 110" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c7b8f7"/><stop offset="1" stop-color="#9579ec"/></linearGradient></defs>
    ${sparkles}
    <path d="M51 6 C51 6 15 49 15 72 A36 36 0 0 0 87 72 C87 49 51 6 51 6 Z" fill="url(#${id})"/>
    <ellipse cx="36" cy="46" rx="6" ry="10" fill="#fff" opacity=".45" transform="rotate(25 36 46)"/>
    <ellipse cx="30" cy="78" rx="6" ry="3.6" fill="#ff9fc0" opacity=".6"/><ellipse cx="72" cy="78" rx="6" ry="3.6" fill="#ff9fc0" opacity=".6"/>
    ${face}
  </svg>`;
}

function capArt(light, size = 120) {
  const color = { off: '#cfcad9', glow: '#f5a524', green: '#34c77b' }[light];
  const halo = light === 'off' ? '' : `<circle cx="60" cy="30" r="26" fill="${color}" opacity=".25" class="${light === 'glow' ? 'halo' : ''}"/>`;
  return `<svg width="${size}" height="${size * 1.5}" viewBox="0 0 120 180" aria-hidden="true">
    ${halo}
    <rect x="34" y="18" width="52" height="46" rx="14" fill="#6246ea"/>
    <circle cx="60" cy="30" r="9" fill="${color}"/>
    <rect x="48" y="64" width="24" height="16" rx="4" fill="#e0d3f2"/>
    <rect x="26" y="80" width="68" height="92" rx="20" fill="#fff" stroke="#e0d3f2" stroke-width="3"/>
    <rect x="38" y="104" width="44" height="40" rx="8" fill="#efe7f8"/>
  </svg>`;
}

const ICON = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  journey: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>',
  messages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  drop: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2s-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13z" fill="#2ec27e"/></svg>',
  pin: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6246ea" stroke-width="2.2" stroke-linecap="round"><path d="M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
  status: '<svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.5" y="5" width="3" height="6" rx="1"/><rect x="9" y="2.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg><svg width="25" height="12" viewBox="0 0 25 12"><rect x=".5" y=".5" width="21" height="11" rx="3" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor"/><rect x="23" y="4" width="1.6" height="4" rx=".8" fill="currentColor" opacity=".4"/></svg>',
};

const MSG = {
  reminder: ['Reminder', 'due'], retry: ['Try again', 'miss'], coach: ['Tip', 'info'], already_done: ['Already done', 'info'],
  encourage: ['Done', 'done'], celebrate: ['Yay!', 'done'], cheer: ['Heart', 'done'], low_battery: ['Battery', 'due'],
};

// ---------- patient: shared bits ----------

function statusbar() {
  return `<span>${ui.S?.profile ? clock(ui.S.now).replace(/ [AP]M/, '') : ''}</span><span class="icons">${ICON.status}</span>`;
}

function topbar() {
  const { journey: j, phase, profile: p } = ui.S;
  const day = Math.min(j.daysIn, j.habitDays);
  const label = phase === 'building' ? `Habit day ${day} of ${j.habitDays}`
    : phase === 'maintaining' ? '✓ Habit is set' : 'Extra support is on';
  const pct = phase === 'building' ? Math.round((day / j.habitDays) * 100) : 100;
  return `<div class="topbar">
    <div class="progress-pill"><div class="t ${phase === 'maintaining' ? 'ok' : ''}" ${phase === 'maintaining' ? 'style="color:var(--mint-600)"' : ''}>${esc(label)}</div><div class="bar"><i style="width:${pct}%"></i></div></div>
    <div class="counter" title="Doses in a row" aria-label="${j.streak} doses in a row">${ICON.drop}${j.streak}</div>
    <div class="avatar" aria-hidden="true">${esc(p.patientName.charAt(0))}</div>
  </div>`;
}

function todaysMessages() {
  return ui.S.patient.feed.filter((i) => i.channel !== 'cap' && i.atLocal.startsWith(ui.S.today)).reverse();
}

function msgCard(i) {
  const [label, cls] = MSG[i.kind] ?? [i.kind, ''];
  const via = i.channel === 'call' ? ' (phone call)' : '';
  const good = ['encourage', 'celebrate', 'cheer'].includes(i.kind);
  return `<div class="card msg ${good ? 'good' : ''}"><span class="pill ${cls}">${esc(label)}</span><span class="text">${esc(i.text + via)}</span><span class="at">${esc(whenText(i.at))}</span></div>`;
}

// ---------- patient: tabs ----------

const views = {
  today() {
    const S = ui.S;
    const p = S.profile;
    const kid = p.mode === 'kid';
    const t = S.patient.today;
    const next = t.nextDose;
    const due = next && next.at <= S.now;
    const dueDose = due ? t.doses.find((d) => d.time === next.time && d.date === next.date) : null;
    const half = dueDose && dueDose.eyesDone.length > 0 && dueDose.eyesDone.length < dueDose.eyes.length;
    const allDoneToday = t.doses.length > 0 && t.doses.every((d) => d.status === 'complete');

    let say;
    let mood = 'calm';
    if (due && half) { say = 'One eye done. One to go.'; mood = 'happy'; }
    else if (due) { say = kid ? 'Drop time! You can do it.' : "It's time. Your cap is glowing."; mood = 'happy'; }
    else if (allDoneToday) { say = kid ? 'All done today. Great job!' : 'All done for today. See you tomorrow.'; mood = kid ? 'cheer' : 'happy'; }
    else if (next) say = `Next drop at ${t12(next.time)}${next.date !== S.today ? ' tomorrow' : ''}. The cap will glow.`;
    else say = 'Nothing scheduled.';

    const light = S.caps[0].light;
    const hero = next ? `<div class="hero">
        <div class="cap-mini"><span class="light ${light}" style="width:16px;height:16px"></span>cap</div>
        <div class="label">${due ? (kid ? 'Drop time' : 'Due now') : 'Next drop'}</div>
        <div class="time">${esc(t12(next.time))}${next.date !== S.today ? '<span style="font-size:18px;font-weight:700;opacity:.8"> tomorrow</span>' : ''}</div>
        <div class="what">${esc(next.med)}, ${esc(eyesText(next.eyes))}</div>
        ${half ? `<div class="half">${esc(dueDose.eyesDone.join(' and '))} eye done. Now the ${esc(dueDose.eyes.find((e) => !dueDose.eyesDone.includes(e)))} eye.</div>` : ''}
      </div>` : '';

    const doses = t.doses.map((d) => {
      const [label, cls] = doseStatus(d);
      const note = [d.retried && 'got it on a retry', d.lateSync && 'synced late'].filter(Boolean).join(', ');
      return `<div class="dose"><div class="when">${esc(t12(d.time))}</div><div class="eyes">${esc(eyesText(d.eyes))}${note ? `<div class="note">${esc(note)}</div>` : ''}</div><span class="pill ${cls}">${esc(label)}</span></div>`;
    }).join('');

    const latest = todaysMessages()[0];
    return `${topbar()}
      <div class="bubble-row">${mascot(mood, kid ? 80 : 58, 'float')}<div class="bubble">${esc(say)}</div></div>
      ${hero}
      <div><h2>Today</h2>${doses || '<div class="card sub">No doses today.</div>'}</div>
      ${latest ? `<div><h2>Latest</h2>${msgCard(latest)}</div>` : ''}
      ${S.placementHint ? `<div class="card" style="display:flex;gap:12px;align-items:center;margin-top:18px">${ICON.pin}<span class="small" style="font-weight:700">${esc(S.placementHint)}</span></div>` : ''}`;
  },

  journey() {
    const S = ui.S;
    if (S.profile.mode === 'kid') return stickerBook();
    const j = S.journey;
    const marks = [[1, 'First day', 'Getting started'], [3, 'Day 3', 'Finding the rhythm'], [7, 'One week', 'A real routine'], [14, 'Two weeks', 'Getting easier'], [30, 'One month', 'Mostly automatic'], [45, 'Day 45', 'Almost there'], [59, 'Day 59', 'Habit set']];
    const xs = [50, 30, 62, 34, 60, 32, 52];
    const current = marks.findIndex(([d]) => j.daysIn < d);
    const rowH = 92;
    const h = marks.length * rowH + 20;
    const pts = xs.map((x, i) => `${x},${i * rowH + 55}`).join(' ');
    const nodes = marks.map(([d, title, sub], i) => {
      const done = j.daysIn >= d;
      const isCur = i === current;
      const x = xs[i];
      const labelLeft = x < 45;
      const label = `<div class="node-label" style="${labelLeft ? `left:calc(${x}% + 44px)` : `right:calc(${100 - x}% + 44px)`}">${esc(title)}<span>${esc(sub)}</span></div>`;
      // buddy sits on the side away from the label
      const buddy = isCur ? `<div class="float" style="position:absolute;top:6px;left:calc(${x}% ${labelLeft ? '- 96px' : '+ 42px'})">${mascot('happy', 50)}</div>` : '';
      return `<div class="node-row"><div class="node ${done ? 'done' : ''} ${isCur ? 'current' : ''}" style="left:calc(${x}% - 33px)" aria-label="${esc(title)}${done ? ', reached' : ''}">${done ? '✓' : i + 1}</div>${label}${buddy}</div>`;
    }).join('');
    const aim = S.patient.week.goodAimPct;
    return `${topbar()}
      <h1>Your habit path</h1>
      <p class="sub" style="margin-top:0">${S.phase === 'building' ? 'Every day the cap confirms a drop, the habit gets stronger.' : S.phase === 'maintaining' ? "You made it. Drops are part of your routine now, so we'll stay quiet." : "Last week was harder, so reminders are back on for a bit."}</p>
      <div class="journey">
        <svg class="path" viewBox="0 0 100 ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="2 9" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
        ${nodes}
      </div>
      <div><h2>So far</h2><div class="stats">
        <div class="stat mint"><b>${j.confirmed}</b><span>drops confirmed</span></div>
        <div class="stat"><b>${j.streak}</b><span>doses in a row</span></div>
        <div class="stat"><b>${aim != null ? `${aim}%` : '-'}</b><span>good aim this week</span></div>
        <div class="stat"><b>${j.daysIn}</b><span>days with Dropwise</span></div>
      </div></div>
      <p class="small sub" style="margin-top:14px">Why 59 days? In a study of new daily habits, it took a median of 59 days for them to feel automatic.</p>`;
  },

  cap() {
    const S = ui.S;
    const c = S.caps[0];
    const label = { glow: 'Glowing. A dose is due.', green: 'Green. Your dose is done.', off: 'Off. Nothing is due right now.' }[c.light];
    const done = S.patient.today.doses.filter((d) => d.completedAt).at(-1);
    return `<h1 style="margin-top:8px">Your cap</h1>
      <div class="card" style="text-align:center;padding:22px 16px">
        <div class="pop">${capArt(c.light, 110)}</div>
        <div style="font-size:21px;font-weight:800;margin-top:6px">${esc(label)}</div>
        <div class="sub small" style="margin-top:6px">${esc(c.med)} · Battery ${c.batteryPct ?? '?'}%</div>
        <div class="small" style="margin-top:6px;font-weight:700;color:${S.unsyncedEvents ? 'var(--due)' : 'var(--done)'}">${S.unsyncedEvents ? `${S.unsyncedEvents} drop${S.unsyncedEvents > 1 ? 's' : ''} waiting to sync. Bring the cap near your phone.` : 'Connected and synced'}</div>
      </div>
      ${done ? `<div class="card"><b>Last confirmed drop</b><div class="sub">${esc(t12(done.completedAt))} today</div></div>` : ''}
      <div><h2>What the light means</h2>
        <div class="card">
          <div class="row"><span class="light" style="width:20px;height:20px;flex:none"></span><div class="l" style="flex:1">Off<small>Nothing is due</small></div></div>
          <div class="row"><span class="light glow" style="width:20px;height:20px;flex:none"></span><div class="l" style="flex:1">Glowing<small>Time for your drops</small></div></div>
          <div class="row"><span class="light green" style="width:20px;height:20px;flex:none"></span><div class="l" style="flex:1">Green<small>Done. No need for another drop.</small></div></div>
        </div>
      </div>
      ${S.placementHint ? `<div class="card" style="display:flex;gap:12px;align-items:center;margin-top:12px">${ICON.pin}<span class="small" style="font-weight:700">${esc(S.placementHint)}</span></div>` : ''}`;
  },

  messages() {
    const all = ui.S.patient.feed.filter((i) => i.channel !== 'cap');
    const today = todaysMessages();
    const earlier = all.filter((i) => !i.atLocal.startsWith(ui.S.today)).slice(-12).reverse();
    return `<h1 style="margin-top:8px">Messages</h1>
      ${today.length ? `<div><div class="group-label">Today</div>${today.map(msgCard).join('')}</div>`
        : `<div class="card" style="display:flex;gap:12px;align-items:center">${mascot('calm', 48)}<span style="font-weight:700">Nothing yet today. Quiet is good.</span></div>`}
      ${earlier.length ? `<div><div class="group-label">Earlier</div>${earlier.map(msgCard).join('')}</div>` : ''}`;
  },

  me() {
    const S = ui.S;
    const p = S.profile;
    const sh = p.sharing;
    const med = p.medications[0];
    const sw = (k, label, sub) => `<div class="row"><div class="l">${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</div><button class="switch" role="switch" aria-checked="${!!sh[k]}" aria-label="${esc(label)}" data-act="share" data-k="${k}" ${k !== 'paused' && sh.paused ? 'disabled' : ''}></button></div>`;
    return `<div class="card" style="display:flex;gap:14px;align-items:center;margin-top:8px">
        <div class="avatar" style="width:56px;height:56px;font-size:22px;background:var(--lav-100);box-shadow:none">${esc(p.patientName.charAt(0))}</div>
        <div><div style="font-size:21px;font-weight:800">${esc(p.patientName)}</div><div class="sub small">${esc(med.name)} · ${esc(med.doses.map((d) => t12(d.time)).join(' and '))}</div></div>
      </div>
      <div><h2>What ${esc(first(cgName()))} can see</h2><div class="card" style="padding:4px 16px">
        ${sw('paused', 'Pause all sharing', sh.paused ? `${first(cgName())} sees that sharing is paused` : null)}
        ${sw('adherence', 'Which doses I took')}
        ${sw('technique', 'How my aim is going')}
        ${sw('alerts', 'Tell them if I miss a dose')}
      </div></div>
      <div><h2>If I forget, remind me by</h2><div class="seg">
        <button aria-pressed="${p.reminderChannel === 'push'}" data-act="channel" data-v="push">Notification</button>
        <button aria-pressed="${p.reminderChannel === 'call'}" data-act="channel" data-v="call">Phone call</button>
      </div></div>
      <div><h2>For my eye doctor</h2><button class="btn soft" data-act="report">See my 30 day report</button></div>
      <div style="margin-top:12px"><button class="btn ghost" data-act="edit-setup">Change my setup</button></div>
      <p class="small sub" style="text-align:center">Research prototype. Not a medical device.</p>`;
  },
};

function stickerBook() {
  const n = ui.S.patient.stickers ?? 0;
  const total = Math.max(20, Math.ceil((n + 1) / 4) * 4);
  const colors = ['#f7c948', '#ff9fc0', '#7fd1ae', '#8fb3ff', '#c9a7ff'];
  const cells = Array.from({ length: total }, (_, i) => i < n
    ? `<div class="sticker ${i === n - 1 ? 'pop' : ''}"><svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" fill="${colors[i % colors.length]}"/></svg></div>`
    : '<div class="sticker empty"></div>').join('');
  return `${topbar()}
    <div class="bubble-row">${mascot('cheer', 70, 'float')}<div class="bubble">${n ? `${n} sticker${n > 1 ? 's' : ''}! Every drop adds one.` : 'Your first drop gets your first sticker!'}</div></div>
    <h1>Sticker book</h1>
    <div class="stickers">${cells}</div>`;
}

function tabbar() {
  const t = (k, label) => `<button class="tab ${ui.tab === k ? 'on' : ''}" data-act="tab" data-v="${k}" aria-current="${ui.tab === k}">${ICON[k]}${label}</button>`;
  const light = ui.S.caps[0].light;
  return `<nav class="tabbar" aria-label="Main">
    ${t('today', 'Today')}${t('journey', ui.S.profile.mode === 'kid' ? 'Stickers' : 'Journey')}
    <button class="tab center ${ui.tab === 'cap' ? 'on' : ''}" data-act="tab" data-v="cap" aria-label="Cap, light is ${light}"><span class="disc"><span class="light ${light}" style="width:22px;height:22px;border:3px solid #fff"></span></span>Cap</button>
    ${t('messages', 'Messages')}${t('me', 'Me')}
  </nav>`;
}

// ---------- patient: sheets ----------

function openDropSheet(d) {
  const S = ui.S;
  const kid = S.profile.mode === 'kid';
  const fresh = S.patient.feed.filter((i) => i.at === S.now && i.channel !== 'cap');
  const get = (k) => fresh.find((i) => i.kind === k);
  const r = d.result;
  let sheet;
  if (r.kind === 'noise') {
    sheet = { mood: 'calm', title: "That wasn't a drop", body: "Something crossed the sensor, but it wasn't a drop. Nothing was counted." };
  } else if (get('already_done')) {
    sheet = { mood: 'happy', title: 'Already done', body: get('already_done').text };
  } else if (r.outcome === 'delivered') {
    const pending = S.patient.today.doses.find((x) => x.status === 'open' && x.eyesDone.length && x.eyesDone.length < x.eyes.length);
    const body = pending ? `One down. Now your ${pending.eyes.find((e) => !pending.eyesDone.includes(e))} eye.`
      : (get('celebrate') ?? get('encourage'))?.text ?? 'Dose confirmed.';
    sheet = { mood: kid ? 'cheer' : 'happy', title: kid ? 'You did it!' : 'It landed', body, ok: true };
  } else {
    sheet = {
      mood: 'oops',
      title: r.outcome === 'unconfirmed' ? "Couldn't confirm that one" : 'Almost. Try one more',
      body: get('retry')?.text ?? 'Try one more drop.',
      tip: get('coach')?.text,
    };
  }
  const cheer = get('cheer');
  if (cheer) sheet.extra = `❤️ ${cheer.text}`;
  ui.sheet = sheet;
  renderSheet();
}

function openReportSheet() {
  const r = ui.S.doctorReport;
  const t = r.technique;
  const stat = (v, l) => `<div class="stat" style="text-align:left"><b>${esc(v ?? '-')}</b><span>${esc(l)}</span></div>`;
  ui.sheet = {
    report: true,
    html: `<h1>30 day report</h1><p class="sub small" style="margin-top:0">For ${esc(r.patientName)}'s eye doctor</p>
      <div class="stats">
        ${stat(r.adherencePct != null ? `${r.adherencePct}%` : null, `doses taken (${r.dosesDone} of ${r.dosesDue})`)}
        ${stat(r.onTimePct != null ? `${r.onTimePct}%` : null, 'within an hour')}
        ${stat(r.dosesSavedByRetry, 'saved by a retry')}
        ${stat(r.missedEyeAttempts, 'drops missed the eye')}
        ${stat(t.goodAimPct != null ? `${t.goodAimPct}%` : null, 'good aim')}
        ${stat(t.medianDistanceMm != null ? `${t.medianDistanceMm} mm` : null, 'typical distance')}
        ${stat(r.wrongEyeDrops, 'wrong eye')}
        ${stat(r.ignoredFalseTriggers, 'false triggers ignored')}
      </div>
      <p class="small sub">${r.missed.length ? `${r.missed.length} missed doses. Most recent: ${esc(r.missed.slice(-3).reverse().map((m) => `${dayName(m.date)} ${t12(m.time)}`).join(', '))}` : 'No missed doses.'}</p>
      <p class="small sub">${esc(r.note)}</p>`,
  };
  renderSheet();
}

function renderSheet() {
  const box = $('#pSheet');
  const s = ui.sheet;
  if (!s) { box.innerHTML = ''; return; }
  const inner = s.report ? s.html : `
    <div class="pop mascot-wrap ${s.ok ? 'ok' : ''}">${mascot(s.mood, 96, s.ok ? 'breathe' : '')}${s.ok ? '<span class="badge-ok" aria-hidden="true">✓</span>' : ''}</div>
    <h1>${esc(s.title)}</h1>
    <p style="font-weight:700;font-size:18px;margin:0 0 6px">${esc(s.body)}</p>
    ${s.tip ? `<div class="tip">💡 ${esc(s.tip)}</div>` : ''}
    ${s.extra ? `<div class="extra">${esc(s.extra)}</div>` : ''}`;
  box.innerHTML = `<div class="scrim" data-act="close-sheet" data-self="1"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(s.title ?? 'Report')}"><div class="grab"></div>${inner}<button class="btn primary" style="margin-top:14px" data-act="close-sheet">${s.report ? 'Done' : 'Got it'}</button></div></div>`;
  box.querySelector('.sheet .btn').focus({ preventScroll: true });
}

function closeSheet() {
  const scrim = $('#pSheet .scrim');
  if (!scrim) return;
  scrim.classList.add('closing');
  setTimeout(() => { ui.sheet = null; renderSheet(); }, 220);
}

function toast(where, text) {
  const box = $(where);
  box.innerHTML = `<div class="toast">${esc(text)}</div>`;
  clearTimeout(toast[where]);
  toast[where] = setTimeout(() => {
    box.firstChild?.classList.add('out');
    setTimeout(() => (box.innerHTML = ''), 260);
  }, 2200);
}

// ---------- patient: onboarding ----------

const PLACES = { 'brushing teeth': 'next to the toothbrush', breakfast: 'on the kitchen table', bedtime: 'on your nightstand', 'morning coffee': 'next to the coffee maker' };
const STEPS = ['welcome', 'name', 'who', 'med', 'times', 'eye', 'routine', 'remind', 'family', 'how', 'pair'];

function startOnboarding(prefill) {
  const p = prefill ? ui.S.profile : null;
  const med = p?.medications[0];
  ui.ob = {
    step: 0,
    dir: 'fwd',
    paired: false,
    data: {
      name: p?.patientName ?? '',
      who: p?.mode === 'kid' ? 'child' : 'me',
      med: med?.name ?? '',
      times: med ? med.doses.map((d) => d.time) : ['08:00', '20:00'],
      eye: med ? (med.doses[0].eyes.length === 2 ? 'both' : med.doses[0].eyes[0]) : 'both',
      anchor: p?.routine.anchor ?? '',
      placement: p?.routine.placement ?? '',
      channel: p?.reminderChannel ?? 'push',
      cg: p?.caregivers[0]?.name ?? '',
    },
  };
  if (prefill) ui.ob.step = 1;
  ui.sheet = null;
  renderSheet();
  renderPatient();
}

function obValid() {
  const d = ui.ob.data;
  const step = STEPS[ui.ob.step];
  if (step === 'name') return d.name.trim().length > 0;
  if (step === 'med') return d.med.trim().length > 0;
  if (step === 'times') return d.times.length > 0 && d.times.every((t) => /^\d{2}:\d{2}$/.test(t)) && new Set(d.times).size === d.times.length;
  if (step === 'pair') return ui.ob.paired;
  return true;
}

function obView() {
  const { step, data: d } = ui.ob;
  const name = STEPS[step];
  const kid = d.who === 'child';
  const you = kid ? 'they' : 'you';
  const pct = Math.round((step / (STEPS.length - 1)) * 100);
  const top = `<div class="ob-top"><button class="back" data-act="ob-back" aria-label="Back">‹</button><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  const next = (label = 'Continue') => `<button class="btn primary" data-act="ob-next" ${obValid() ? '' : 'disabled'}>${label}</button>`;
  const choice = (k, v, title, sub) => `<button class="choice" data-act="ob-set" data-k="${k}" data-v="${esc(v)}" aria-pressed="${d[k] === v}"><div>${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</div></button>`;

  switch (name) {
    case 'welcome':
      return `<div class="ob welcome ${ui.ob.dir}">
        <div class="grow"></div>
        <div class="breathe" style="display:grid;place-items:center">${mascot('calm', 120)}</div>
        <div class="wordmark" style="margin-top:22px">drop<span class="wise">wise</span></div>
        <p style="font-size:20px;font-weight:700;margin:6px 0 0">Every drop, confirmed.</p>
        <p class="sub" style="margin:8px 16px 0">The cap checks each drop lands in your eye, so you never have to wonder.</p>
        <div class="grow"></div>
        <button class="btn primary" data-act="ob-next">Get started</button>
        <button class="btn soft" style="margin-top:10px" data-act="ob-exit">I already use Dropwise</button>
      </div>`;
    case 'name':
      return `<div class="ob ${ui.ob.dir}">${top}<div class="q">What's your name?</div><p class="sub">Or the name of the person the drops are for.</p>
        <input class="field" data-ob="name" value="${esc(d.name)}" placeholder="Name" autocomplete="off" maxlength="40"><div class="grow"></div>${next()}</div>`;
    case 'who':
      return `<div class="ob ${ui.ob.dir}">${top}<div class="q">Who are the drops for?</div>
        ${choice('who', 'me', 'Me', 'I put my own drops in')}${choice('who', 'child', 'My child', 'A parent helps. Kid mode adds stickers and cheers.')}
        <div class="grow"></div>${next()}</div>`;
    case 'med':
      return `<div class="ob ${ui.ob.dir}">${top}<div class="q">Which drops do ${you} take?</div><p class="sub">It's on the bottle label.</p>
        <input class="field" data-ob="med" value="${esc(d.med)}" placeholder="Medication name" autocomplete="off" maxlength="60">
        <div class="chips">${['Latanoprost', 'Timolol', 'Dorzolamide', 'Brimonidine'].map((m) => `<button class="chip" data-act="ob-set" data-k="med" data-v="${m}" aria-pressed="${d.med === m}">${m}</button>`).join('')}</div>
        <div class="grow"></div>${next()}</div>`;
    case 'times':
      return `<div class="ob ${ui.ob.dir}">${top}<div class="q">When do ${you} take them?</div><p class="sub">Use the times your doctor gave ${kid ? 'them' : 'you'}.</p>
        ${d.times.map((t, i) => `<div class="time-row"><input class="field" type="time" data-ob-time="${i}" value="${esc(t)}" aria-label="Dose time ${i + 1}">${d.times.length > 1 ? `<button class="icon-btn" data-act="ob-rm-time" data-v="${i}" aria-label="Remove this time">−</button>` : ''}</div>`).join('')}
        ${d.times.length < 4 ? '<button class="btn soft" style="margin-top:12px" data-act="ob-add-time">+ Add a time</button>' : ''}
        <div class="grow"></div>${next()}</div>`;
    case 'eye':
      return `<div class="ob ${ui.ob.dir}">${top}<div class="q">Which eye?</div>
        ${choice('eye', 'left', 'Left eye')}${choice('eye', 'right', 'Right eye')}${choice('eye', 'both', 'Both eyes', 'One drop in each')}
        <div class="grow"></div>${next()}</div>`;
    case 'routine':
      return `<div class="ob ${ui.ob.dir}">${top}<div class="q">What do ${you} do right before ${kid ? 'their' : 'your'} drops?</div>
        <p class="sub">Pairing drops with something ${you} already do every day is the easiest way to never forget.</p>
        <div class="chips">${Object.keys(PLACES).map((a) => `<button class="chip" data-act="ob-anchor" data-v="${a}" aria-pressed="${d.anchor === a}">${a}</button>`).join('')}</div>
        <input class="field" style="margin-top:12px" data-ob="anchor" value="${esc(d.anchor)}" placeholder="Or type your own" maxlength="60">
        ${d.anchor ? `<div class="card" style="margin-top:14px;display:flex;gap:12px;align-items:center">${ICON.pin}<div><b>Keep the bottle</b><input class="field" style="margin-top:6px;min-height:46px;font-size:17px" data-ob="placement" value="${esc(d.placement)}" maxlength="60"></div></div>` : ''}
        <div class="grow"></div>${next(d.anchor ? 'Continue' : 'Skip for now')}</div>`;
    case 'remind':
      return `<div class="ob ${ui.ob.dir}">${top}<div class="q">If ${you} forget, how should we remind ${kid ? 'them' : 'you'}?</div>
        <p class="sub">The cap glows first. We only remind ${kid ? 'them' : 'you'} if the drop hasn't happened.</p>
        ${choice('channel', 'push', 'Phone notification')}${choice('channel', 'call', 'Phone call', 'Good if notifications are easy to miss')}
        <div class="grow"></div>${next()}</div>`;
    case 'family':
      return `<div class="ob ${ui.ob.dir}">${top}<div class="q">Who should know if a dose is missed?</div>
        <p class="sub">They get a weekly summary and hear from us only when something needs them. ${kid ? 'You' : 'You'} choose what they see.</p>
        <input class="field" data-ob="cg" value="${esc(d.cg)}" placeholder="Their name" maxlength="40">
        <div class="grow"></div>${next(d.cg.trim() ? 'Continue' : 'Skip')}</div>`;
    case 'how':
      return `<div class="ob deep ${ui.ob.dir}">
        <div class="ob-top"><button class="back" data-act="ob-back" aria-label="Back" style="color:#fff">‹</button></div>
        <div class="q" style="text-align:center">How Dropwise works</div>
        <p style="text-align:center;opacity:.85;margin:0">You just put the drop in. The cap does the rest.</p>
        <div class="timeline">
          <div class="tl"><div class="dot on">✓</div><div><b>Today: set up</b><p>Pair the cap and put the bottle ${esc(d.placement || 'where you will see it')}.</p></div></div>
          <div class="tl"><div class="dot">💡</div><div><b>Every dose: it glows, then checks</b><p>The cap glows when it's time and confirms the drop landed. Missed? Just try one more.</p></div></div>
          <div class="tl"><div class="dot">★</div><div><b>Day 59: it's a habit</b><p>Most habits feel automatic by then, so we get quieter.</p></div></div>
        </div>
        <div class="grow"></div>
        <button class="btn white" data-act="ob-next">Pair my cap</button>
      </div>`;
    case 'pair':
      return `<div class="ob ${ui.ob.dir}" style="text-align:center">${top}
        <div class="q">${ui.ob.paired ? 'Cap connected' : 'Hold the cap near your phone'}</div>
        <p class="sub">${ui.ob.paired ? 'The green light means everything is working.' : 'Looking for your cap...'}</p>
        <div class="grow" style="display:grid;place-items:center"><div class="${ui.ob.paired ? 'pop' : 'breathe'}">${capArt(ui.ob.light ?? 'off', 110)}</div></div>
        ${next('Finish')}</div>`;
    default:
      return '';
  }
}

function renderOnboarding() {
  const step = STEPS[ui.ob.step];
  $('#patient').style.background = step === 'how' ? 'var(--violet-800)' : step === 'welcome' ? 'var(--lav-100)' : '';
  $('#pStatus').classList.toggle('dark', step === 'how');
  $('#pBody').innerHTML = obView();
  $('#pTabs').innerHTML = '';
  const d = ui.ob.data;
  const btn = $('#pBody [data-act="ob-next"]');
  $('#pBody').querySelectorAll('[data-ob]').forEach((inp) => inp.addEventListener('input', () => {
    d[inp.dataset.ob] = inp.value;
    if (inp.dataset.ob === 'anchor' && PLACES[inp.value.trim().toLowerCase()]) d.placement = PLACES[inp.value.trim().toLowerCase()];
    if (btn) btn.disabled = !obValid();
  }));
  $('#pBody').querySelectorAll('[data-ob-time]').forEach((inp) => inp.addEventListener('input', () => {
    d.times[+inp.dataset.obTime] = inp.value;
    if (btn) btn.disabled = !obValid();
  }));
  const focus = $('#pBody input.field');
  if (focus && STEPS[ui.ob.step] !== 'routine') focus.focus({ preventScroll: true });

  if (STEPS[ui.ob.step] === 'pair' && !ui.ob.paired && !ui.ob.pairing) {
    // fake pairing: off, glowing, then green
    ui.ob.pairing = true;
    setTimeout(() => { if (ui.ob) { ui.ob.light = 'glow'; ui.ob.dir = ''; renderOnboarding(); } }, 900);
    setTimeout(() => { if (ui.ob) { ui.ob.light = 'green'; ui.ob.paired = true; ui.ob.dir = ''; renderOnboarding(); } }, 2100);
  }
}

async function finishOnboarding() {
  const d = ui.ob.data;
  const eyes = d.eye === 'both' ? ['left', 'right'] : [d.eye];
  const ok = await api('/api/setup', {
    patientName: d.name.trim(),
    mode: d.who === 'child' ? 'kid' : 'adult',
    timezone: ui.S?.profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    reminderChannel: d.channel,
    routine: { anchor: d.anchor.trim() || null, placement: d.anchor.trim() ? d.placement.trim() || null : null },
    medications: [{ name: d.med.trim(), capId: 'cap-1', doses: [...new Set(d.times)].map((time) => ({ time, eyes })) }],
    caregivers: d.cg.trim() ? [{ name: d.cg.trim() }] : [],
  });
  if (!ok) return;
  ui.ob = null;
  ui.tab = 'today';
  ui.lastTab = null;
  ui.cgDrawn = false;
  renderAll();
}

// ---------- patient render ----------

function renderPatient() {
  if (!ui.S?.profile) return;
  $('#pStatus').innerHTML = statusbar();
  if (ui.ob) return renderOnboarding();
  $('#patient').style.background = '';
  $('#pStatus').classList.remove('dark');
  const body = $('#pBody');
  const entering = ui.tab !== ui.lastTab;
  const prev = body.querySelector('.screen')?.scrollTop ?? 0;
  body.innerHTML = `<div class="screen ${entering ? 'enter' : ''}">${views[ui.tab]()}</div>`;
  if (!entering) body.querySelector('.screen').scrollTop = prev;
  $('#pTabs').innerHTML = tabbar();
  ui.lastTab = ui.tab;
}

// ---------- caregiver ----------

function renderCaregiver() {
  const S = ui.S;
  if (!S?.profile) return;
  $('#cStatus').innerHTML = statusbar();
  const p = S.profile;
  const cg = S.caregiver;
  const name = p.patientName;
  const light = S.caps[0].light;
  const parts = [`<h1 style="margin-top:8px">Hi ${esc(first(cgName()))}</h1><p class="sub" style="margin-top:0">You'll only hear from us when something needs you.</p>`];

  if (cg.paused) {
    parts.push(`<div class="card" style="display:flex;gap:14px;align-items:center">${mascot('calm', 56)}<div><b>${esc(name)} paused sharing</b><div class="sub small">You won't see doses or get alerts until they turn it back on.</div></div></div>`);
  } else {
    let person = `<div class="card">
      <div style="display:flex;gap:12px;align-items:center">
        <div class="avatar" style="background:var(--lav-100);box-shadow:none">${esc(name.charAt(0))}</div>
        <div style="flex:1"><div style="font-size:19px;font-weight:800">${esc(name)}</div><div class="sub small">${esc(p.medications[0].name)}</div></div>
        <span class="light ${light}" style="width:16px;height:16px" title="cap light: ${light}"></span>
      </div>`;
    if (cg.adherence) {
      const a = cg.adherence;
      const pct = a.dosesDue ? Math.round((a.dosesDone / a.dosesDue) * 100) : 0;
      person += `<div style="margin-top:14px"><span class="sub small" style="font-weight:700">This week</span><div style="font-size:26px;font-weight:800">${a.dosesDone} of ${a.dosesDue} doses</div><div class="bar"><i style="width:${pct}%"></i></div></div>
        <div class="chip-row">${a.today.map((d) => { const [l, c] = doseStatus(d); return `<span class="dchip">${esc(t12(d.time))}<span class="pill ${c}">${esc(l)}</span></span>`; }).join('')}</div>`;
    } else person += `<p class="sub small">${esc(first(name))} isn't sharing which doses they took.</p>`;
    if (cg.technique && cg.technique.goodAimPct != null) {
      person += `<p class="small" style="margin:12px 0 0;font-weight:700">🎯 Good aim on ${cg.technique.goodAimPct}% of drops${cg.technique.aimTrend ? `, ${cg.technique.aimTrend}` : ''}</p>`;
    }
    parts.push(person + '</div>');

    const recent = cg.notifications.filter((a) => S.now - a.at < 48 * 3600e3);
    const alerts = recent.slice(-4).reverse();
    const newestMiss = alerts.find((a) => a.kind === 'missed_alert');
    let box = '<div><h2>Alerts</h2>';
    if (!alerts.length) {
      box += `<div class="card" style="display:flex;gap:12px;align-items:center">${mascot('calm', 44)}<span style="font-weight:700">${p.sharing.alerts ? 'All quiet. Nothing needs you.' : `${esc(first(name))} turned off missed dose alerts.`}</span></div>`;
    }
    for (const a of alerts) {
      let cls = '';
      let title = a.text;
      let sub = '';
      if (a.kind === 'missed_alert') { title = `Missed dose: ${dayName(a.slotDate)} ${t12(a.slotTime)}`; if (a === newestMiss) sub = a.action; }
      if (a.kind === 'correction') { cls = 'fix'; title = `False alarm: ${dayName(a.slotDate)} ${t12(a.slotTime)} was taken`; sub = 'The cap was out of range and synced late.'; }
      if (a.kind === 'low_battery') cls = 'info';
      box += `<div class="cg-alert ${cls}"><b>${esc(title)}</b>${sub ? `<p>${esc(sub)}</p>` : ''}<div class="at">${esc(whenText(a.at))}</div></div>`;
    }
    parts.push(box + '</div>');
  }
  parts.push(`<div><h2>Cheer ${esc(first(name))} on</h2><button class="btn primary" data-act="heart">❤️ Send a heart</button><p class="small sub" style="text-align:center">They'll see it right after their next drop lands.</p></div>`);

  const body = $('#cBody');
  const prev = body.querySelector('.screen')?.scrollTop ?? 0;
  body.innerHTML = `<div class="screen ${ui.cgDrawn ? '' : 'enter'}">${parts.join('')}</div>`;
  if (ui.cgDrawn) body.querySelector('.screen').scrollTop = prev;
  ui.cgDrawn = true;
}

// ---------- demo controls ----------

const SCEN = [
  ['missed_cheek', 'Missed the eye', 'too far and tilted'],
  ['eye_closed', 'Blinked', 'eye was closed'],
  ['unsure', 'Sensors disagree', "can't confirm"],
  ['camera_blind', 'Camera missed it', 'heat sensor saw it'],
  ['false_trigger', 'Not a drop', 'beam blocked'],
];

function renderDev() {
  const S = ui.S;
  const box = $('#dev');
  if (!S?.profile) { box.innerHTML = `<h3>Dropwise demo</h3><div class="res">${esc(ui.result)}</div>`; return; }
  const next = S.patient.today.nextDose;
  const due = next && next.at <= S.now;
  if (!ui.eyeManual) {
    const open = S.patient.today.doses.find((d) => d.status === 'open' && d.eyesDone.length < d.eyes.length);
    const eyes = open?.eyes ?? S.profile.medications[0].doses[0].eyes;
    ui.eye = open ? eyes.find((e) => !open.eyesDone.includes(e)) : eyes[0];
  }
  const eyeBtn = (v, l) => `<button data-act="dev-eye" data-v="${v}" aria-pressed="${ui.eye === v}">${l}</button>`;
  box.innerHTML = `<h3>Demo controls</h3>
    <div class="note" style="margin:0">Pretend time passes and the bottle gets squeezed. The two phones react on their own.</div>
    <div class="lbl">Simulated time</div>
    <div class="clock">${esc(fmt(S.now, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</div>
    <div class="grid" style="margin-top:8px">
      <button data-act="dev-adv" data-v="15">+15 min</button><button data-act="dev-adv" data-v="60">+1 hour</button>
      <button class="go" data-act="dev-next" ${!next || due ? 'disabled' : ''}>${due ? 'Dose due now' : 'Skip to next dose'}</button><button data-act="dev-adv" data-v="1440">+1 day</button>
    </div>
    <div class="lbl">Squeeze the bottle</div>
    <div class="eyes">${eyeBtn('left', 'Left eye')}${eyeBtn('right', 'Right eye')}${eyeBtn('', "Can't tell")}</div>
    <button class="clean" style="margin-top:8px" data-act="dev-drop" data-v="good">Clean drop<small>lands in the eye</small></button>
    <div class="grid" style="margin-top:6px">${SCEN.map(([k, t, s]) => `<button data-act="dev-drop" data-v="${k}">${t}<small>${s}</small></button>`).join('')}</div>
    <div class="res" aria-live="polite">${esc(ui.result)}</div>
    <div class="lbl">Situation</div>
    <select data-dev="sync" aria-label="Phone range">
      <option value="0" ${ui.sync === 0 ? 'selected' : ''}>Phone nearby</option>
      <option value="30" ${ui.sync === 30 ? 'selected' : ''}>Phone out of range, 30 min</option>
      <option value="120" ${ui.sync === 120 ? 'selected' : ''}>Phone out of range, 2 hours</option>
      <option value="720" ${ui.sync === 720 ? 'selected' : ''}>Phone out of range, 12 hours</option>
    </select>
    <div class="sw" style="margin-top:6px"><span>Cap battery</span><input data-dev="battery" type="number" min="0" max="100" value="${ui.battery}" style="width:70px" aria-label="Cap battery percent"></div>
    <div class="sw"><span>Kid mode</span><button class="switch" role="switch" aria-checked="${S.profile.mode === 'kid'}" data-act="dev-kid" aria-label="Kid mode"></button></div>
    <div class="lbl">Start over</div>
    <div class="grid"><button data-act="dev-setup">Run setup</button><button data-act="dev-demo">Reset demo</button></div>
    <div class="note">Old test page: <a href="/sim">/sim</a></div>`;
  box.querySelectorAll('[data-dev]').forEach((inp) => inp.addEventListener('change', () => {
    ui[inp.dataset.dev] = Number(inp.value);
  }));
}

function describe(d) {
  const r = d.result;
  let t;
  if (r.kind === 'noise') t = 'Not a drop. Ignored, nothing counted.';
  else if (r.outcome === 'delivered') t = `Landed (${r.confidence} confidence).`;
  else if (r.outcome === 'missed_eye') t = 'Missed the eye. No credit, retry prompt sent.';
  else t = "Couldn't confirm. No credit, retry prompt sent.";
  if (!d.synced) t += " The phone won't know until the cap syncs.";
  return t;
}

// ---------- events ----------

function renderAll() {
  renderDev();
  renderPatient();
  renderCaregiver();
}

const actions = {
  tab: (v) => { ui.tab = v; renderPatient(); },
  share: async (_, el) => api('/api/sharing', { [el.dataset.k]: el.getAttribute('aria-checked') !== 'true' }),
  channel: (v) => api('/api/profile', { reminderChannel: v }),
  report: () => openReportSheet(),
  'edit-setup': () => startOnboarding(true),
  'close-sheet': () => closeSheet(),
  heart: async () => {
    if (await api('/api/cheer', { from: cgName() })) toast('#cToast', 'Heart sent. It shows after their next drop.');
  },
  'ob-next': () => {
    if (!obValid()) return;
    if (STEPS[ui.ob.step] === 'pair') return finishOnboarding();
    ui.ob.step++;
    ui.ob.dir = 'fwd';
    renderOnboarding();
  },
  'ob-back': () => {
    if (ui.ob.step === 0) return;
    ui.ob.step--;
    ui.ob.dir = 'back';
    ui.ob.pairing = false;
    ui.ob.paired = false;
    ui.ob.light = 'off';
    renderOnboarding();
  },
  'ob-exit': () => { ui.ob = null; ui.lastTab = null; renderPatient(); },
  'ob-set': (v, el) => { ui.ob.data[el.dataset.k] = v; ui.ob.dir = ''; renderOnboarding(); },
  'ob-anchor': (v) => { ui.ob.data.anchor = v; ui.ob.data.placement = PLACES[v] ?? ''; ui.ob.dir = ''; renderOnboarding(); },
  'ob-add-time': () => { ui.ob.data.times.push('12:00'); ui.ob.dir = ''; renderOnboarding(); },
  'ob-rm-time': (v) => { ui.ob.data.times.splice(+v, 1); ui.ob.dir = ''; renderOnboarding(); },
  'dev-adv': (v) => api('/api/clock', { advanceMin: Number(v) }),
  'dev-next': () => api('/api/clock', { toNextDose: true }),
  'dev-eye': (v) => { ui.eye = v; ui.eyeManual = true; renderDev(); },
  'dev-drop': async (v) => {
    const data = await api('/api/drop', { scenario: v, eye: ui.eye, syncDelayMin: ui.sync, batteryPct: ui.battery, capId: ui.S.caps[0].capId });
    if (!data) return;
    ui.eyeManual = false;
    ui.result = describe(data.lastDrop);
    renderDev();
    if (data.lastDrop.synced && !ui.ob) openDropSheet(data.lastDrop);
  },
  'dev-kid': () => api('/api/profile', { mode: ui.S.profile.mode === 'kid' ? 'adult' : 'kid' }).then(() => { ui.lastTab = null; renderPatient(); }),
  'dev-setup': () => startOnboarding(false),
  'dev-demo': async () => {
    ui.ob = null; ui.sheet = null; renderSheet();
    await api('/api/demo', {});
    ui.lastTab = null; ui.cgDrawn = false; ui.tab = 'today';
    renderAll();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  // tapping the dim area closes the sheet, tapping inside it doesnt
  if (el.dataset.self && e.target !== el) return;
  actions[el.dataset.act]?.(el.dataset.v, el);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ui.sheet) closeSheet();
  if (e.key === 'Enter' && ui.ob && e.target.matches('input.field')) $('#pBody [data-act="ob-next"]')?.click();
});

api('/api/state');
