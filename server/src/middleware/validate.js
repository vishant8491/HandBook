import { ZodError } from 'zod';

export function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid Request Body',
          message: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          details: err.errors,
        });
      }
      next(err);
    }
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid Query Parameters',
          message: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          details: err.errors,
        });
      }
      next(err);
    }
  };
}
