import { ValidationError } from '../../common/errors/validation.error';

export class InvalidNutritionistGoalsError extends ValidationError {
  constructor(reason: string) {
    super(`Invalid nutritionist goals: ${reason}`);
    this.name = 'InvalidNutritionistGoalsError';
  }
}

export class InvalidNutritionistProfileError extends ValidationError {
  constructor(reason: string) {
    super(`Invalid nutritionist profile: ${reason}`);
    this.name = 'InvalidNutritionistProfileError';
  }
}
