import { ValidationError } from '../../common/errors/validation.error';

export class InvalidMealExtractionError extends ValidationError {
  constructor(reason: string) {
    super(`Invalid meal extraction: ${reason}`);
    this.name = 'InvalidMealExtractionError';
  }
}

export class InvalidMealReferenceError extends ValidationError {
  constructor(reason: string) {
    super(`Invalid meal reference: ${reason}`);
    this.name = 'InvalidMealReferenceError';
  }
}

export class InvalidMealParserError extends ValidationError {
  constructor(reason: string) {
    super(`Invalid meal parser payload: ${reason}`);
    this.name = 'InvalidMealParserError';
  }
}
