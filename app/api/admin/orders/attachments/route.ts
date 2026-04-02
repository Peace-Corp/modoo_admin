import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, manufacturer_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 403 });
    }

    if (!profile || (profile.role !== 'admin' && profile.role !== 'factory')) {
      return NextResponse.json({ error: '권한이 필요합니다.' }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const orderId = payload?.orderId;
    const newUrls = payload?.newUrls;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: '주문 ID가 필요합니다.' }, { status: 400 });
    }

    if (!Array.isArray(newUrls) || newUrls.length === 0 || !newUrls.every((u: unknown) => typeof u === 'string')) {
      return NextResponse.json({ error: '유효한 파일 URL 배열이 필요합니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: existing, error: fetchError } = await adminClient
      .from('orders')
      .select('attachment_urls, assigned_manufacturer_id')
      .eq('id', orderId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (profile.role === 'factory') {
      if (existing.assigned_manufacturer_id !== profile.manufacturer_id) {
        return NextResponse.json({ error: '이 주문에 대한 권한이 없습니다.' }, { status: 403 });
      }
    }

    const currentUrls: string[] = existing.attachment_urls || [];
    const merged = [...currentUrls, ...newUrls];

    const { data, error } = await adminClient
      .from('orders')
      .update({
        attachment_urls: merged,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('attachment_urls')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '첨부파일 추가에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
