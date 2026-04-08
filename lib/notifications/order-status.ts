import { sendGmailEmail } from '@/lib/gmail';

export type OrderStatus = 'payment_pending' | 'payment_completed' | 'in_production' | 'shipping' | 'delivered' | 'cancelled' | 'partially_cancelled';

interface OrderStatusNotificationParams {
  orderId: string;
  customerName: string;
  customerEmail: string;
  newStatus: OrderStatus;
  previousStatus?: string;
  trackingNumber?: string | null;
}

const STATUS_CONFIG: Record<string, { subject: string; heading: string; message: string; color: string }> = {
  payment_completed: {
    subject: '입금이 확인되었습니다',
    heading: '입금 확인 완료',
    message: '입금이 정상적으로 확인되었습니다. 디자인 검토 후 제작이 시작될 예정입니다.',
    color: '#2563eb',
  },
  in_production: {
    subject: '주문하신 상품의 제작이 시작되었습니다',
    heading: '제작 시작',
    message: '주문하신 상품의 제작이 시작되었습니다. 제작 완료 후 배송 안내를 보내드리겠습니다.',
    color: '#d97706',
  },
  shipping: {
    subject: '상품이 발송되었습니다',
    heading: '배송 시작',
    message: '주문하신 상품이 발송되었습니다.',
    color: '#7c3aed',
  },
  delivered: {
    subject: '상품이 배송 완료되었습니다',
    heading: '배송 완료',
    message: '주문하신 상품이 배송 완료되었습니다. 상품에 만족하셨다면 리뷰를 남겨주세요!',
    color: '#059669',
  },
};

const NOTIFIABLE_STATUSES = new Set(Object.keys(STATUS_CONFIG));

function shouldNotify(newStatus: string, previousStatus?: string): boolean {
  if (!NOTIFIABLE_STATUSES.has(newStatus)) return false;
  return newStatus !== previousStatus;
}

function buildStatusEmailHtml(params: OrderStatusNotificationParams): string {
  const config = STATUS_CONFIG[params.newStatus];
  if (!config) return '';

  const shortOrderId = params.orderId.slice(0, 8).toUpperCase();
  const orderUrl = `https://modoouniform.com/order/${params.orderId}`;

  const trackingHtml = params.newStatus === 'shipping' && params.trackingNumber
    ? `<div style="background:#f5f3ff;border-radius:8px;padding:14px 16px;margin:16px 0;">
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">운송장 번호</p>
        <p style="margin:0;font-size:16px;font-weight:700;color:#4c1d95;letter-spacing:0.5px;">${params.trackingNumber}</p>
      </div>`
    : '';

  return `
    <div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="text-align:center;padding:24px 0;background:#f8f9fc;">
        <img src="https://modoouniform.com/icons/modoo_logo.png" alt="모두의 유니폼" style="height:48px;" />
      </div>
      <div style="height:3px;background:${config.color};"></div>
      <div style="padding:32px 28px;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:${config.color};color:#fff;padding:8px 20px;border-radius:20px;font-size:14px;font-weight:600;">${config.heading}</div>
        </div>
        <p style="font-size:16px;color:#222;line-height:1.7;margin:0 0 8px;">
          <strong>${params.customerName}</strong>님, 안녕하세요.
        </p>
        <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 20px;">
          ${config.message}
        </p>
        ${trackingHtml}
        <div style="background:#f8f9fa;border-radius:8px;padding:14px 16px;margin:16px 0;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr>
              <td style="color:#888;padding:3px 0;width:80px;">주문번호</td>
              <td style="font-weight:600;padding:3px 0;">${shortOrderId}</td>
            </tr>
          </table>
        </div>
        <div style="text-align:center;margin:28px 0;">
          <a href="${orderUrl}" style="display:inline-block;padding:14px 32px;background-color:${config.color};color:#ffffff;border-radius:10px;font-weight:bold;font-size:14px;text-decoration:none;">주문 상세 보기</a>
        </div>
      </div>
      <div style="border-top:1px solid #e5e7eb;padding:24px 28px;background:#f8f9fc;">
        <p style="margin:0 0 2px;font-size:13px;font-weight:bold;color:#333;">MODOO UNIFORM | 모두의 유니폼</p>
        <p style="margin:0 0 2px;font-size:12px;color:#888;">서울특별시 마포구 성지3길 55, 4층</p>
        <p style="margin:0;font-size:12px;color:#888;">T. 010-8140-0621 | 카카오톡: 모두의유니폼</p>
      </div>
    </div>
  `;
}

function buildStatusEmailText(params: OrderStatusNotificationParams): string {
  const config = STATUS_CONFIG[params.newStatus];
  if (!config) return '';

  const shortOrderId = params.orderId.slice(0, 8).toUpperCase();
  const trackingLine = params.newStatus === 'shipping' && params.trackingNumber
    ? `\n운송장 번호: ${params.trackingNumber}\n`
    : '';

  return [
    `[모두의 유니폼] ${config.subject}`,
    '',
    `${params.customerName}님, 안녕하세요.`,
    config.message,
    '',
    `주문번호: ${shortOrderId}`,
    trackingLine,
    '주문 상세: https://modoouniform.com/order/' + params.orderId,
    '',
    '문의: 카카오톡 채널 "모두의유니폼" / 010-8140-0621',
  ].filter(Boolean).join('\n');
}

export async function sendOrderStatusNotification(params: OrderStatusNotificationParams): Promise<boolean> {
  if (!shouldNotify(params.newStatus, params.previousStatus)) return false;
  if (!params.customerEmail) return false;

  const config = STATUS_CONFIG[params.newStatus];
  if (!config) return false;

  try {
    return await sendGmailEmail({
      to: [{ email: params.customerEmail, name: params.customerName }],
      subject: `[모두의 유니폼] ${config.subject} (${params.orderId.slice(0, 8).toUpperCase()})`,
      text: buildStatusEmailText(params),
      html: buildStatusEmailHtml(params),
    });
  } catch (error) {
    console.error('Failed to send order status notification:', error);
    return false;
  }
}
