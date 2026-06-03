import type { NextFunction, Response } from 'express';
import type { AppRequest } from '../order.type.js';
import type { ValidationResult } from '../order.schema.js';

type ValidatorFn<T> = (body: unknown) => ValidationResult<T>;

export function validateBody<T>(validator: ValidatorFn<T>) {
  return (req: AppRequest, res: Response, next: NextFunction) => {
    const result = validator(req.body);

    if (result.errors.length > 0) {
      const err = Object.assign(new Error('Request body validation failed'), {
        statusCode: 400,
        code: 'INVALID_CHECKOUT_REQUEST',
        errors: result.errors,
      });
      return next(err);
    }

    req.body = result.value;
    next();
  };
}
