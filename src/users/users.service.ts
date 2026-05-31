import { Injectable, Logger } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { UserPendingState } from './utils/user-states';
import {
  DELETE_ACCOUNT_CANCELLED,
  DELETE_ACCOUNT_CONFIRMATION_QUESTION,
  DELETE_ACCOUNT_SUCCESS,
  DELETE_ACCOUNT_TECH_ERROR,
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
