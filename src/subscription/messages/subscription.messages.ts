function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export function formatTrialStarted(trialEndsAt: Date, trialDays: number): string {
  return [
    `🎁 Seus ${trialDays} dias grátis começaram!`,
    '',
    `Você tem o Calito completo até ${formatDate(trialEndsAt)} — registra à vontade.`,
    'Quando o teste acabar eu te aviso, aí é só assinar pra continuar. Bora! 💪',
  ].join('\n');
}

export function formatTrialEndingReminder(priceBRL: number): string {
  return [
    '⏳ Seu teste grátis do Calito termina amanhã!',
    '',
    `Pra não perder o registro das suas refeições, garante a assinatura por ${formatBRL(priceBRL)}/mês.`,
    'Manda *assinar* que eu já te passo o Pix 🚀',
  ].join('\n');
}

export function formatPaywallMessage(priceBRL: number): string {
  return [
    '🔒 Seu teste grátis do Calito chegou ao fim 🙌',
    '',
    `Pra continuar registrando suas refeições, ativa a assinatura por apenas ${formatBRL(priceBRL)}/mês.`,
    'Manda *assinar* pra continuar 💪',
  ].join('\n');
}

export function formatCheckoutMessage(priceBRL: number): string {
  return [
    `💳 Assinatura do Calito: ${formatBRL(priceBRL)}/mês`,
    '',
    'Paga com Pix copiando o código que vou mandar logo abaixo 👇',
    'É só colar na opção *Pix Copia e Cola* do seu banco.',
    '',
    'Assim que o pagamento cair, eu te aviso e libero tudo na hora 🚀',
  ].join('\n');
}

export const CHECKOUT_ERROR = 'Tive um problema ao gerar o Pix 😬 Tenta de novo daqui a pouquinho?';

export const CHECKOUT_STILL_PENDING = [
  '💳 Você ainda tem um Pix em aberto!',
  '',
  'É só pagar o código abaixo 👇 que eu libero tudo na hora 🚀',
].join('\n');

export const PIX_EXPIRED_REISSUE = 'Seu Pix anterior expirou ⏱️ Gerei um novo agora, é só pagar 👇';

export function formatSubscriptionActivated(expiresAt: Date): string {
  const date = expiresAt.toLocaleDateString('pt-BR');
  return [
    '✅ Pagamento confirmado! Sua assinatura tá ativa 🎉',
    `Vale até ${date}. Bora registrar suas refeições 💪`,
  ].join('\n');
}
