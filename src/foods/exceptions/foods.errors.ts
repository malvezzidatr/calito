import { ValidationError } from '../../common/errors/validation.error';

export class InvalidFoodEntryError extends ValidationError {
  constructor(reason: string) {
    super(`Invalid food entry: ${reason}`);
    this.name = 'InvalidFoodEntryError';
  }
}

export class InvalidFoodEstimateError extends ValidationError {
  constructor(reason: string) {
    super(`Invalid food estimate: ${reason}`);
    this.name = 'InvalidFoodEstimateError';
  }
}
