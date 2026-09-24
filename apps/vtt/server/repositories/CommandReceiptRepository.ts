import type { PoolClient } from 'pg';
import { BaseRepository, type DomainCommandReceiptRecord } from './base.js';

export class CommandReceiptRepository extends BaseRepository {
  async getReceipt(
    commandId: string,
    client?: PoolClient,
  ): Promise<DomainCommandReceiptRecord | null> {
    const executor = this.getExecutor(client);
    const result = await executor.query<DomainCommandReceiptRecord>(
      'SELECT * FROM domain_command_receipts WHERE "commandId" = $1',
      [commandId],
    );
    return result.rows[0] ?? null;
  }

  async saveReceipt(
    receipt: DomainCommandReceiptRecord,
    client?: PoolClient,
  ): Promise<void> {
    const executor = this.getExecutor(client);
    await executor.query(
      `INSERT INTO domain_command_receipts (
         "commandId", "principalId", "scopeKind", "scopeId",
         "commandType", "payloadHash", "committedAt", result
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT ("commandId") DO NOTHING`,
      [
        receipt.commandId,
        receipt.principalId,
        receipt.scopeKind,
        receipt.scopeId,
        receipt.commandType,
        receipt.payloadHash,
        receipt.committedAt,
        JSON.stringify(receipt.result),
      ],
    );
  }

  async findReceiptByHash(
    scopeKind: string,
    scopeId: string,
    commandType: string,
    payloadHash: string,
    client?: PoolClient,
  ): Promise<DomainCommandReceiptRecord | null> {
    const executor = this.getExecutor(client);
    const result = await executor.query<DomainCommandReceiptRecord>(
      `SELECT * FROM domain_command_receipts
       WHERE "scopeKind" = $1 AND "scopeId" = $2 AND "commandType" = $3 AND "payloadHash" = $4
       ORDER BY "committedAt" DESC
       LIMIT 1`,
      [scopeKind, scopeId, commandType, payloadHash],
    );
    return result.rows[0] ?? null;
  }
}
