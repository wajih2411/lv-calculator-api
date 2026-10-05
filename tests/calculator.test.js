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

describe('power, heat and UPS calculations', () => {
  test('uses 12.95 W per camera by default and converts to BTU/hr', () => {
    const result = calculateCameraSystem({ cameraCount: 10, resolution: '1080p', retentionDays: 30 });
    // 10 x 12.95 W = 129.5 W; 129.5 x 3.412 = 441.854 BTU/hr
    expect(result.totalLoadWatts).toBe(129.5);
    expect(result.heatLoadBtuPerHour).toBe(441.9);
    expect(result.upsRuntimeMinutes).toBeNull();
  });

  test('adds extra equipment load (e.g. NVR, switch)', () => {
    const result = calculateCameraSystem({ cameraCount: 10, resolution: '1080p', retentionDays: 30, additionalLoadWatts: 50 });
    expect(result.totalLoadWatts).toBe(179.5);
  });

  test('calculates UPS runtime when battery size is given', () => {
    const result = calculateCameraSystem({ cameraCount: 10, resolution: '1080p', retentionDays: 30, upsBatteryWh: 1000 });
    // 1000 Wh x 0.9 efficiency / 129.5 W x 60 = 416.99 min
    expect(result.upsRuntimeMinutes).toBe(417);
  });

  test('rejects an efficiency above 1', () => {
    expect(() =>
      calculateCameraSystem({ cameraCount: 10, resolution: '1080p', retentionDays: 30, upsBatteryWh: 1000, upsEfficiency: 1.5 })
    ).toThrow('upsEfficiency');
  });
});
