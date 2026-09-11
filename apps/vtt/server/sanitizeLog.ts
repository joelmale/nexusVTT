export const sanitizeLog = (value: unknown): string =>
  String(value).replace(/[\r\n\t]/g, ' ').slice(0, 200);
