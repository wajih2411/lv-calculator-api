// Typical per-camera bitrates (Mbps) for H.264 at 15 fps, medium-activity scene.
// These are common industry rule-of-thumb values, not vendor-specific numbers.
const BITRATE_PRESETS_MBPS = {
  '1080p': 4,
  '4MP': 6,
  '5MP': 8,
  '4K': 12,
};

function calculateCameraSystem({ cameraCount, resolution, retentionDays, recordingHoursPerDay = 24 }) {
  if (!Number.isInteger(cameraCount) || cameraCount < 1) {
    throw new Error('cameraCount must be a whole number of at least 1');
  }
  if (!(resolution in BITRATE_PRESETS_MBPS)) {
    throw new Error(`resolution must be one of: ${Object.keys(BITRATE_PRESETS_MBPS).join(', ')}`);
  }
  if (typeof retentionDays !== 'number' || retentionDays <= 0) {
    throw new Error('retentionDays must be a number greater than 0');
  }
  if (typeof recordingHoursPerDay !== 'number' || recordingHoursPerDay <= 0 || recordingHoursPerDay > 24) {
    throw new Error('recordingHoursPerDay must be between 0 and 24');
  }

  const bitratePerCameraMbps = BITRATE_PRESETS_MBPS[resolution];
  const totalBandwidthMbps = cameraCount * bitratePerCameraMbps;

  // Megabits -> terabytes: seconds recorded x Mbps, / 8 bits per byte, / 1,000,000 MB per TB
  const secondsRecorded = recordingHoursPerDay * 3600 * retentionDays;
  const storageTB = (totalBandwidthMbps * secondsRecorded) / 8 / 1_000_000;

  return {
    inputs: { cameraCount, resolution, retentionDays, recordingHoursPerDay },
    bitratePerCameraMbps,
    totalBandwidthMbps,
    storageTB: Math.round(storageTB * 100) / 100,
  };
}

module.exports = { calculateCameraSystem, BITRATE_PRESETS_MBPS };