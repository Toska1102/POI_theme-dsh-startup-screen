// Browser defaults are delivered by the Host. This is also used by the preview server.
export const DEFAULTS = Object.freeze({
  enabled: true,
  mode: 'session',
  speed: 1,
  requireInteraction: true,
  allowSkip: true,
  sound: true,
  soundVolume: 0.5,
  voice: true,
  voiceVolume: 0.9,
  identity: 'JOYCE MOORE',
  identityId: '0087',
  accessLevel: '3'
})

export function normalize(input) {
  const source = input && typeof input === 'object' ? input : {}
  const result = { ...DEFAULTS }
  for (const key of ['enabled', 'requireInteraction', 'allowSkip', 'sound', 'voice']) {
    if (source[key] != null) result[key] = [true, 'true', 1, '1'].includes(source[key])
  }
  for (const [key, low, high] of [
    ['speed', 0.35, 3],
    ['soundVolume', 0, 1],
    ['voiceVolume', 0, 1]
  ]) {
    if (source[key] == null) continue
    const number = Number(source[key])
    if (Number.isFinite(number)) result[key] = Math.min(high, Math.max(low, number))
  }
  if (['always', 'session', 'daily'].includes(source.mode)) result.mode = source.mode
  for (const key of ['identity', 'identityId', 'accessLevel']) {
    if (source[key] != null)
      result[key] = String(source[key])
        .trim()
        .slice(0, key === 'identity' ? 48 : 16)
    if (!result[key]) result[key] = DEFAULTS[key]
  }
  return result
}
