export type ParsedEntity<T> = {
  entity: T;
  confidence: number;
  rawSnippet: string;
  failureReason?: string;
};

export const clampConfidence = (value: number) => Math.max(0, Math.min(1, value));
