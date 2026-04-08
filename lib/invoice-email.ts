import type { InvoiceItem } from '@/types/types';

interface InvoiceEmailParams {
  invoiceNumber: string;
  date: string;
  includeVat: boolean;
  items: InvoiceItem[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  recipientOrg: string | null;
  recipientName: string | null;
  memo: string | null;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('ko-KR');
}

export function generateInvoiceEmailHtml(params: InvoiceEmailParams): string {
  const {
    invoiceNumber,
    date,
    includeVat,
    items,
    subtotal,
    vatAmount,
    totalAmount,
    recipientOrg,
    recipientName,
    memo,
  } = params;

  const recipientLines = [recipientOrg, recipientName].filter(Boolean).join(' / ');

  const itemRows = items
    .map(
      (item, i) => `
      <tr>
        <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">${i + 1}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${item.name}</td>
        <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">${item.quantity}</td>
        <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">${formatCurrency(item.unit_price)}원</td>
        <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 600;">${formatCurrency(item.amount)}원</td>
      </tr>`
    )
    .join('');

  return `
<div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; background: #ffffff;">
  <!-- Header -->
  <div style="background: #1e3a5f; color: #ffffff; padding: 24px 28px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">거 래 명 세 서</h1>
    <p style="margin: 8px 0 0; font-size: 13px; color: #cbd5e1;">${invoiceNumber} · ${date}</p>
  </div>

  <div style="border: 1px solid #e5e7eb; border-top: none; padding: 28px; border-radius: 0 0 8px 8px;">
    <!-- Supplier & Recipient Info -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="width: 50%; vertical-align: top; padding-right: 16px;">
          <p style="margin: 0 0 4px; font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">공급자</p>
          <p style="margin: 0 0 2px; font-size: 15px; color: #111827; font-weight: 700;">모두의 유니폼</p>
          <p style="margin: 0 0 2px; font-size: 13px; color: #6b7280;">상호: 피스코프</p>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">사업자등록번호: 118-08-15095</p>
        </td>
        <td style="width: 50%; vertical-align: top; padding-left: 16px;">
          <p style="margin: 0 0 4px; font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">받으시는 분</p>
          ${recipientLines ? `<p style="margin: 0; font-size: 15px; color: #111827; font-weight: 700;">${recipientLines}</p>` : '<p style="margin: 0; font-size: 14px; color: #9ca3af;">-</p>'}
        </td>
      </tr>
    </table>

    ${includeVat ? `
    <!-- VAT Badge -->
    <div style="margin-bottom: 20px;">
      <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; background: #dbeafe; color: #1d4ed8;">
        VAT 포함
      </span>
    </div>` : ''}

    <!-- Items Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="background: #f8fafc;">
          <th style="padding: 10px 12px; text-align: center; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; font-weight: 600; width: 48px;">No.</th>
          <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; font-weight: 600;">품목</th>
          <th style="padding: 10px 12px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; font-weight: 600; width: 72px;">수량</th>
          <th style="padding: 10px 12px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; font-weight: 600; width: 110px;">단가</th>
          <th style="padding: 10px 12px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-size: 12px; font-weight: 600; width: 120px;">금액</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <!-- Summary -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      ${includeVat ? `
      <tr>
        <td style="padding: 8px 12px; text-align: right; color: #6b7280; font-size: 14px;">공급가액</td>
        <td style="padding: 8px 12px; text-align: right; color: #111827; font-size: 14px; width: 140px;">${formatCurrency(subtotal)}원</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; text-align: right; color: #6b7280; font-size: 14px;">세액 (VAT)</td>
        <td style="padding: 8px 12px; text-align: right; color: #111827; font-size: 14px;">${formatCurrency(vatAmount)}원</td>
      </tr>` : ''}
      <tr style="border-top: 2px solid #1e3a5f;">
        <td style="padding: 12px; text-align: right; color: #1e3a5f; font-size: 16px; font-weight: 700;">합계금액</td>
        <td style="padding: 12px; text-align: right; color: #1e3a5f; font-size: 16px; font-weight: 700;">${formatCurrency(totalAmount)}원</td>
      </tr>
    </table>

    ${
      memo
        ? `
    <!-- Memo -->
    <div style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #9ca3af; font-weight: 600;">비고</p>
      <p style="margin: 0; font-size: 14px; color: #374151; white-space: pre-wrap;">${memo}</p>
    </div>`
        : ''
    }

    <!-- Footer -->
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
    <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">본 거래명세서는 모두의 유니폼에서 발송되었습니다.</p>
  </div>
</div>`;
}

export function generateInvoiceEmailText(params: InvoiceEmailParams): string {
  const {
    invoiceNumber,
    date,
    includeVat,
    items,
    subtotal,
    vatAmount,
    totalAmount,
    recipientOrg,
    recipientName,
    memo,
  } = params;

  const recipientLines = [recipientOrg, recipientName].filter(Boolean).join(' / ');

  const lines = [
    '===== 거래명세서 =====',
    `번호: ${invoiceNumber}`,
    `일자: ${date}`,
    '',
    '[공급자]',
    '모두의 유니폼 / 피스코프',
    '사업자등록번호: 118-08-15095',
    '',
    '[받으시는 분]',
    recipientLines || '-',
    '',
    ...(includeVat ? ['[VAT 포함]', ''] : []),
    '[항목]',
    ...items.map(
      (item, i) =>
        `${i + 1}. ${item.name} | 수량: ${item.quantity} | 단가: ${formatCurrency(item.unit_price)}원 | 금액: ${formatCurrency(item.amount)}원`
    ),
    '',
    ...(includeVat
      ? [
          `공급가액: ${formatCurrency(subtotal)}원`,
          `세액(VAT): ${formatCurrency(vatAmount)}원`,
        ]
      : []),
    `합계금액: ${formatCurrency(totalAmount)}원`,
  ];

  if (memo) {
    lines.push('', `[비고]`, memo);
  }

  lines.push('', '---', '본 거래명세서는 모두의 유니폼에서 발송되었습니다.');

  return lines.join('\n');
}
