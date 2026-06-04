import { Injectable, Logger } from '@nestjs/common';
import { Goal } from '@prisma/client';
import { UsersRepository } from './users.repository';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { UserPendingState } from './utils/user-states';
import { matchGoal } from '../onboarding/utils/profile.match';
import { calcGoals } from '../onboarding/utils/nutrition.calculator';
import {
  DELETE_ACCOUNT_CANCELLED,
  DELETE_ACCOUNT_CONFIRMATION_QUESTION,
  DELETE_ACCOUNT_SUCCESS,
  DELETE_ACCOUNT_TECH_ERROR,
  UPDATE_GOAL_QUESTION,
  UPDATE_GOAL_NEEDS_PROFILE,
  UPDATE_GOAL_TECH_ERROR,
  formatUpdateGoalSuccess,
} from '../messages/messages/general.messages';

const DELETE_CONFIRMATION_PHRASE = 'apagar tudo';

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

  private async applyGoalChange(phone: string, goal: Goal, jid: string): Promise<void> {
    const user = await this.usersRepository.findByPhone(phone);
    if (!user) return;

    if (
      user.gender === null ||
      user.weight === null ||
      user.height === null ||
      user.age === null ||
      user.activity_level === null
    ) {
      await this.usersRepository.update(phone, { onboarding_step: null });
      await this.whatsapp.sendText(jid, UPDATE_GOAL_NEEDS_PROFILE);
      return;
    }

    const goals = calcGoals({
      gender: user.gender,
      weight: user.weight,
      height: user.height,
      age: user.age,
      activityLevel: user.activity_level,
      goal,
    });

    try {
      await this.usersRepository.update(phone, { goal, ...goals, onboarding_step: null });
    } catch (err) {
      this.logger.error(`Falha ao atualizar objetivo de ${phone}: ${(err as Error).message}`);
      await this.whatsapp.sendText(jid, UPDATE_GOAL_TECH_ERROR);
      return;
    }

    await this.whatsapp.sendText(jid, formatUpdateGoalSuccess(goal, goals));
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
