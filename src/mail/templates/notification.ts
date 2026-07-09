export type NotificationEmailParams = {
  title: string;
  body?: string | null;
  actionUrl: string;
};

export function buildNotificationEmail(params: NotificationEmailParams) {
  const { title, body, actionUrl } = params;
  const subject = title;

  const textParts = [title];

  if (body) {
    textParts.push('', body);
  }

  textParts.push('', `Открыть: ${actionUrl}`);

  const text = textParts.join('\n');

  const htmlBody = body
    ? `<p>${body.replace(/\n/g, '<br>')}</p>`
    : '';

  const html = `
    <p><strong>${title}</strong></p>
    ${htmlBody}
    <p><a href="${actionUrl}">Открыть</a></p>
    <p>Если кнопка не работает, скопируйте ссылку:</p>
    <p>${actionUrl}</p>
  `.trim();

  return { subject, text, html };
}
