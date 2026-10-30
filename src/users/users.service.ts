import { Injectable, Logger } from '@nestjs/common';
import { ActivityLevel, Gender, Goal, User } from '@prisma/client';
import { UsersRepository } from './users.repository';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { UserPendingState } from './utils/user-states';
import { matchActivity, matchGender, matchGoal } from '../onboarding/utils/profile.match';
import { calcGoals, Goals } from '../onboarding/utils/nutrition.calculator';
import { parseDecimal, parseHeightCm, parseInteger } from '../onboarding/utils/numeric.parser';
import { MINIMUM_AGE } from '../onboarding/utils/onboarding.constants';
import { redactPhone } from '../common/utils/log-redactor';
import {
  DELETE_ACCOUNT_CANCELLED,
  DELETE_ACCOUNT_CONFIRMATION_QUESTION,
  DELETE_ACCOUNT_SUCCESS,
  DELETE_ACCOUNT_TECH_ERROR,
  UPDATE_GOAL_QUESTION,
  UPDATE_GOAL_TECH_ERROR,
  UPDATE_WEIGHT_QUESTION,
  UPDATE_WEIGHT_TECH_ERROR,
  UPDATE_HEIGHT_QUESTION,
  UPDATE_HEIGHT_TECH_ERROR,
  UPDATE_AGE_QUESTION,
  UPDATE_AGE_TECH_ERROR,
  UPDATE_GENDER_QUESTION,
  UPDATE_GENDER_TECH_ERROR,
  UPDATE_ACTIVITY_QUESTION,
  UPDATE_ACTIVITY_TECH_ERROR,
  formatUpdateGoalSuccess,
  formatWeightUpdateSuccess,
  formatHeightUpdateSuccess,
  formatAgeUpdateSuccess,
  formatGenderUpdateSuccess,
  formatActivityUpdateSuccess,
  formatGoalUpdatedKeepingTargets,
  formatWeightSavedKeepingTargets,
  formatHeightSavedKeepingTargets,
  formatAgeSavedKeepingTargets,
  formatGenderSavedKeepingTargets,
  formatActivitySavedKeepingTargets,
  formatProfile,
} from '../messages/messages/general.messages';

const DELETE_CONFIRMATION_PHRASE = 'apagar tudo';
const WEIGHT_MIN_KG = 20;
const WEIGHT_MAX_KG = 350;
const HEIGHT_MIN_CM = 100;
const HEIGHT_MAX_CM = 250;
const AGE_MAX_YEARS = 90;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly whatsapp: WhatsappService,
  ) {}

  findByPhone(phone: string) {
    return this.usersRepository.findByPhone(phone);
  }

  async viewProfile(phone: string, jid: string): Promise<void> {
    const user = await this.usersRepository.findByPhone(phone);
    if (!user) return;
    await this.whatsapp.sendText(jid, formatProfile(user));
  }

  async updateGoal(phone: string, text: string, jid: string): Promise<void> {
    const goal = matchGoal(text);
    if (goal === null) {
      await this.usersRepository.update(phone, { onboarding_step: UserPendingState.WaitingGoalChoice });
      await this.whatsapp.sendText(jid, UPDATE_GOAL_QUESTION);
      return;
    }
    await this.applyGoalChange(phone, goal, jid);
  }

  async handleGoalChoice(phone: string, text: string, jid: string): Promise<void> {
    const goal = matchGoal(text);
    if (goal === null) {
      await this.whatsapp.sendText(jid, UPDATE_GOAL_QUESTION);
      return;
    }
    await this.applyGoalChange(phone, goal, jid);
  }

  async updateWeight(phone: string, text: string, jid: string): Promise<void> {
    const weight = this.parseWeight(text);
    if (weight === null) {
      await this.usersRepository.update(phone, { onboarding_step: UserPendingState.WaitingWeightUpdate });
      await this.whatsapp.sendText(jid, UPDATE_WEIGHT_QUESTION);
      return;
    }
    await this.applyWeightChange(phone, weight, jid);
  }

  async handleWeightUpdate(phone: string, text: string, jid: string): Promise<void> {
    const weight = this.parseWeight(text);
    if (weight === null) {
      await this.whatsapp.sendText(jid, UPDATE_WEIGHT_QUESTION);
      return;
    }
    await this.applyWeightChange(phone, weight, jid);
  }

  private parseWeight(text: string): number | null {
    const weight = parseDecimal(text);
    if (weight === null || weight < WEIGHT_MIN_KG || weight > WEIGHT_MAX_KG) return null;
    return weight;
  }

  async updateHeight(phone: string, text: string, jid: string): Promise<void> {
    const height = this.parseHeight(text);
    if (height === null) {
      await this.usersRepository.update(phone, { onboarding_step: UserPendingState.WaitingHeightUpdate });
      await this.whatsapp.sendText(jid, UPDATE_HEIGHT_QUESTION);
      return;
    }
    await this.applyHeightChange(phone, height, jid);
  }

  async handleHeightUpdate(phone: string, text: string, jid: string): Promise<void> {
    const height = this.parseHeight(text);
    if (height === null) {
      await this.whatsapp.sendText(jid, UPDATE_HEIGHT_QUESTION);
      return;
    }
    await this.applyHeightChange(phone, height, jid);
  }

  private parseHeight(text: string): number | null {
    const height = parseHeightCm(text);
    if (height === null || height < HEIGHT_MIN_CM || height > HEIGHT_MAX_CM) return null;
    return height;
  }

  async updateAge(phone: string, text: string, jid: string): Promise<void> {
    const age = this.parseAge(text);
    if (age === null) {
      await this.usersRepository.update(phone, { onboarding_step: UserPendingState.WaitingAgeUpdate });
      await this.whatsapp.sendText(jid, UPDATE_AGE_QUESTION);
      return;
    }
    await this.applyAgeChange(phone, age, jid);
  }

  async handleAgeUpdate(phone: string, text: string, jid: string): Promise<void> {
    const age = this.parseAge(text);
    if (age === null) {
      await this.whatsapp.sendText(jid, UPDATE_AGE_QUESTION);
      return;
    }
    await this.applyAgeChange(phone, age, jid);
  }

  private parseAge(text: string): number | null {
    const age = parseInteger(text);
    // Correção pra quem já é usuário — não reavalia idade mínima de novo aqui
    // (feita uma vez no onboarding); só valida faixa plausível.
    if (age === null || age < MINIMUM_AGE || age > AGE_MAX_YEARS) return null;
    return age;
  }

  async updateGender(phone: string, text: string, jid: string): Promise<void> {
    const gender = matchGender(text);
    if (gender === null) {
      await this.usersRepository.update(phone, { onboarding_step: UserPendingState.WaitingGenderUpdate });
      await this.whatsapp.sendText(jid, UPDATE_GENDER_QUESTION);
      return;
    }
    await this.applyGenderChange(phone, gender, jid);
  }

  async handleGenderUpdate(phone: string, text: string, jid: string): Promise<void> {
    const gender = matchGender(text);
    if (gender === null) {
      await this.whatsapp.sendText(jid, UPDATE_GENDER_QUESTION);
      return;
    }
    await this.applyGenderChange(phone, gender, jid);
  }

  async updateActivity(phone: string, text: string, jid: string): Promise<void> {
    const activity = matchActivity(text);
    if (activity === null) {
      await this.usersRepository.update(phone, { onboarding_step: UserPendingState.WaitingActivityUpdate });
      await this.whatsapp.sendText(jid, UPDATE_ACTIVITY_QUESTION);
      return;
    }
    await this.applyActivityChange(phone, activity, jid);
  }

  async handleActivityUpdate(phone: string, text: string, jid: string): Promise<void> {
    const activity = matchActivity(text);
    if (activity === null) {
      await this.whatsapp.sendText(jid, UPDATE_ACTIVITY_QUESTION);
      return;
    }
    await this.applyActivityChange(phone, activity, jid);
  }

  private buildGoalsFor(
    user: User,
    overrides: { goal?: Goal; weight?: number; height?: number; age?: number; gender?: Gender; activityLevel?: ActivityLevel },
  ): Goals | null {
    const weight = overrides.weight ?? user.weight;
    const goal = overrides.goal ?? user.goal;
    const height = overrides.height ?? user.height;
    const age = overrides.age ?? user.age;
    const gender = overrides.gender ?? user.gender;
    const activityLevel = overrides.activityLevel ?? user.activity_level;

    if (gender === null || height === null || age === null || activityLevel === null || weight === null || goal === null) {
      return null;
    }

    return calcGoals({ gender, height, age, activityLevel, weight, goal });
  }

  private async applyGoalChange(phone: string, goal: Goal, jid: string): Promise<void> {
    const user = await this.usersRepository.findByPhone(phone);
    if (!user) return;

    const goals = this.buildGoalsFor(user, { goal });
    if (goals === null) {
      // Perfil sem dados antropométricos (ex.: veio do fluxo nutricionista):
      // não dá pra recalcular, então só registra o novo objetivo e mantém as metas.
      await this.usersRepository.update(phone, { goal, onboarding_step: null });
      await this.whatsapp.sendText(jid, formatGoalUpdatedKeepingTargets(goal));
      return;
    }

    try {
      await this.usersRepository.update(phone, { goal, ...goals, onboarding_step: null });
    } catch (err) {
      this.logger.error(`Falha ao atualizar objetivo de ${redactPhone(phone)}: ${(err as Error).message}`);
      await this.whatsapp.sendText(jid, UPDATE_GOAL_TECH_ERROR);
      return;
    }

    await this.whatsapp.sendText(jid, formatUpdateGoalSuccess(goal, goals));
  }

  private async applyWeightChange(phone: string, weight: number, jid: string): Promise<void> {
    const user = await this.usersRepository.findByPhone(phone);
    if (!user) return;

    const goals = this.buildGoalsFor(user, { weight });

    try {
      if (goals === null) {
        // Perfil sem dados pra recalcular (fluxo nutricionista): salva o peso e mantém as metas.
        await this.usersRepository.update(phone, { weight, onboarding_step: null });
        await this.whatsapp.sendText(jid, formatWeightSavedKeepingTargets(weight));
        return;
      }
      await this.usersRepository.update(phone, { weight, ...goals, onboarding_step: null });
    } catch (err) {
      this.logger.error(`Falha ao atualizar peso de ${redactPhone(phone)}: ${(err as Error).message}`);
      await this.whatsapp.sendText(jid, UPDATE_WEIGHT_TECH_ERROR);
      return;
    }

    await this.whatsapp.sendText(jid, formatWeightUpdateSuccess(weight, goals));
  }

  private async applyHeightChange(phone: string, height: number, jid: string): Promise<void> {
    const user = await this.usersRepository.findByPhone(phone);
    if (!user) return;

    const goals = this.buildGoalsFor(user, { height });

    try {
      if (goals === null) {
        await this.usersRepository.update(phone, { height, onboarding_step: null });
        await this.whatsapp.sendText(jid, formatHeightSavedKeepingTargets(height));
        return;
      }
      await this.usersRepository.update(phone, { height, ...goals, onboarding_step: null });
    } catch (err) {
      this.logger.error(`Falha ao atualizar altura de ${redactPhone(phone)}: ${(err as Error).message}`);
      await this.whatsapp.sendText(jid, UPDATE_HEIGHT_TECH_ERROR);
      return;
    }

    await this.whatsapp.sendText(jid, formatHeightUpdateSuccess(height, goals));
  }

  private async applyAgeChange(phone: string, age: number, jid: string): Promise<void> {
    const user = await this.usersRepository.findByPhone(phone);
    if (!user) return;

    const goals = this.buildGoalsFor(user, { age });

    try {
      if (goals === null) {
        await this.usersRepository.update(phone, { age, onboarding_step: null });
        await this.whatsapp.sendText(jid, formatAgeSavedKeepingTargets(age));
        return;
      }
      await this.usersRepository.update(phone, { age, ...goals, onboarding_step: null });
    } catch (err) {
      this.logger.error(`Falha ao atualizar idade de ${redactPhone(phone)}: ${(err as Error).message}`);
      await this.whatsapp.sendText(jid, UPDATE_AGE_TECH_ERROR);
      return;
    }

    await this.whatsapp.sendText(jid, formatAgeUpdateSuccess(age, goals));
  }

  private async applyGenderChange(phone: string, gender: Gender, jid: string): Promise<void> {
    const user = await this.usersRepository.findByPhone(phone);
    if (!user) return;

    const goals = this.buildGoalsFor(user, { gender });

    try {
      if (goals === null) {
        await this.usersRepository.update(phone, { gender, onboarding_step: null });
        await this.whatsapp.sendText(jid, formatGenderSavedKeepingTargets(gender));
        return;
      }
      await this.usersRepository.update(phone, { gender, ...goals, onboarding_step: null });
    } catch (err) {
      this.logger.error(`Falha ao atualizar sexo biológico de ${redactPhone(phone)}: ${(err as Error).message}`);
      await this.whatsapp.sendText(jid, UPDATE_GENDER_TECH_ERROR);
      return;
    }

    await this.whatsapp.sendText(jid, formatGenderUpdateSuccess(gender, goals));
  }

  private async applyActivityChange(phone: string, activityLevel: ActivityLevel, jid: string): Promise<void> {
    const user = await this.usersRepository.findByPhone(phone);
    if (!user) return;

    const goals = this.buildGoalsFor(user, { activityLevel });

    try {
      if (goals === null) {
        await this.usersRepository.update(phone, { activity_level: activityLevel, onboarding_step: null });
        await this.whatsapp.sendText(jid, formatActivitySavedKeepingTargets(activityLevel));
        return;
      }
      await this.usersRepository.update(phone, { activity_level: activityLevel, ...goals, onboarding_step: null });
    } catch (err) {
      this.logger.error(`Falha ao atualizar nível de atividade de ${redactPhone(phone)}: ${(err as Error).message}`);
      await this.whatsapp.sendText(jid, UPDATE_ACTIVITY_TECH_ERROR);
      return;
    }

    await this.whatsapp.sendText(jid, formatActivityUpdateSuccess(activityLevel, goals));
  }

  async requestAccountDeletion(phone: string, jid: string): Promise<void> {
    await this.usersRepository.update(phone, { onboarding_step: UserPendingState.WaitingDeleteConfirm });
    await this.whatsapp.sendText(jid, DELETE_ACCOUNT_CONFIRMATION_QUESTION);
  }

  async handleDeleteConfirmation(phone: string, text: string, jid: string): Promise<void> {
    if (this.isDeleteConfirmation(text)) {
      await this.confirmAccountDeletion(phone, jid);
      return;
    }
    await this.cancelAccountDeletion(phone, jid);
  }

  private async cancelAccountDeletion(phone: string, jid: string): Promise<void> {
    await this.usersRepository.update(phone, { onboarding_step: null });
    await this.whatsapp.sendText(jid, DELETE_ACCOUNT_CANCELLED);
  }

  private async confirmAccountDeletion(phone: string, jid: string): Promise<void> {
    try {
      await this.usersRepository.deleteByPhone(phone);
    } catch (err) {
      this.logger.error(`Falha ao deletar conta de ${redactPhone(phone)}: ${(err as Error).message}`);
      await this.whatsapp.sendText(jid, DELETE_ACCOUNT_TECH_ERROR);
      return;
    }
    await this.whatsapp.sendText(jid, DELETE_ACCOUNT_SUCCESS);
  }

  private isDeleteConfirmation(text: string): boolean {
    return text.trim().toLowerCase() === DELETE_CONFIRMATION_PHRASE;
  }
}
