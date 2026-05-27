export class WhatsappNotConnectedError extends Error {
  constructor() {
    super('WhatsApp ainda não conectado');
    this.name = 'WhatsappNotConnectedError';
  }
}
