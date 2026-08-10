import { renderEmailLayout } from './layout';

export function buildEmailConfirmEmail(
  confirmUrl: string,
  frontendUrl: string
) {
  const subject = 'Подтверждение почты';

  const text = [
    'Подтвердите почту, чтобы получить полный доступ к сервису.',
    '',
    `Перейдите по ссылке: ${confirmUrl}`,
    '',
    'Ссылка действует ограниченное время. Если вы не регистрировались, проигнорируйте это письмо.',
  ].join('\n');

  const html = renderEmailLayout({
    frontendUrl,
    preheader: 'Подтвердите почту, чтобы получить полный доступ к Nikssens.',
    title: 'Подтверждение почты',
    bodyHtml: `
      <p style="margin:0 0 12px;">Подтвердите почту, чтобы получить полный доступ к сервису.</p>
      <p style="margin:0;">Ссылка действует ограниченное время. Если вы не регистрировались, проигнорируйте это письмо.</p>
    `.trim(),
    cta: {
      url: confirmUrl,
      label: 'Подтвердить почту',
    },
  });

  return { subject, text, html };
}
