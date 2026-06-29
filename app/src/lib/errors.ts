export type ValidationIssue = {
  path: string;
  message: string;
};

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly details: ValidationIssue[]
  ) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class PreconditionFailedError extends AppError {
  constructor(
    message: string,
    public readonly currentVersion?: number
  ) {
    super(412, 'PRECONDITION_FAILED', message);
  }
}
