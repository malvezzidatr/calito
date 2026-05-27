import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { EstimatedFoodsRepository } from './estimated-foods.repository';
import { Nutrition } from './utils/food.types';
import { UnmatchedItem } from './utils/food.calculator';
import { normalize } from './utils/food.matcher';
import { FOOD_ESTIMATE_PROMPT, FoodEstimate } from './utils/food.estimate.prompt';
import { isZeroEstimate, validateFoodEstimate } from './utils/food.estimate.validation';

export type EstimatedItemResult = {
  input:  UnmatchedItem['input'];
  source: 'cache' | 'fresh';
  estimate_per_unit: FoodEstimate;
  macros_contribution: Nutrition;
};

export type FailedEstimateReason = 'limit_exceeded' | 'ai_error' | 'unknown_food';

export type FailedItemResult = {
  input:  UnmatchedItem['input'];
  reason: FailedEstimateReason;
};

export type EstimateRunResult = {
  estimated: EstimatedItemResult[];
  failed:    FailedItemResult[];
};

const MAX_ESTIMATES_PER_CALL = 5;

@Injectable()
export class FoodEstimator {
  private readonly logger = new Logger(FoodEstimator.name);

  constructor(
    private readonly ai:   AiService,
    private readonly repo: EstimatedFoodsRepository,
  ) {}

  async estimate(unmatched: UnmatchedItem[]): Promise<EstimateRunResult> {
    if (unmatched.length === 0) {
      return { estimated: [], failed: [] };
    }

    const toProcess = unmatched.slice(0, MAX_ESTIMATES_PER_CALL);
    const overflow  = unmatched.slice(MAX_ESTIMATES_PER_CALL);

    const estimated: EstimatedItemResult[] = [];
    const failed:    FailedItemResult[]    = overflow.map((item) => ({
      input:  item.input,
      reason: 'limit_exceeded' as const,
    }));

    for (const item of toProcess) {
      const normalizedName = normalize(item.input.food);
      if (!normalizedName) {
        failed.push({ input: item.input, reason: 'unknown_food' });
        continue;
      }

      const cached = await this.repo.findByNameAndUnit(normalizedName, item.input.unit);
      if (cached) {
        const perUnit: FoodEstimate = {
          calories: cached.calories, protein: cached.protein, carbs: cached.carbs, fat: cached.fat,
        };
        if (isZeroEstimate(perUnit)) {
          this.logger.warn(`[estimator] cached-zero food=${normalizedName} unit=${item.input.unit}`);
          failed.push({ input: item.input, reason: 'unknown_food' });
          continue;
        }
        this.logger.log(`[estimator] cache-hit food=${normalizedName} unit=${item.input.unit}`);
        estimated.push({
          input: item.input,
          source: 'cache',
          estimate_per_unit:   perUnit,
          macros_contribution: scale(perUnit, item.input.quantity),
        });
        continue;
      }

      let estimate: FoodEstimate;
      try {
        const reply = await this.ai.chat(
          [{ role: 'user', content: `${item.input.food} | 1 | ${item.input.unit}` }],
          { systemPrompt: FOOD_ESTIMATE_PROMPT, responseFormat: 'json', temperature: 0.1 },
        );
        estimate = validateFoodEstimate(JSON.parse(reply));
      } catch (err) {
        this.logger.warn(`[estimator] ai-error food=${normalizedName} unit=${item.input.unit} msg=${(err as Error).message}`);
        failed.push({ input: item.input, reason: 'ai_error' });
        continue;
      }

      if (isZeroEstimate(estimate)) {
        this.logger.warn(`[estimator] unknown food=${normalizedName} unit=${item.input.unit} (AI returned all zeros)`);
        failed.push({ input: item.input, reason: 'unknown_food' });
        continue;
      }

      try {
        await this.repo.upsert({
          food_name: normalizedName,
          unit:      item.input.unit,
          calories:  estimate.calories,
          protein:   estimate.protein,
          carbs:     estimate.carbs,
          fat:       estimate.fat,
        });
      } catch (err) {
        this.logger.warn(`[estimator] cache-upsert-fail food=${normalizedName} msg=${(err as Error).message}`);
      }

      this.logger.log(`[estimator] fresh food=${normalizedName} unit=${item.input.unit} cal=${estimate.calories}`);
      estimated.push({
        input: item.input,
        source: 'fresh',
        estimate_per_unit:   estimate,
        macros_contribution: scale(estimate, item.input.quantity),
      });
    }

    return { estimated, failed };
  }
}

function scale(estimate: FoodEstimate, quantity: number): Nutrition {
  return {
    calories: estimate.calories * quantity,
    protein:  estimate.protein  * quantity,
    carbs:    estimate.carbs    * quantity,
    fat:      estimate.fat      * quantity,
  };
}
