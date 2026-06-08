export function buildAccountInviteEmail(inviteUrl: string) {
  const subject = 'Приглашение управлять профилем';

  const text = [
    'Вас пригласили управлять профилем на платформе.',
    '',
    `Примите приглашение по ссылке: ${inviteUrl}`,
    '',
    'Ссылка действует ограниченное время.',
  ].join('\n');

  const html = `
    <p>Вас пригласили управлять профилем на платформе.</p>
    <p><a href="${inviteUrl}">Принять приглашение</a></p>
    <p>Если кнопка не работает, скопируйте ссылку:</p>
    <p>${inviteUrl}</p>
    <p>Ссылка действует ограниченное время.</p>
  `.trim();

  return { subject, text, html };
}
