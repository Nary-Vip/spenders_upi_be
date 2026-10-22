import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

describe('AllExceptionsFilter', () => {
  const reply = vi.fn();
  const response = {};
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  const filter = new AllExceptionsFilter({
    httpAdapter: { reply },
  } as unknown as HttpAdapterHost);

  beforeEach(() => {
    reply.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats an HttpException with a string message', () => {
    filter.catch(new NotFoundException('Payment not found'), host);

    expect(reply).toHaveBeenCalledWith(
      response,
      { statusCode: 404, error: 'Not Found', message: 'Payment not found' },
      404,
    );
  });

  it('keeps the list of messages from validation errors', () => {
    filter.catch(
      new BadRequestException(['name must be a string', 'icon is required']),
      host,
    );

    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 400,
        error: 'Bad Request',
        message: ['name must be a string', 'icon is required'],
      },
      400,
    );
  });

  it('uses the HTTP status name as error even for custom bodies', () => {
    filter.catch(
      new ConflictException({ message: 'Invalid transition', extra: 1 }),
      host,
    );

    expect(reply).toHaveBeenCalledWith(
      response,
      { statusCode: 409, error: 'Conflict', message: 'Invalid transition' },
      409,
    );
  });

  it('hides unknown errors behind a generic 500 and logs them', () => {
    const logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const error = new Error('password=hunter2 leaked');

    filter.catch(error, host);

    expect(logError).toHaveBeenCalledWith(error);

    expect(reply).toHaveBeenCalledWith(
      response,
      {
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
      },
      500,
    );
  });
});
