import { SENSOR } from './config.js';

// raw cap reading -> what happened. pure, so threshold changes re-score old data too
//
// reading shape:
// {
//   beamBreak: { triggered, durationMs },
//   tofMm, tiltDeg,
//   camera: { landedOnEye: true|false|null, confidence, eyeOpen, eye: 'left'|'right'|null } | null,
//   thermopile: { deltaC } | null,
// }

function cameraVote(cam) {
  if (!cam || cam.landedOnEye == null) return 'unknown';
  if ((cam.confidence ?? 0) < SENSOR.cameraMinConfidence) return 'unknown';
  return cam.landedOnEye ? 'yes' : 'no';
}

function thermoVote(th) {
  if (!th || typeof th.deltaC !== 'number') return 'unknown';
  if (th.deltaC <= SENSOR.thermoYesC) return 'yes';
  if (th.deltaC >= SENSOR.thermoNoC) return 'no';
  return 'unknown';
}

export function checkAim(reading) {
  const { tofMm, tiltDeg } = reading;
  let distance = 'unknown';
  if (typeof tofMm === 'number') {
    if (tofMm < SENSOR.tofGoodMinMm) distance = 'too_close';
    else if (tofMm > SENSOR.tofGoodMaxMm) distance = 'too_far';
    else distance = 'ok';
  }
  let angle = 'unknown';
  if (typeof tiltDeg === 'number') angle = Math.abs(tiltDeg) > SENSOR.tiltMaxDeg ? 'tilted' : 'ok';
  const good = distance === 'ok' && angle === 'ok';
  return { distance, angle, good, tofMm: tofMm ?? null, tiltDeg: tiltDeg ?? null };
}

const TIPS = {
  too_far: 'Bring the bottle a bit closer, about 1 to 3 cm above your eye.',
  too_close: "Hold the bottle a little higher so the tip doesn't touch your eye.",
  tilted: 'Point the bottle straight down over your eye.',
  eye_closed: 'Try to keep your eye open until the drop lands.',
  missed_aim_ok: 'Tilt your head back and look up before you squeeze.',
};

// only returns tips when theres something to actually fix
function coachingTips(aim, outcome, eyeClosed) {
  const tips = [];
  if (eyeClosed) tips.push(TIPS.eye_closed);
  if (aim.distance === 'too_far') tips.push(TIPS.too_far);
  if (aim.distance === 'too_close') tips.push(TIPS.too_close);
  if (aim.angle === 'tilted') tips.push(TIPS.tilted);
  if (outcome === 'missed_eye' && tips.length === 0) tips.push(TIPS.missed_aim_ok);
  return tips;
}

export function classifyReading(reading) {
  const bb = reading?.beamBreak;
  const dur = bb?.durationMs;
  if (!bb?.triggered || typeof dur !== 'number' || dur < SENSOR.dropMinMs || dur > SENSOR.dropMaxMs) {
    // not drop shaped, probably a finger or dust. logged but never counts
    return { kind: 'noise', reason: !bb?.triggered ? 'no_beam_break' : 'duration_out_of_range' };
  }

  const aim = checkAim(reading);
  const eyeClosed = reading.camera?.eyeOpen === false;
  const cam = cameraVote(reading.camera);
  const th = thermoVote(reading.thermopile);

  let outcome;
  let confidence;
  if (eyeClosed) {
    outcome = 'missed_eye';
    confidence = 'high';
  } else if (cam === 'yes' && th === 'yes') {
    outcome = 'delivered';
    confidence = 'high';
  } else if ((cam === 'yes' && th === 'unknown') || (th === 'yes' && cam === 'unknown')) {
    outcome = 'delivered';
    confidence = 'medium';
  } else if (cam === 'no' && th === 'no') {
    outcome = 'missed_eye';
    confidence = 'high';
  } else if (cam === 'no' || th === 'no') {
    // yes + no means the sensors disagree, a lone no means probably missed
    outcome = cam === 'yes' || th === 'yes' ? 'unconfirmed' : 'missed_eye';
    confidence = outcome === 'missed_eye' ? 'medium' : 'low';
  } else {
    // both sensors blind, dont give credit we cant back up
    outcome = 'unconfirmed';
    confidence = 'low';
  }

  return {
    kind: 'drop',
    outcome,
    confidence,
    eye: reading.camera?.eye ?? null,
    votes: { camera: cam, thermopile: th },
    aim,
    tips: coachingTips(aim, outcome, eyeClosed),
  };
}
