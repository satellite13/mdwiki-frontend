import client from './client'
import type { Tag } from '@/types'
export function listTags() { return client.get<Tag[]>('/tags') }
