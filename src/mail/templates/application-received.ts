export type ApplicationReceivedEmailParams = {
  postTitle: string;
  applicantName: string;
  message: string;
  applicationsUrl: string;
};

function truncateMessage(message: string, maxLength = 200): string {
  if (message.length <= maxLength) {
    return message;
  }

  return `${message.slice(0, maxLength).trimEnd()}…`;
}

export function buildApplicationReceivedEmail(
  params: ApplicationReceivedEmailParams
) {
  const { postTitle, applicantName, message, applicationsUrl } = params;
  const preview = truncateMessage(message);
  const subject = `Новый отклик на пост «${postTitle}»`;

  const text = [
    `На ваш пост «${postTitle}» поступил новый отклик.`,
    '',
    `Соискатель: ${applicantName}`,
    '',
    'Сообщение:',
    preview,
    '',
    `Просмотреть отклики: ${applicationsUrl}`,
  ].join('\n');

  const html = `
    <p>На ваш пост <strong>«${postTitle}»</strong> поступил новый отклик.</p>
    <p><strong>Соискатель:</strong> ${applicantName}</p>
    <p><strong>Сообщение:</strong></p>
    <p>${preview.replace(/\n/g, '<br>')}</p>
    <p><a href="${applicationsUrl}">Просмотреть входящие отклики</a></p>
    <p>Если кнопка не работает, скопируйте ссылку:</p>
    <p>${applicationsUrl}</p>
  `.trim();

  return { subject, text, html };
}
