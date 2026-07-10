import client from './client'
import type { CompleteTaskPayload, OpenTask } from '@/types'

export function listOpenTasks() {
  return client.get<OpenTask[]>('/tasks/open')
}

export function completeTask(payload: CompleteTaskPayload) {
  return client.post('/tasks/complete', payload)
}
