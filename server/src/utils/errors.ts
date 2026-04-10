export class AppError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// 400 Bad Request
export function badRequest(message: string, errorCode = 'bad_request'): AppError {
  return new AppError(400, errorCode, message)
}

// 401 Unauthorized
export function unauthorized(message = 'Unauthorized', errorCode = 'unauthorized'): AppError {
  return new AppError(401, errorCode, message)
}

// 403 Forbidden
export function forbidden(message = 'Forbidden', errorCode = 'forbidden'): AppError {
  return new AppError(403, errorCode, message)
}

// 404 Not Found
export function notFound(message = 'Not found', errorCode = 'not_found'): AppError {
  return new AppError(404, errorCode, message)
}

// 409 Conflict
export function conflict(message = 'Conflict', errorCode = 'conflict'): AppError {
  return new AppError(409, errorCode, message)
}

// 429 Too Many Requests
export function tooManyRequests(message = 'Too many requests', errorCode = 'rate_limit_exceeded'): AppError {
  return new AppError(429, errorCode, message)
}

// 500 Internal Server Error
export function internalError(message = 'Internal server error', errorCode = 'internal_error'): AppError {
  return new AppError(500, errorCode, message)
}
