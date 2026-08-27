import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runWithContext } from './request-context';

/**
 * Establishes the async-local request context for the whole request tree, so
 * services can reach the actor and tenant without threading them through every
 * signature - and so every log line can be correlated.
 */
@Injectable()
export class ContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    res.setHeader('x-request-id', requestId);

    runWithContext(
      {
        requestId,
        ip: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
      () => next(),
    );
  }
}
