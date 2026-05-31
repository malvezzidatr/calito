import { Injectable, Logger } from '@nestjs/common';
import { Intent } from '../ai/intents';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { MealsService } from '../meals/meals.service';
import { HELP_MESSAGE, UNKNOWN_VARIANTS } from './messages/general.messages';
import { pickGreeting } from './utils/greeting.picker';
import { pickRandom } from '../common/utils/pick-random';

type IntentHandler = (_phone: string, _text: string, jid: string) => Promise<void>;

@Injectable()
export class IntentRouter {
  private readonly logger = new Logger(IntentRouter.name);
  private readonly handlers: Record<Intent, IntentHandler>;

  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly meals: MealsService,
) {
    this.handlers = {
      register_meal:  this.handleRegisterMeal.bind(this),
      query_daily:    this.handleQueryDaily.bind(this),
      query_period:   this.handleQueryPeriod.bind(this),
      query_macro:    this.handleQueryMacro.bind(this),
      list_meals:     this.handleListMeals.bind(this),
      update_goal:    this.handleUpdateGoal.bind(this),
      edit_meal:      this.handleEditMeal.bind(this),
      delete_meal:    this.handleDeleteMeal.bind(this),
      edit_last:      this.handleEditLast.bind(this),
      delete_last:    this.handleDeleteLast.bind(this),
      delete_account: this.handleDeleteAccount.bind(this),
      subscribe:      this.handleSubscribe.bind(this),
      help:           this.handleHelp.bind(this),
      greeting:       this.handleGreeting.bind(this),
      unknown:        this.handleUnknown.bind(this),
    };
  }

  async route(intent: Intent, phone: string, text: string, jid: string): Promise<void> {
    const handler = this.handlers[intent];
    this.logger.log(`Routing intent=${intent} phone=${phone}`);
    await handler(phone, text, jid);
  }

  private async handleRegisterMeal(phone: string, text: string, jid: string) {
    await this.meals.register(phone, text, jid);
  }

  private async handleQueryDaily(phone: string, _text: string, jid: string) {
    await this.meals.dailyResume(phone, jid);
  }

  private async handleQueryPeriod(phone: string, _text: string, jid: string) {
    await this.meals.weeklyResume(phone, jid);
  }

  private async handleQueryMacro(phone: string, text: string, jid: string) {
    await this.meals.macroResume(phone, text, jid);
  }

  private async handleListMeals(phone: string, _text: string, jid: string) {
    await this.meals.listMeals(phone, jid);
  }

  private async handleUpdateGoal(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(jid, 'Em breve vou atualizar seu objetivo! 🚧');
  }

  private async handleEditMeal(phone: string, text: string, jid: string) {
    await this.meals.editMeal(phone, text, jid);
  }

  private async handleDeleteMeal(phone: string, text: string, jid: string) {
    await this.meals.deleteMeal(phone, text, jid);
  }

  private async handleEditLast(phone: string, text: string, jid: string) {
    await this.meals.editLast(phone, text, jid);
  }

  private async handleDeleteLast(phone: string, _text: string, jid: string) {
    await this.meals.deleteLast(phone, jid);
  }

  private async handleDeleteAccount(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(jid, 'Em breve vou cuidar da exclusão da sua conta! 🚧');
  }

  private async handleSubscribe(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(jid, 'Em breve vou te mandar o link de assinatura! 🚧');
  }

  private async handleHelp(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(jid, HELP_MESSAGE);
  }

  private async handleGreeting(_phone: string, text: string, jid: string) {
    await this.whatsapp.sendText(jid, pickGreeting(text, new Date()));
  }

  private async handleUnknown(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(jid, pickRandom(UNKNOWN_VARIANTS));
  }
}
