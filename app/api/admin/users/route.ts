import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';

const allowedRoles = new Set(['customer', 'admin', 'factory']);

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
      .select('role, manufacturer_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 403 });
    }

    if (!profile || !['admin', 'factory'].includes(profile.role)) {
      return NextResponse.json({ error: '관리자 또는 공장 권한이 필요합니다.' }, { status: 403 });
    }
    const url = new URL(request.url);
    const role = url.searchParams.get('role') || 'all';
    let manufacturerId = url.searchParams.get('factoryId');

    // Factory users can only see users from their own factory
    if (profile.role === 'factory') {
      manufacturerId = profile.manufacturer_id;
      if (!manufacturerId) {
        // A factory user must have a manufacturer_id assigned
        return NextResponse.json({ data: [] });
      }
    }

    const adminClient = createAdminClient();
    let query = adminClient
      .from('profiles')
      .select('id, email, phone_number, role, manufacturer_id, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (role !== 'all') {
      if (!allowedRoles.has(role)) {
        return NextResponse.json({ error: '유효하지 않은 사용자 권한입니다.' }, { status: 400 });
      }
      query = query.eq('role', role);
    }

    if (manufacturerId) {
      query = query.eq('manufacturer_id', manufacturerId);
    }
    
    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '사용자 목록을 불러오지 못했습니다.';
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
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 403 });
    }

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const userId = payload?.userId;
    const role = payload?.role;
    const manufacturerId = payload?.factoryId;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 });
    }

    if (role !== undefined) {
      if (!role || typeof role !== 'string' || !allowedRoles.has(role)) {
        return NextResponse.json({ error: '유효하지 않은 사용자 권한입니다.' }, { status: 400 });
      }
    }

    const adminClient = createAdminClient();
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (role !== undefined) {
      updateData.role = role;
      if (role !== 'factory') {
        updateData.manufacturer_id = null;
      }
    }

    if (manufacturerId !== undefined) {
      if (manufacturerId !== null && typeof manufacturerId !== 'string') {
        return NextResponse.json({ error: '공장 ID 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      if (manufacturerId) {
        const { data: manufacturer, error: manufacturerError } = await adminClient
          .from('manufacturers')
          .select('id')
          .eq('id', manufacturerId)
          .single();

        if (manufacturerError || !manufacturer) {
          return NextResponse.json({ error: '공장을 찾을 수 없습니다.' }, { status: 400 });
        }
      }
      updateData.manufacturer_id = manufacturerId || null;
    }

    if (Object.keys(updateData).length === 1) {
      return NextResponse.json({ error: '업데이트할 항목이 없습니다.' }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select('id, email, phone_number, role, manufacturer_id, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '사용자 권한 변경에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
