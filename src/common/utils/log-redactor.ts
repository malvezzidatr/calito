/**
 * Máscara pra dado pessoal em log (LGPD — minimização em registro técnico).
 * Uso provisório nos pontos que hoje logam telefone/texto de usuário; a
 * migração completa pra pino + redactor estruturado fica pro Épico 9.
 */
export function redactPhone(phoneOrJid: string): string {
  const digits = phoneOrJid.replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  return `***${digits.slice(-4)}`;
}

const MAX_LOGGED_TEXT_LENGTH = 20;

export function redactText(text: string): string {
  const clipped = text.length > MAX_LOGGED_TEXT_LENGTH ? `${text.slice(0, MAX_LOGGED_TEXT_LENGTH)}…` : text;
  return `[${text.length} chars] ${clipped}`;
}
