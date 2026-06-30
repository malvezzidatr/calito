import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment.service';
import { TrialReminderService } from './trial-reminder.service';
import { RenewalReminderService } from './renewal-reminder.service';
import { MercadoPagoWebhookController } from './mercadopago.webhook.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [WhatsappModule, UsersModule],
  controllers: [MercadoPagoWebhookController],
  providers: [SubscriptionService, PaymentService, TrialReminderService, RenewalReminderService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
