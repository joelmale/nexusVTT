import type { RulesRevisionStatus } from '@nexus/rules-contracts'
import type { Tone } from '@/components/common'

export function revisionStatusTone(status: RulesRevisionStatus): Tone {
  switch (status) {
    case 'published':
      return 'green'
    case 'validated':
      return 'blue'
    case 'draft':
      return 'yellow'
    default:
      return 'gray'
  }
}
