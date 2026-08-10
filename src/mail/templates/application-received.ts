import { escapeHtml, nl2brEscaped, renderEmailLayout } from './layout';

export type ApplicationReceivedEmailParams = {
  postTitle: string;
  applicantName: string;
  message: string;
  applicationsUrl: string;
  frontendUrl: string;
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
  const { postTitle, applicantName, message, applicationsUrl, frontendUrl } =
    params;
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

  const html = renderEmailLayout({
    frontendUrl,
    preheader: `Новый отклик от ${applicantName} на «${postTitle}»`,
    title: 'Новый отклик',
    bodyHtml: `
      <p style="margin:0 0 12px;">На ваш пост <strong>«${escapeHtml(postTitle)}»</strong> поступил новый отклик.</p>
      <p style="margin:0 0 12px;"><strong>Соискатель:</strong> ${escapeHtml(applicantName)}</p>
      <p style="margin:0 0 6px;"><strong>Сообщение:</strong></p>
      <p style="margin:0;padding:12px 14px;background-color:#f5f5f5;border-radius:12px;">${nl2brEscaped(preview)}</p>
    `.trim(),
    cta: {
      url: applicationsUrl,
      label: 'Просмотреть отклики',
    },
  });

  return { subject, text, html };
}
