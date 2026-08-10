export type SendEmailJobPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
  listUnsubscribeUrl?: string;
};
