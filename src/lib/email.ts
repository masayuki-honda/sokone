import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS = process.env.EMAIL_FROM || "Sokone <noreply@sokone.app>";

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

/**
 * Send an email notification via Resend.
 * Silently skips if RESEND_API_KEY is not configured.
 */
export async function sendEmail({ to, subject, body }: SendEmailParams) {
  if (!resend) {
    console.warn("RESEND_API_KEY is not set — skipping email");
    return null;
  }

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html: buildHtml(subject, body),
  });

  if (error) {
    console.error("Email send failed:", error);
    return null;
  }

  return data;
}

function buildHtml(subject: string, body: string) {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="color:#16a34a;margin-bottom:16px">${escapeHtml(subject)}</h2>
  <p style="font-size:15px;line-height:1.6">${escapeHtml(body)}</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:12px;color:#9ca3af">
    このメールは Sokone（底値）からの自動通知です。<br>
    通知設定は <a href="${process.env.NEXTAUTH_URL || ""}/notifications/settings">こちら</a> から変更できます。
  </p>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
