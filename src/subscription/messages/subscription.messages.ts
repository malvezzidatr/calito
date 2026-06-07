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
