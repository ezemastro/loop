export class InvalidInputError extends Error {
  public code: string;
  constructor(message: string, code = "INVALID_INPUT") {
    super(message);
    this.name = "InvalidInputError";
    this.code = code;
  }
}

export class InternalServerError extends Error {
  public code: string;
  constructor(message: string, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "InternalServerError";
    this.code = code;
  }
}

export class ConflictError extends Error {
  public code: string;
  constructor(message: string, code = "CONFLICT") {
    super(message);
    this.name = "ConflictError";
    this.code = code;
  }
}

export class UnauthorizedError extends Error {
  public code: string;
  constructor(message: string, code = "UNAUTHORIZED") {
    super(message);
    this.name = "UnauthorizedError";
    this.code = code;
  }
}

export class NotFoundError extends Error {
  public code: string;
  constructor(message: string, code = "NOT_FOUND") {
    super(message);
    this.name = "NotFoundError";
    this.code = code;
  }
}

export class StepRequired extends Error {
  public code: string;
  constructor(message: string, code = "STEP_REQUIRED") {
    super(message);
    this.name = "StepRequired";
    this.code = code;
  }
}
