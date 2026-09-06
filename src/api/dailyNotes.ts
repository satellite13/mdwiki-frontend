import client from './client'
import type { DailyNoteResponse } from '@/types'

export const getDailyNote = (date: string, signal?: AbortSignal) =>
  client.get<DailyNoteResponse>(`/me/daily-notes/${date}`, { signal })

export const putDailyNote = (date: string, signal?: AbortSignal) =>
  client.put<DailyNoteResponse>(`/me/daily-notes/${date}`, undefined, { signal })
