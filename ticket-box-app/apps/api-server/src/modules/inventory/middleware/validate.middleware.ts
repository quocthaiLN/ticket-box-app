// Validate request body
import type { NextFunction, Response } from 'express';
import type { AppRequest } from '../inventory.type.js';
import type { ValidationResult } from '../inventory.schema.js';

type ValidatorFn<T> = (body: unknown) => ValidationResult<T>;

export function validateBody<T>(validator: ValidatorFn<T>) {
  return (req: AppRequest, res: Response, next: NextFunction) => {
    const result = validator(req.body);

    if (result.errors.length > 0) {
      const err = Object.assign(new Error('Request body validation failed'), {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        errors: result.errors,
      });
      return next(err);
    }

    req.body = result.value;
    next();
  };
}
