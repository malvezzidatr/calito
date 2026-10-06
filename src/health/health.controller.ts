import { Controller, Get } from '@nestjs/common';

/**
 * Liveness simples pro healthcheck da plataforma de deploy. Não toca no banco
 * de propósito: o processo precisa continuar de pé mesmo se o Postgres piscar,
 * pra não derrubar a conexão do WhatsApp num restart desnecessário.
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }
}
