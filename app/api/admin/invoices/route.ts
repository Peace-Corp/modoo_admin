import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendGmailEmail, type GmailAttachment } from '@/lib/gmail';
import {
  generateInvoiceEmailHtml,
  generateInvoiceEmailText,
} from '@/lib/invoice-email';
import type { InvoiceItem } from '@/types/types';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin') {
    return { error: NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 }) };
  }

  return { user };
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `INV-${y}${m}${d}-${rand}`;
}

export async function GET(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    const adminClient = createAdminClient();

    const { count } = await adminClient
      .from('invoices')
      .select('*', { count: 'exact', head: true });

    const { data, error } = await adminClient
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], total: count || 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '거래명세서 목록을 불러오지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const payload = await request.json().catch(() => null);
    if (!payload) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const {
      include_vat,
      items,
      recipient_org,
      recipient_name,
      recipient_email,
      memo,
      attach_business_registration,
      attach_bank_account,
    } = payload as {
      include_vat: boolean;
      items: InvoiceItem[];
      recipient_org?: string;
      recipient_name?: string;
      recipient_email: string;
      memo?: string;
      attach_business_registration?: boolean;
      attach_bank_account?: boolean;
    };

    if (!recipient_email || typeof recipient_email !== 'string') {
      return NextResponse.json({ error: '이메일 주소가 필요합니다.' }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: '최소 1개 이상의 항목이 필요합니다.' }, { status: 400 });
    }

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const vatAmount = include_vat ? Math.round(subtotal * 0.1) : 0;
    const totalAmount = subtotal + vatAmount;
    const invoiceNumber = generateInvoiceNumber();
    const now = new Date();

    const adminClient = createAdminClient();
    const { data: invoice, error: insertError } = await adminClient
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        include_vat: !!include_vat,
        items,
        subtotal,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        recipient_org: recipient_org?.trim() || null,
        recipient_name: recipient_name?.trim() || null,
        recipient_email: recipient_email.trim(),
        memo: memo?.trim() || null,
        sent_at: now.toISOString(),
        created_at: now.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const dateStr = now.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const emailParams = {
      invoiceNumber,
      date: dateStr,
      includeVat: !!include_vat,
      items,
      subtotal,
      vatAmount,
      totalAmount,
      recipientOrg: recipient_org?.trim() || null,
      recipientName: recipient_name?.trim() || null,
      memo: memo?.trim() || null,
    };

    const html = generateInvoiceEmailHtml(emailParams);
    const text = generateInvoiceEmailText(emailParams);

    const attachments: GmailAttachment[] = [];
    const docTypesToAttach: string[] = [];
    if (attach_business_registration) docTypesToAttach.push('business_registration');
    if (attach_bank_account) docTypesToAttach.push('bank_account');

    if (docTypesToAttach.length > 0) {
      const { data: docs } = await adminClient
        .from('admin_documents')
        .select('doc_type, file_name, file_url')
        .in('doc_type', docTypesToAttach);

      if (docs) {
        for (const doc of docs) {
          try {
            const res = await fetch(doc.file_url);
            if (res.ok) {
              const buffer = Buffer.from(await res.arrayBuffer());
              attachments.push({
                filename: doc.file_name,
                content: buffer,
                contentType: res.headers.get('content-type') || undefined,
              });
            }
          } catch {
            console.error(`Failed to download attachment: ${doc.file_name}`);
          }
        }
      }
    }

    const emailSent = await sendGmailEmail({
      to: [{ email: recipient_email.trim(), name: recipient_name?.trim() }],
      subject: `[모두의 유니폼] 거래명세서 (${invoiceNumber})`,
      html,
      text,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (!emailSent) {
      return NextResponse.json(
        { data: invoice, warning: '거래명세서가 저장되었으나 이메일 발송에 실패했습니다.' },
        { status: 200 }
      );
    }

    return NextResponse.json({ data: invoice });
  } catch (error) {
    const message = error instanceof Error ? error.message : '거래명세서 발송에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
