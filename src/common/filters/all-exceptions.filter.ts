import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { STATUS_CODES } from 'node:http';

export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.adapterHost;
    const response = host.switchToHttp().getResponse();
    const body = this.toBody(exception);

    httpAdapter.reply(response, body, body.statusCode);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      return {
        statusCode,
        error: STATUS_CODES[statusCode] ?? 'Error',
        message: this.messageOf(exception),
      };
    }

    this.logger.error(exception);
    const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    return {
      statusCode,
      error: STATUS_CODES[statusCode]!,
      message: 'Internal server error',
    };
  }

  private messageOf(exception: HttpException): string | string[] {
    const response = exception.getResponse();
    if (typeof response === 'object' && response !== null) {
      const { message } = response as { message?: unknown };
      if (typeof message === 'string' || Array.isArray(message)) {
        return message;
      }
    }
    return exception.message;
  }
}
