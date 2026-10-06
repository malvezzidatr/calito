import {
  Controller,
  Get,
  Headers,
  Header,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { WhatsappService } from './whatsapp.service';

const QR_PAGE = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Parear WhatsApp · Calito</title>
    <style>
      body{font:16px system-ui,sans-serif;background:#f4f5f7;color:#18212b;display:grid;place-items:center;min-height:100vh;margin:0}
      main{background:white;padding:28px;border-radius:16px;box-shadow:0 8px 32px #15202b18;text-align:center;width:min(90vw,420px)}
      h1{font-size:1.35rem;margin:0 0 8px}p{color:#526171;line-height:1.5}
      input,button{font:inherit;padding:12px;border-radius:8px;width:100%;box-sizing:border-box}
      input{border:1px solid #b8c2cc;margin:12px 0}button{border:0;background:#176b50;color:white;font-weight:600;cursor:pointer}
      img{display:none;width:min(100%,360px);height:auto;margin:20px auto 0;image-rendering:pixelated}
      #status{min-height:24px;font-size:.9rem}
    </style>
  </head>
  <body><main>
    <h1>Parear o WhatsApp do Calito</h1>
    <p>Digite o token configurado em <code>WHATSAPP_QR_ACCESS_TOKEN</code>. Depois, escaneie o QR em WhatsApp → Aparelhos conectados.</p>
    <form id="form"><input id="token" type="password" autocomplete="current-password" placeholder="Token de acesso" required><button>Mostrar QR Code</button></form>
    <p id="status" role="status"></p><img id="qr" alt="QR Code de pareamento do WhatsApp">
  </main>
  <script>
    const form=document.querySelector('#form'),token=document.querySelector('#token'),status=document.querySelector('#status'),img=document.querySelector('#qr');let oldUrl,timer;
    async function refreshQr(){try{const response=await fetch('/whatsapp/qr/image',{headers:{Authorization:'Bearer '+token.value},cache:'no-store'});if(response.status===404){status.textContent='Aguardando QR do WhatsApp…';img.style.display='none';return}if(response.status===401){clearInterval(timer);throw new Error('Token inválido.')}if(!response.ok)throw new Error('Não foi possível carregar o QR.');const blob=await response.blob();if(oldUrl)URL.revokeObjectURL(oldUrl);oldUrl=URL.createObjectURL(blob);img.src=oldUrl;img.style.display='block';status.textContent='QR atualizado. Escaneie enquanto ele estiver válido.'}catch(error){status.textContent=error.message}}
    form.addEventListener('submit',event=>{event.preventDefault();clearInterval(timer);status.textContent='Carregando QR…';refreshQr();timer=setInterval(refreshQr,5000)});
  </script></body>
</html>`;

// qrcode-terminal already bundles this encoder; rendering its matrix as SVG
// avoids terminal ANSI/Unicode rendering, which mangles QR codes in hosted logs.
const QRCode = require('qrcode-terminal/vendor/QRCode');
const QR_ERROR_CORRECT_LEVEL = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

function toSvg(value: string): string {
  const code = new QRCode(-1, QR_ERROR_CORRECT_LEVEL.M);
  code.addData(value);
  code.make();

  const quietZone = 4;
  const size = code.getModuleCount() + quietZone * 2;
  const darkModules: string[] = [];

  code.modules.forEach((row: boolean[], y: number) => {
    row.forEach((isDark: boolean, x: number) => {
      if (isDark) darkModules.push(`M${x + quietZone},${y + quietZone}h1v1h-1z`);
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${size}v${size}H0z"/><path fill="#000" d="${darkModules.join('')}"/></svg>`;
}

@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly config: ConfigService,
  ) {}

  @Get('qr')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  pairingPage(): string {
    return QR_PAGE;
  }

  @Get('qr/image')
  @Header('Content-Type', 'image/svg+xml; charset=utf-8')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  pairingImage(@Headers('authorization') authorization?: string): string {
    const expectedToken = this.config.get<string>('WHATSAPP_QR_ACCESS_TOKEN');
    if (!expectedToken) {
      throw new NotFoundException('Visualização do QR não configurada.');
    }

    const providedToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';
    const expected = Buffer.from(expectedToken);
    const provided = Buffer.from(providedToken);
    if (
      expected.length !== provided.length ||
      !timingSafeEqual(expected, provided)
    ) {
      throw new UnauthorizedException('Token de acesso inválido.');
    }

    const qr = this.whatsapp.getPairingQr();
    if (!qr) {
      throw new NotFoundException('Ainda não há QR disponível para pareamento.');
    }

    return toSvg(qr);
  }
}
