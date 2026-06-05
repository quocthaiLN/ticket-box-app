import type { NextFunction, Response } from 'express';
import type { AppRequest } from '../payment.type.js';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  value?: T;
  errors: ValidationError[];
}

type ValidatorFn<T> = (body: unknown) => ValidationResult<T>;

export function validateBody<T>(validator: ValidatorFn<T>) {
  return (req: AppRequest, _res: Response, next: NextFunction) => {
    const result = validator(req.body);

    if (result.errors.length > 0) {
      const err = Object.assign(new Error('Request body validation failed'), {
        statusCode: 400,
        code: 'INVALID_REQUEST',
        errors: result.errors,
      });
      return next(err);
    }

    req.body = result.value;
    next();
  };
}
