import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(request: Request) {
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
      .select('role, factory_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 403 });
    }

    if (!profile || (profile.role !== 'admin' && profile.role !== 'factory')) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'all';
    const factoryId = url.searchParams.get('factoryId');

    const adminClient = createAdminClient();
    let query = adminClient.from('orders').select('*').order('created_at', { ascending: false });

    if (profile.role === 'factory') {
      if (!profile.factory_id) {
        return NextResponse.json({ data: [] });
      }
      query = query.eq('assigned_factory_id', profile.factory_id);
    } else if (profile.role === 'admin' && factoryId) {
      query = query.eq('assigned_factory_id', factoryId);
    }

    if (status !== 'all') {
      query = query.eq('order_status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '주문 데이터를 불러오지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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
      .select('role, factory_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 403 });
    }

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const orderId = payload?.orderId;
    const factoryId = payload?.factoryId ?? null;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: '주문 ID가 필요합니다.' }, { status: 400 });
    }

    if (factoryId !== null && typeof factoryId !== 'string') {
      return NextResponse.json({ error: '공장 ID 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    if (factoryId !== null) {
      const { data: factory, error: factoryError } = await adminClient
        .from('factories')
        .select('id')
        .eq('id', factoryId)
        .single();

      if (factoryError || !factory) {
        return NextResponse.json({ error: '공장을 찾을 수 없습니다.' }, { status: 400 });
      }
    }
    const { data, error } = await adminClient
      .from('orders')
      .update({
        assigned_factory_id: factoryId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '공장 배정에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
