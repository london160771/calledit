/** Live timing is separate from the pure engine and Seed-7 defaults. */
export function readLiveConfig(env = {}) {
  const config = {};
  for (const [name, key] of [['LIVE_SYNC_WINDOW_MS', 'syncWindowMs'], ['LIVE_MAX_DELAY_MS', 'maxDelayMs']]) {
    const raw = env[name];
    const value = raw == null || String(raw).trim() === '' ? 45000 : Number(raw);
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive whole number of milliseconds.`);
    config[key] = value;
  }
  return config;
}
