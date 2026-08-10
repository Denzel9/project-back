import { nl2brEscaped, renderEmailLayout } from './layout';

export type NotificationEmailParams = {
  title: string;
  body?: string | null;
  actionUrl: string;
  frontendUrl: string;
  logoUrl: string;
};

export function buildNotificationEmail(params: NotificationEmailParams) {
  const { title, body, actionUrl, frontendUrl, logoUrl } = params;
  const subject = title;

  const textParts = [title];

  if (body) {
    textParts.push('', body);
  }

  textParts.push('', `Открыть: ${actionUrl}`);

  const text = textParts.join('\n');

  const htmlBody = body
    ? `<p style="margin:0;">${nl2brEscaped(body)}</p>`
    : `<p style="margin:0;">Откройте Nikssens, чтобы посмотреть подробности.</p>`;

  const html = renderEmailLayout({
    frontendUrl,
    logoUrl,
    preheader: body?.trim() || title,
    title,
    bodyHtml: htmlBody,
    cta: {
      url: actionUrl,
      label: 'Открыть',
    },
    notificationSettingsUrl: `${frontendUrl.replace(/\/$/, '')}/settings/notification`,
  });

  return { subject, text, html };
}
