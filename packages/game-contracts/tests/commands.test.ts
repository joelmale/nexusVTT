import { describe, it, expect } from 'vitest';
import {
  domainCommandSchema,
  domainCommandReceiptSchema,
  applyDamagePayloadSchema,
  castSpellPayloadSchema,
} from '../src';
import { mockApplyDamageCommand, mockCommandReceipt } from './fixtures';

describe('Domain Commands & Receipts', () => {
  it('validates a complete ApplyDamage command envelope', () => {
    const parsed = domainCommandSchema.parse(mockApplyDamageCommand);
    expect(parsed.commandId).toBe(mockApplyDamageCommand.commandId);
    expect(parsed.payload.type).toBe('ApplyDamage');
    if (parsed.payload.type === 'ApplyDamage') {
      expect(parsed.payload.amount).toBe(12);
      expect(parsed.payload.damageType).toBe('slashing');
    }
  });

  it('validates a CastSpell command payload', () => {
    const castPayload = {
      type: 'CastSpell' as const,
      actorId: '77777777-7777-4777-8777-777777777777',
      spellRef: {
        kind: 'spell' as const,
        id: '22222222-2222-4222-8222-222222222222',
        revision: 1,
      },
      profileId: 'wizard-core',
      castAtLevel: 3,
      targetActorIds: ['ffffffff-ffff-4fff-8fff-ffffffffffff'],
    };

    const parsed = castSpellPayloadSchema.parse(castPayload);
    expect(parsed.castAtLevel).toBe(3);
    expect(parsed.targetActorIds).toHaveLength(1);
  });

  it('validates a DomainCommandReceipt with committed versions', () => {
    const parsed = domainCommandReceiptSchema.parse(mockCommandReceipt);
    expect(parsed.result.success).toBe(true);
    expect(
      parsed.result.committedVersions[
        '77777777-7777-4777-8777-777777777777'
      ],
    ).toBe(2);
    expect(parsed.result.roomStateVersion).toBe(43);
  });
});
