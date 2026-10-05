// Typical per-camera bitrates (Mbps) for H.264 at 15 fps, medium-activity scene.
// These are common industry rule-of-thumb values, not vendor-specific numbers.
const BITRATE_PRESETS_MBPS = {
  '1080p': 4,
  '4MP': 6,
  '5MP': 8,
  '4K': 12,
};

// IEEE 802.3af (PoE) maximum power available at the camera.
const DEFAULT_WATTS_PER_CAMERA = 12.95;

// 1 watt of electrical load = 3.412 BTU/hr of heat.
const BTU_PER_HR_PER_WATT = 3.412;

// Marks errors caused by bad user input (-> HTTP 400), as opposed to server errors (-> HTTP 500).
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const round = (value, decimals) => Math.round(value * 10 ** decimals) / 10 ** decimals;

function calculateCameraSystem(input = {}) {
  const {
    cameraCount,
    resolution,
    retentionDays,
    recordingHoursPerDay = 24,
    wattsPerCamera = DEFAULT_WATTS_PER_CAMERA,
    additionalLoadWatts = 0,
    upsBatteryWh,
    upsEfficiency = 0.9,
  } = input;

  if (!Number.isInteger(cameraCount) || cameraCount < 1) {
    throw new ValidationError('cameraCount must be a whole number of at least 1');
  }
  if (!(resolution in BITRATE_PRESETS_MBPS)) {
    throw new ValidationError(`resolution must be one of: ${Object.keys(BITRATE_PRESETS_MBPS).join(', ')}`);
  }
  if (typeof retentionDays !== 'number' || retentionDays <= 0) {
    throw new ValidationError('retentionDays must be a number greater than 0');
  }
  if (typeof recordingHoursPerDay !== 'number' || recordingHoursPerDay <= 0 || recordingHoursPerDay > 24) {
    throw new ValidationError('recordingHoursPerDay must be between 0 and 24');
  }
  if (typeof wattsPerCamera !== 'number' || wattsPerCamera <= 0) {
    throw new ValidationError('wattsPerCamera must be a number greater than 0');
  }
  if (typeof additionalLoadWatts !== 'number' || additionalLoadWatts < 0) {
    throw new ValidationError('additionalLoadWatts must be a number of 0 or more');
  }
  if (upsBatteryWh !== undefined && (typeof upsBatteryWh !== 'number' || upsBatteryWh <= 0)) {
    throw new ValidationError('upsBatteryWh must be a number greater than 0');
  }
  if (typeof upsEfficiency !== 'number' || upsEfficiency <= 0 || upsEfficiency > 1) {
    throw new ValidationError('upsEfficiency must be between 0 and 1');
  }

  // Bandwidth and storage
  const bitratePerCameraMbps = BITRATE_PRESETS_MBPS[resolution];
  const totalBandwidthMbps = cameraCount * bitratePerCameraMbps;
  // Megabits -> terabytes: seconds recorded x Mbps, / 8 bits per byte, / 1,000,000 MB per TB
  const secondsRecorded = recordingHoursPerDay * 3600 * retentionDays;
  const storageTB = (totalBandwidthMbps * secondsRecorded) / 8 / 1_000_000;

  // Power, heat and UPS runtime
  const totalLoadWatts = cameraCount * wattsPerCamera + additionalLoadWatts;
  const heatLoadBtuPerHour = totalLoadWatts * BTU_PER_HR_PER_WATT;
  // Runtime (min) = usable battery energy (Wh) / load (W) x 60
  const upsRuntimeMinutes =
    upsBatteryWh === undefined ? null : ((upsBatteryWh * upsEfficiency) / totalLoadWatts) * 60;

  return {
    inputs: {
      cameraCount,
      resolution,
      retentionDays,
      recordingHoursPerDay,
      wattsPerCamera,
      additionalLoadWatts,
      upsBatteryWh: upsBatteryWh ?? null,
      upsEfficiency,
    },
    bitratePerCameraMbps,
    totalBandwidthMbps,
    storageTB: round(storageTB, 2),
    totalLoadWatts: round(totalLoadWatts, 1),
    heatLoadBtuPerHour: round(heatLoadBtuPerHour, 1),
    upsRuntimeMinutes: upsRuntimeMinutes === null ? null : round(upsRuntimeMinutes, 1),
  };
}

module.exports = { calculateCameraSystem, ValidationError, BITRATE_PRESETS_MBPS };
