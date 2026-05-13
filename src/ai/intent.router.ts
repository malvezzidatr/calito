import { Injectable, Logger } from '@nestjs/common';
import { Intent } from './intents';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { MealsService } from '../meals/meals.service';

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

  private async handleQueryMacro(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(jid, 'Em breve vou te mostrar esse macro! 🚧');
  }

  private async handleUpdateGoal(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(jid, 'Em breve vou atualizar seu objetivo! 🚧');
  }

  private async handleEditMeal(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(jid, 'Em breve vou editar essa refeição! 🚧');
  }

  private async handleDeleteMeal(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(jid, 'Em breve vou apagar essa refeição! 🚧');
  }

  private async handleEditLast(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(jid, 'Em breve vou corrigir seu último registro! 🚧');
  }

  private async handleDeleteLast(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(jid, 'Em breve vou apagar seu último registro! 🚧');
  }

  private async handleDeleteAccount(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(jid, 'Em breve vou cuidar da exclusão da sua conta! 🚧');
  }

  private async handleSubscribe(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(jid, 'Em breve vou te mandar o link de assinatura! 🚧');
  }

  private async handleHelp(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(jid, 'Em breve vou te explicar tudo que sei fazer! 🚧');
  }

  private async handleGreeting(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(jid, 'E aí! Bora registrar o que comeu? 🍽️');
  }

  private async handleUnknown(_phone: string, _text: string, jid: string) {
    await this.whatsapp.sendText(
      jid,
      [
        'Não entendi muito bem 🤔 Posso te ajudar com:',
        '',
        '🍽️ Registrar refeições: "almocei arroz e frango"',
        '📊 Consultar o dia/semana: "como foi meu dia?"',
        '🎯 Atualizar objetivo: "quero ganhar massa"',
        '✏️ Editar/apagar refeições: "era 1 ovo não 2"',
      ].join('\n'),
    );
  }
}
