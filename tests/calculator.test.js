const { calculateCameraSystem } = require('../src/calculator');

describe('calculateCameraSystem', () => {
  test('calculates bandwidth and storage for 10 x 1080p cameras, 30 days', () => {
    const result = calculateCameraSystem({ cameraCount: 10, resolution: '1080p', retentionDays: 30 });
    expect(result.totalBandwidthMbps).toBe(40);
    // 40 Mbps x 86,400 s x 30 days / 8 / 1,000,000 = 12.96 TB
    expect(result.storageTB).toBe(12.96);
  });

  test('respects recordingHoursPerDay', () => {
    const result = calculateCameraSystem({ cameraCount: 10, resolution: '1080p', retentionDays: 30, recordingHoursPerDay: 12 });
    expect(result.storageTB).toBe(6.48);
  });

  test('rejects zero cameras', () => {
    expect(() => calculateCameraSystem({ cameraCount: 0, resolution: '1080p', retentionDays: 30 })).toThrow('cameraCount');
  });

  test('rejects unknown resolution', () => {
    expect(() => calculateCameraSystem({ cameraCount: 5, resolution: '8K', retentionDays: 30 })).toThrow('resolution');
  });

  test('rejects missing retentionDays', () => {
    expect(() => calculateCameraSystem({ cameraCount: 5, resolution: '4K' })).toThrow('retentionDays');
  });
});