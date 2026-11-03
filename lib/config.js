// Host owns persisted settings and sends the same normalized values to every client.
export const DEFAULT_STAGE_DURATIONS = Object.freeze([
  0.8, 0.7, 0.8, 0.5, 0.6, 0.9, 1.7, 1.5, 0.8, 0.7
])
export const DEFAULTS = Object.freeze({
  enabled: true,
  mode: 'session',
  duration: 9,
  stageDurations: DEFAULT_STAGE_DURATIONS,
  allowSkip: true,
  sound: true,
  soundVolume: 0.5,
  voice: false,
  voiceVolume: 0.9,
  identity: 'JOYCE MOORE',
  identityId: '0087',
  accessLevel: '3',
  terminalText: 'what are your commands？',
  cameraMotion: true,
  scanSpeed: 1,
  lockSpeed: 1,
  effectIntensity: 0.5,
  reducedMotion: 'system'
})

const clamp = (value, low, high, fallback) => {
  const number = Number(value)
  return Number.isFinite(number)
    ? Math.min(high, Math.max(low, number))
    : fallback
}

export function normalize(input, changed = input) {
  const source = input && typeof input === 'object' ? input : {}
  const patch = changed && typeof changed === 'object' ? changed : {}
  const result = { ...DEFAULTS }
  for (const key of [
    'enabled',
    'allowSkip',
    'sound',
    'voice',
    'cameraMotion'
  ]) {
    if (source[key] != null)
      result[key] = [true, 'true', 1, '1'].includes(source[key])
  }
  for (const [key, low, high] of [
    ['soundVolume', 0, 1],
    ['voiceVolume', 0, 1],
    ['scanSpeed', 0.5, 2],
    ['lockSpeed', 0.5, 2],
    ['effectIntensity', 0, 1]
  ]) {
    if (source[key] != null)
      result[key] = clamp(source[key], low, high, DEFAULTS[key])
  }
  if (['session', 'daily', 'manual'].includes(source.mode))
    result.mode = source.mode
  if (['system', 'reduce', 'full'].includes(source.reducedMotion))
    result.reducedMotion = source.reducedMotion
  for (const [key, limit] of [
    ['identity', 48],
    ['identityId', 16],
    ['accessLevel', 16],
    ['terminalText', 160]
  ]) {
    if (source[key] != null)
      result[key] = String(source[key]).trim().slice(0, limit)
    if (!result[key]) result[key] = DEFAULTS[key]
  }
  const durations =
    Array.isArray(source.stageDurations) && source.stageDurations.length === 10
      ? source.stageDurations.map((value, index) =>
          Number.isFinite(Number(value)) && Number(value) > 0
            ? Number(value)
            : DEFAULT_STAGE_DURATIONS[index]
        )
      : [...DEFAULT_STAGE_DURATIONS]
  const sum = durations.reduce((total, value) => total + value, 0)
  // A duration-only edit rescales the current proportions. A stage edit updates the total.
  const durationEdited =
    Object.hasOwn(patch, 'duration') && !Object.hasOwn(patch, 'stageDurations')
  const duration = durationEdited
    ? clamp(source.duration, 6, 15, 9)
    : Array.isArray(source.stageDurations)
      ? clamp(sum, 6, 15, 9)
      : clamp(source.duration ?? 9, 6, 15, 9)
  result.stageDurations = durations.map((value) =>
    Number(((value * duration) / sum).toFixed(6))
  )
  result.stageDurations[9] = Number(
    (
      duration -
      result.stageDurations
        .slice(0, 9)
        .reduce((total, value) => total + value, 0)
    ).toFixed(6)
  )
  result.duration = Number(duration.toFixed(6))
  return result
}

export function resetGroup(current, group) {
  const advanced = [
    'stageDurations',
    'cameraMotion',
    'scanSpeed',
    'lockSpeed',
    'effectIntensity',
    'reducedMotion'
  ]
  const keys =
    group === 'advanced'
      ? advanced
      : Object.keys(DEFAULTS).filter((key) => !advanced.includes(key))
  const patch = Object.fromEntries(keys.map((key) => [key, DEFAULTS[key]]))
  if (group === 'advanced')
    patch.stageDurations = DEFAULT_STAGE_DURATIONS.map(
      (value) => (value * current.duration) / 9
    )
  return normalize({ ...current, ...patch }, patch)
}
