import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { getContext } from './request-context';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = getContext()?.requestId;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const body = typeof payload === 'string' ? { message: payload } : (payload as object);
      response.status(status).json({ statusCode: status, requestId, ...body });
      return;
    }

    // Unknown failures never leak internals to the client, but are logged in full.
    this.logger.error(
      `[${requestId}] unhandled ${(exception as Error)?.message}`,
      (exception as Error)?.stack,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'InternalServerError',
      message: 'Something went wrong. The incident has been logged.',
      requestId,
    });
  }
}
