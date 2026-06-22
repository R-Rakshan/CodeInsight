class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const formatErrorResponse = (message, code, details = null) => ({
  success: false,
  error: {
    message,
    code,
    ...(details && details.length > 0 ? { details } : {}),
  },
});

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Internal Server Error';
  let details = err.details || null;

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'AUTH_ERROR';
    message = 'Invalid or malformed authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'AUTH_ERROR';
    message = 'Authentication token has expired';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid JSON in request body';
  } else if (err.code === '23505') {
    statusCode = 409;
    code = 'CONFLICT_ERROR';
    message = 'A record with this value already exists';
  } else if (err.code === '22P02') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid data format';
  }

  if (statusCode >= 500) {
    console.error(`[ErrorHandler] ${code} (${statusCode}):`, message);
    console.error('[ErrorHandler] Stack:', err.stack);
  } else {
    console.warn(`[ErrorHandler] ${code} (${statusCode}):`, message);
  }

  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'Server error, please try again';
  }

  const response = formatErrorResponse(message, code, details);

  if (process.env.NODE_ENV === 'development' && statusCode >= 500) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
module.exports.AppError = AppError;
module.exports.formatErrorResponse = formatErrorResponse;
