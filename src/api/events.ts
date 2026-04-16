export function createTreeEventsSource(token: string): EventSource {
  const streamUrl = `/api/events/tree?token=${encodeURIComponent(token)}`
  return new EventSource(streamUrl)
}
