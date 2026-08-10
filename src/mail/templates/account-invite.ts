import { renderEmailLayout } from './layout';

export function buildAccountInviteEmail(
  inviteUrl: string,
  frontendUrl: string,
  logoUrl: string
) {
  const subject = 'Приглашение управлять профилем';

  const text = [
    'Вас пригласили управлять профилем на платформе.',
    '',
    `Примите приглашение по ссылке: ${inviteUrl}`,
    '',
    'Ссылка действует ограниченное время.',
  ].join('\n');

  const html = renderEmailLayout({
    frontendUrl,
    logoUrl,
    preheader: 'Вас пригласили управлять профилем на Nikssens.',
    title: 'Приглашение в команду',
    bodyHtml: `
      <p style="margin:0 0 12px;">Вас пригласили управлять профилем на платформе Nikssens.</p>
      <p style="margin:0;">Ссылка действует ограниченное время.</p>
    `.trim(),
    cta: {
      url: inviteUrl,
      label: 'Принять приглашение',
    },
  });

  return { subject, text, html };
}
