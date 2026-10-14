import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const recipient = process.argv[2];
const apiKey = process.env.RESEND_API_KEY;
const from = process.env.REGISTRATION_EMAIL_FROM || 'JuntAPP <solicitudes@juntapp.cl>';

if (!recipient || !/^\S+@\S+\.\S+$/.test(recipient)) {
  throw new Error('Indica un correo destinatario válido.');
}
if (!apiKey) throw new Error('Falta RESEND_API_KEY.');

const directory = path.dirname(fileURLToPath(import.meta.url));
const assetDirectory = path.resolve(directory, '../../public/marketing/email');
const assetDefinitions = {
  'https://juntapp.cl/marketing/email/logo-juntapp.png': {
    filename: 'logo-juntapp.png',
    contentId: 'juntapp-logo',
  },
  'https://juntapp.cl/marketing/email/comunidad-juntapp.jpg': {
    filename: 'comunidad-juntapp.jpg',
    contentId: 'juntapp-comunidad',
  },
  'https://juntapp.cl/marketing/email/participacion-juntapp.jpg': {
    filename: 'participacion-juntapp.jpg',
    contentId: 'juntapp-participacion',
  },
};

const prototypes = [
  {
    file: 'opcion-1-comunidad.html',
    subject: '[Prototipo 1/3] La organización de tu barrio tiene un nuevo lugar 🧡',
    key: 'comunidad',
  },
  {
    file: 'opcion-2-carta-dirigente.html',
    subject: '[Prototipo 2/3] Nos contaron lo que necesitaban. JuntAPP ya está listo',
    key: 'carta',
  },
  {
    file: 'opcion-3-directo.html',
    subject: '[Prototipo 3/3] JuntAPP ya está disponible: solicita 1 mes gratis',
    key: 'directo',
  },
];

for (const prototype of prototypes) {
  let html = await readFile(path.join(directory, prototype.file), 'utf8');
  const attachments = [];

  for (const [publicUrl, asset] of Object.entries(assetDefinitions)) {
    if (!html.includes(publicUrl)) continue;
    html = html.replaceAll(publicUrl, `cid:${asset.contentId}`);
    attachments.push({
      content: (await readFile(path.join(assetDirectory, asset.filename))).toString('base64'),
      filename: asset.filename,
      content_id: asset.contentId,
    });
  }

  html = html
    .replaceAll('{{contacto_nombre}}', 'Diego')
    .replaceAll('{{unsubscribe_url}}', 'https://juntapp.cl');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json; charset=utf-8',
      'Idempotency-Key': `prototype-launch-20260820-${prototype.key}-${recipient}`,
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: prototype.subject,
      html,
      attachments,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.id) {
    throw new Error(`Resend rechazó ${prototype.file}: ${result.message || response.status}`);
  }
  console.log(`${prototype.file}: ${result.id}`);
}
