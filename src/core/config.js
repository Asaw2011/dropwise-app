// placeholder thresholds, recalibrate once the stage 1 bench rig has real data

export const SENSOR = {
  // drop crosses the 940nm beam in ~2 to 15 ms per the hardware brief
  dropMinMs: 2,
  dropMaxMs: 15,
  // good nozzle-to-eye distance in mm
  tofGoodMinMm: 10,
  tofGoodMaxMm: 30,
  // degrees away from pointing straight down
  tiltMaxDeg: 20,
  cameraMinConfidence: 0.7,
  // drop is colder than the eye so the surface temp dips
  thermoYesC: -0.3,
  thermoNoC: -0.1,
};

export const TIMING = {
  // how early before the scheduled time a drop still counts
  earlyMin: 60,
  // how long after the scheduled time before the dose counts as missed
  windowAfterMin: 180,
  // phone reminder delay after the cap starts glowing, by habit phase
  phoneDelayMin: { building: 30, supporting: 30, maintaining: 60 },
  // median days to peak automaticity (Keller et al. 2021)
  habitBuildDays: 59,
  slipLookbackDays: 7,
  slipThreshold: 0.8,
  // "on time" for the doctor report
  onTimeMin: 60,
  lowBatteryPct: 15,
};

export const EYES = ['left', 'right'];
