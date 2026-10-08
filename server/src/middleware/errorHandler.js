export function errorHandler(err, req, res, _next) {
  console.error(`[Error] ${req.method} ${req.url} - ${err.message}`);

  // Mongoose validation or duplicate key errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate Record',
      message: 'A record with this domain or unique identifier already exists.',
    });
  }

  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  return res.status(statusCode).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.',
  });
}
