import { Injectable, Logger } from '@nestjs/common';
import { Goal, User } from '@prisma/client';
import { UsersRepository } from './users.repository';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { UserPendingState } from './utils/user-states';
import { matchGoal } from '../onboarding/utils/profile.match';
import { calcGoals, Goals } from '../onboarding/utils/nutrition.calculator';
import { parseDecimal } from '../onboarding/utils/numeric.parser';
import {
  DELETE_ACCOUNT_CANCELLED,
  DELETE_ACCOUNT_CONFIRMATION_QUESTION,
  DELETE_ACCOUNT_SUCCESS,
  DELETE_ACCOUNT_TECH_ERROR,
  UPDATE_GOAL_QUESTION,
  UPDATE_GOAL_TECH_ERROR,
  UPDATE_WEIGHT_QUESTION,
  UPDATE_WEIGHT_TECH_ERROR,
  formatUpdateGoalSuccess,
  formatWeightUpdateSuccess,
  formatGoalUpdatedKeepingTargets,
  formatWeightSavedKeepingTargets,
  formatProfile,
} from '../messages/messages/general.messages';

const DELETE_CONFIRMATION_PHRASE = 'apagar tudo';
const WEIGHT_MIN_KG = 20;
const WEIGHT_MAX_KG = 350;

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

  private buildGoalsFor(user: User, overrides: { goal?: Goal; weight?: number }): Goals | null {
    const weight = overrides.weight ?? user.weight;
    const goal = overrides.goal ?? user.goal;

    if (
      user.gender === null ||
      user.height === null ||
      user.age === null ||
      user.activity_level === null ||
      weight === null ||
      goal === null
    ) {
      return null;
    }

    return calcGoals({
      gender: user.gender,
      height: user.height,
      age: user.age,
      activityLevel: user.activity_level,
      weight,
      goal,
    });
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
      this.logger.error(`Falha ao atualizar objetivo de ${phone}: ${(err as Error).message}`);
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
      this.logger.error(`Falha ao atualizar peso de ${phone}: ${(err as Error).message}`);
      await this.whatsapp.sendText(jid, UPDATE_WEIGHT_TECH_ERROR);
      return;
    }

    await this.whatsapp.sendText(jid, formatWeightUpdateSuccess(weight, goals));
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
      this.logger.error(`Falha ao deletar conta de ${phone}: ${(err as Error).message}`);
      await this.whatsapp.sendText(jid, DELETE_ACCOUNT_TECH_ERROR);
      return;
    }
    await this.whatsapp.sendText(jid, DELETE_ACCOUNT_SUCCESS);
  }

  private isDeleteConfirmation(text: string): boolean {
    return text.trim().toLowerCase() === DELETE_CONFIRMATION_PHRASE;
  }
}
