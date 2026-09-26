import type { Request, RequestHandler } from 'express';
import type { Logger } from '../logger.js';
import { ctx, sendError } from './context.js';

/** Receiving any request body: at most this long overall. */
export const BODY_DEADLINE_MS = 330_000;
/** The server-side Codex upload (320 MiB) over a slow link. */
export const UPLOAD_BODY_DEADLINE_MS = 30 * 60 * 1000;
/** No body bytes at all for this long ends the request, on every route. */
export const BODY_IDLE_TIMEOUT_MS = 60_000;
/** After the response is sent, an unread remainder of the body is not waited for. */
const ABANDONED_BODY_GRACE_MS = 5_000;

/**
 * Node's `server.requestTimeout` is one value for every route, so it is set
 * to the longest allowance (the upload) and this middleware enforces the
 * per-route body deadlines below it:
 *
 * - every body must keep arriving (no gap longer than the idle timeout),
 *   which is what stops a slowloris trickle on any route;
 * - a body must be complete within `BODY_DEADLINE_MS`, except on the long
 *   upload routes, which get `UPLOAD_BODY_DEADLINE_MS`;
 * - once a response has been sent (for example a 401 or 413 before the body
 *   was read), the rest of the body is not drained for long.
 *
 * Header receipt stays bounded by the short `server.headersTimeout`. Only
 * body receipt is timed: upstream waits after the body has arrived use each
 * route's own `timeoutMs`.
 */
export function bodyDeadline(options: {
  logger: Logger;
  longBodyRoutes: ReadonlySet<string>;
  deadlineMs?: number;
  longDeadlineMs?: number;
  idleTimeoutMs?: number;
}): RequestHandler {
  const deadlineMs = options.deadlineMs ?? BODY_DEADLINE_MS;
  const longDeadlineMs = options.longDeadlineMs ?? UPLOAD_BODY_DEADLINE_MS;
  const idleTimeoutMs = options.idleTimeoutMs ?? BODY_IDLE_TIMEOUT_MS;

  return (req, res, next) => {
    if (req.complete || !expectsBody(req)) return next();
    const long = options.longBodyRoutes.has(`${req.method} ${req.path}`);

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      req.setTimeout(0);
    };
    const expire = (reason: 'body_deadline' | 'body_idle') => {
      if (settled) return;
      if (req.complete) {
        settle();
        return;
      }
      settle();
      options.logger.warn('request body timed out', { requestId: ctx(res)?.requestId, reason });
      if (!res.headersSent) {
        res.setHeader('Connection', 'close');
        sendError(res, 408, 'request_timeout');
        res.once('finish', () => req.socket.destroy());
      } else {
        req.socket.destroy();
      }
    };

    const deadline = setTimeout(() => expire('body_deadline'), long ? longDeadlineMs : deadlineMs);
    deadline.unref();
    // Socket inactivity while the body is outstanding; cleared once it ends.
    req.setTimeout(idleTimeoutMs, () => expire('body_idle'));
    req.once('end', settle);
    req.once('close', settle);
    res.once('finish', () => {
      if (req.complete) return settle();
      settle();
      setTimeout(() => {
        if (!req.complete) req.socket.destroy();
      }, ABANDONED_BODY_GRACE_MS).unref();
    });
    next();
  };
}

function expectsBody(req: Request): boolean {
  const length = req.headers['content-length'];
  if (length !== undefined) return length !== '0';
  return req.headers['transfer-encoding'] !== undefined;
}
