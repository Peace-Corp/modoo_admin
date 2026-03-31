import nodemailer from 'nodemailer';

interface GmailRecipient {
  email: string;
  name?: string;
}

interface SendGmailParams {
  to: GmailRecipient[];
  subject: string;
  text: string;
  html: string;
}

export interface FactoryAssignmentEmailParams {
  factoryName: string;
  factoryEmail: string;
  orderId: string;
  deadline: string | null;
  factoryAmount: number | null;
  customerNote: string | null;
  shareToken: string | null;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.error('Gmail environment variables (GMAIL_USER, GMAIL_APP_PASSWORD) are not configured.');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  return transporter;
}

export async function sendGmailEmail({ to, subject, text, html }: SendGmailParams): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;

  const fromName = process.env.GMAIL_FROM_NAME || '모두의 유니폼';
  const fromEmail = process.env.GMAIL_USER;

  try {
    await t.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: to.map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email)).join(', '),
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error('Gmail send failed:', error);
    return false;
  }
}

export async function sendFactoryAssignmentEmail(params: FactoryAssignmentEmailParams): Promise<boolean> {
  const {
    factoryName,
    factoryEmail,
    orderId,
    deadline,
    factoryAmount,
    customerNote,
    shareToken,
  } = params;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || '';
  const shortOrderId = orderId.slice(0, 8).toUpperCase();
  const formattedDeadline = deadline
    ? new Date(deadline).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const formattedAmount = factoryAmount != null
    ? factoryAmount.toLocaleString('ko-KR') + '원'
    : null;

  const orderLink = shareToken && appUrl
    ? `${appUrl}/shared/order/${shareToken}`
    : null;

  const subject = `[모두의 유니폼] 새로운 주문이 배정되었습니다 (${shortOrderId})`;

  const text = [
    `안녕하세요, ${factoryName}님.`,
    '',
    `새로운 주문(${shortOrderId})이 귀사에 배정되었습니다.`,
    '',
    formattedDeadline ? `납기일: ${formattedDeadline}` : null,
    formattedAmount ? `공장 금액: ${formattedAmount}` : null,
    customerNote ? `고객 메모: ${customerNote}` : null,
    '',
    orderLink ? `주문 상세 보기: ${orderLink}` : null,
    '',
    '감사합니다.',
    '모두의 유니폼',
  ].filter((line) => line !== null).join('\n');

  const html = `
    <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #2563eb; color: #fff; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">새로운 주문이 배정되었습니다</h2>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px; color: #374151;">안녕하세요, <strong>${factoryName}</strong>님.</p>
        <p style="margin: 0 0 20px; color: #374151;">새로운 주문이 귀사에 배정되었습니다. 아래 내용을 확인해 주세요.</p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 12px; color: #6b7280; font-size: 14px; width: 120px;">주문 번호</td>
            <td style="padding: 10px 12px; color: #111827; font-size: 14px; font-weight: 600;">${shortOrderId}</td>
          </tr>
          ${formattedDeadline ? `
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 12px; color: #6b7280; font-size: 14px;">납기일</td>
            <td style="padding: 10px 12px; color: #111827; font-size: 14px;">${formattedDeadline}</td>
          </tr>` : ''}
          ${formattedAmount ? `
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 12px; color: #6b7280; font-size: 14px;">공장 금액</td>
            <td style="padding: 10px 12px; color: #111827; font-size: 14px;">${formattedAmount}</td>
          </tr>` : ''}
          ${customerNote ? `
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 12px; color: #6b7280; font-size: 14px;">고객 메모</td>
            <td style="padding: 10px 12px; color: #111827; font-size: 14px;">${customerNote}</td>
          </tr>` : ''}
        </table>

        ${orderLink ? `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${orderLink}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">주문 상세 보기</a>
        </div>` : ''}

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">본 메일은 모두의 유니폼에서 자동 발송된 알림 메일입니다.</p>
      </div>
    </div>
  `;

  return sendGmailEmail({
    to: [{ email: factoryEmail, name: factoryName }],
    subject,
    text,
    html,
  });
}
