import type { Tone } from '@/components/common'
import type { AssetStatus } from '@/lib/assetsApi'

export function assetStatusTone(status: AssetStatus): Tone {
  switch (status) {
    case 'active':
      return 'green'
    case 'quarantined':
      return 'yellow'
    case 'deleted':
      return 'red'
    default:
      return 'gray'
  }
}

/** Comma-separated tag input to a unique, trimmed list. */
export function parseTagInput(value: string): string[] {
  const tags: string[] = []
  for (const raw of value.split(',')) {
    const tag = raw.trim()
    if (tag && !tags.includes(tag)) tags.push(tag)
  }
  return tags
}
