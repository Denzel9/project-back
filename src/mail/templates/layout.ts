const BRAND_PRIMARY = '#4d908e';
const BRAND_BG = '#f5f5f5';
const BRAND_TEXT = '#1a1a1a';
const BRAND_MUTED = '#686868';
const BRAND_BORDER = '#e7e7e7';

export type EmailCta = {
  url: string;
  label: string;
};

export type RenderEmailLayoutParams = {
  frontendUrl: string;
  preheader: string;
  title?: string;
  bodyHtml: string;
  cta?: EmailCta;
  footerNote?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function nl2brEscaped(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function normalizeFrontendUrl(frontendUrl: string): string {
  return frontendUrl.replace(/\/$/, '');
}

export function renderEmailLayout(params: RenderEmailLayoutParams): string {
  const frontendUrl = normalizeFrontendUrl(params.frontendUrl);
  const logoUrl = `${frontendUrl}/Primary.png`;
  const preheader = escapeHtml(params.preheader);
  const title = params.title ? escapeHtml(params.title) : '';
  const footerNote = params.footerNote
    ? escapeHtml(params.footerNote)
    : 'Вы получили это письмо, потому что у вас есть аккаунт на платформе Nikssens.';
  const ctaUrl = params.cta ? escapeHtml(params.cta.url) : '';
  const ctaLabel = params.cta ? escapeHtml(params.cta.label) : '';

  const titleBlock = title
    ? `<h1 style="margin:0 0 16px;font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;font-weight:700;color:${BRAND_TEXT};">${title}</h1>`
    : '';

  const ctaBlock = params.cta
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
        <tr>
          <td align="center" bgcolor="${BRAND_PRIMARY}" style="border-radius:999px;">
            <a href="${ctaUrl}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:999px;">
              ${ctaLabel}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${BRAND_MUTED};">
        Если кнопка не работает, скопируйте ссылку:
      </p>
      <p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;word-break:break-all;">
        <a href="${ctaUrl}" style="color:${BRAND_PRIMARY};text-decoration:underline;">${ctaUrl}</a>
      </p>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title || 'Nikssens'}</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND_BG};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${preheader}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND_BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
          <tr>
            <td align="center" style="padding:0 0 20px;">
              <a href="${escapeHtml(frontendUrl)}" style="text-decoration:none;">
                <img src="${escapeHtml(logoUrl)}" width="160" alt="Nikssens" style="display:block;width:160px;max-width:60%;height:auto;border:0;" />
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border:1px solid ${BRAND_BORDER};border-radius:24px;padding:32px 28px;">
              ${titleBlock}
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${BRAND_TEXT};">
                ${params.bodyHtml}
              </div>
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 12px 0;">
              <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${BRAND_MUTED};">
                ${footerNote}
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${BRAND_MUTED};">
                <a href="${escapeHtml(frontendUrl)}" style="color:${BRAND_PRIMARY};text-decoration:none;font-weight:600;">Nikssens</a>
                ·
                <a href="mailto:support@nikssens.ru" style="color:${BRAND_PRIMARY};text-decoration:none;">support@nikssens.ru</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
