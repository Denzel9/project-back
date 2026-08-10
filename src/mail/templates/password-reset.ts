import { renderEmailLayout } from './layout';

export function buildPasswordResetEmail(
  resetUrl: string,
  frontendUrl: string,
  logoUrl: string
) {
  const subject = 'Сброс пароля';

  const text = [
    'Вы запросили сброс пароля.',
    '',
    `Перейдите по ссылке, чтобы задать новый пароль: ${resetUrl}`,
    '',
    'Ссылка действует ограниченное время. Если вы не запрашивали сброс, проигнорируйте это письмо.',
  ].join('\n');

  const html = renderEmailLayout({
    frontendUrl,
    logoUrl,
    preheader: 'Задайте новый пароль для аккаунта Nikssens.',
    title: 'Сброс пароля',
    bodyHtml: `
      <p style="margin:0 0 12px;">Вы запросили сброс пароля.</p>
      <p style="margin:0;">Ссылка действует ограниченное время. Если вы не запрашивали сброс, проигнорируйте это письмо.</p>
    `.trim(),
    cta: {
      url: resetUrl,
      label: 'Задать новый пароль',
    },
  });

  return { subject, text, html };
}
