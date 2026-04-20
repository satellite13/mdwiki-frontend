import axios from 'axios'

interface ApiErrorBody {
  message?: string
}

function readServerMessage(data: unknown): string | null {
  if (data && typeof data === 'object') {
    const message = (data as ApiErrorBody).message
    if (typeof message === 'string' && message.trim().length > 0) return message
  }
  return null
}

/**
 * Извлекает человекочитаемое сообщение из ошибки API.
 * Порядок: `response.data.message` → `error.message` → fallback.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const serverMessage = readServerMessage(error.response?.data)
    if (serverMessage) return serverMessage
    if (typeof error.message === 'string' && error.message.length > 0) return error.message
  } else if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

/** True, если ошибка — это axios-ответ с конкретным HTTP-статусом. */
export function isApiErrorWithStatus(error: unknown, status: number): boolean {
  return axios.isAxiosError(error) && error.response?.status === status
}
