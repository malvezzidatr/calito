function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export function formatPaywallMessage(priceBRL: number): string {
  return [
    '🔒 Pra continuar usando o Calito você precisa de uma assinatura ativa.',
    '',
    `Por apenas ${formatBRL(priceBRL)}/mês você libera tudo 💪`,
    'Manda *assinar* pra ativar.',
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

export function formatSubscriptionActivated(expiresAt: Date): string {
  const date = expiresAt.toLocaleDateString('pt-BR');
  return [
    '✅ Pagamento confirmado! Sua assinatura tá ativa 🎉',
    `Vale até ${date}. Bora registrar suas refeições 💪`,
  ].join('\n');
}
