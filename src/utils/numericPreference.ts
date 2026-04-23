import { readString, writeString } from '@/utils/localPreferences'

type NumericPrefConfig = {
  min: number
  max: number
  fallback: number
}

export function clampNumber(value: number, config: NumericPrefConfig): number {
  if (!Number.isFinite(value)) return config.fallback
  return Math.min(config.max, Math.max(config.min, value))
}

export function readClampedNumberPref(key: string, config: NumericPrefConfig): number {
  const raw = Number(readString(key) || String(config.fallback))
  return clampNumber(raw, config)
}

export function writeClampedNumberPref(key: string, value: number, config: NumericPrefConfig): void {
  writeString(key, String(Math.round(clampNumber(value, config))))
}
