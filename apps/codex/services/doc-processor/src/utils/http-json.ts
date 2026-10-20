import http from 'node:http';
import https from 'node:https';

/** The few Response members the callers need. */
export interface JsonResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

/**
 * POSTs JSON and waits up to `timeoutMs` for the whole response.
 *
 * Used instead of fetch for calls that legitimately run for minutes (Marker
 * layout on a page batch). Node's fetch (undici) gives up waiting for response
 * headers after 5 minutes whatever AbortSignal.timeout says, and reports it as
 * the unhelpful "fetch failed"; the server keeps working on the abandoned
 * request. node:http has no such built-in limit, so `timeoutMs` is the only one.
 */
export function postJson(url: string, body: unknown, timeoutMs: number): Promise<JsonResponse> {
  const target = new URL(url);
  const payload = Buffer.from(JSON.stringify(body));
  const client = target.protocol === 'https:' ? https : http;
  const signal = AbortSignal.timeout(timeoutMs);

  return new Promise((resolve, reject) => {
    const request = client.request(
      target,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length },
        signal,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => {
          const status = response.statusCode ?? 0;
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: status >= 200 && status < 300,
            status,
            text: async () => text,
            json: async () => JSON.parse(text),
          });
        });
      },
    );
    request.on('error', (error) => {
      reject(signal.aborted ? new Error(`POST ${target.pathname} timed out after ${timeoutMs}ms`) : error);
    });
    request.end(payload);
  });
}
