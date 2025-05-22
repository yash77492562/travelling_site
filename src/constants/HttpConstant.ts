import { HttpStatus } from '@nestjs/common';
export const Status = {
  STATUS_TRUE: true,
  STATUS_FALSE: false,
};

export const StatusCode = {
  HTTP_CREATED: HttpStatus.CREATED,
  HTTP_OK: HttpStatus.OK,
  HTTP_BAD_REQUEST: HttpStatus.BAD_REQUEST,
  HTTP_VALIDATION: 405,
  HTTP_NOT_FOUND: HttpStatus.NOT_FOUND,
  HTTP_UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  HTTP_CONFLICT: HttpStatus.CONFLICT,
  HTTP_TOKEN_EXPIRED: 403,
  HTTP_VALIDATION_ERROR: 422,
  HTTP_INVALID_REQUEST: 400,
  HTTP_TOO_MANY_REQUESTS: HttpStatus.TOO_MANY_REQUESTS,
  HTTP_INTERNAL_SERVER_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
  HTTP_VALIDATION_EMAIL_VARIFIED: HttpStatus.OK,
};

export const StatusMessage = {
  HTTP_CREATED: 'Created',
  HTTP_OK: 'Success',
  HTTP_BAD_REQUEST: 'Bad Request.',
  HTTP_VALIDATION: 'Enter correct details.',
  HTTP_NOT_FOUND: 'Not Found.',
  HTTP_UNAUTHORIZED: 'Unauthorized.',
  HTTP_CONFLICT: 'Conflict error occurred.',
  HTTP_TOKEN_EXPIRED: 'The access token expired.',
  HTTP_VALIDATION_ERROR: 'Validation error occurred.',
  HTTP_VALIDATION_LOGIN_PASSWORD: 'Invalid email address or password.',
  HTTP_TOO_MANY_REQUESTS:
    'Too many requests. Please try again in a few minutes.',
  HTTP_INTERNAL_SERVER_ERROR: 'Internal Server Error.',
};
