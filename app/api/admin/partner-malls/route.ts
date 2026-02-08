import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';

const requireAdmin = async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return { error: NextResponse.json({ error: authError.message }, { status: 401 }) };
  }

  if (!user) {
    return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    return { error: NextResponse.json({ error: profileError.message }, { status: 403 }) };
  }

  if (!profile || profile.role !== 'admin') {
    return { error: NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 }) };
  }

  return { user };
};

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('partner_malls')
      .select(`
        *,
        partner_mall_products (
          id,
          product_id,
          logo_placements,
          preview_url,
          product:products (
            id,
            title,
            thumbnail_image_link
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '파트너몰 데이터를 불러오지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const payload = await request.json().catch(() => null);
    const name = payload?.name;
    const logoUrl = payload?.logo_url;
    const originalLogoUrl = payload?.original_logo_url ?? null;
    const isActive = payload?.is_active ?? true;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: '파트너몰 이름이 필요합니다.' }, { status: 400 });
    }

    if (!logoUrl || typeof logoUrl !== 'string') {
      return NextResponse.json({ error: '로고 URL이 필요합니다.' }, { status: 400 });
    }

    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ error: '활성 상태 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('partner_malls')
      .insert({
        name,
        logo_url: logoUrl,
        original_logo_url: originalLogoUrl,
        is_active: isActive,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '파트너몰 생성에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const payload = await request.json().catch(() => null);
    const partnerId = payload?.id;

    if (!partnerId || typeof partnerId !== 'string') {
      return NextResponse.json({ error: '파트너몰 ID가 필요합니다.' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof payload?.name === 'string') {
      updateData.name = payload.name;
    }

    if (typeof payload?.logo_url === 'string') {
      updateData.logo_url = payload.logo_url;
    }

    if (payload?.original_logo_url !== undefined) {
      if (payload.original_logo_url !== null && typeof payload.original_logo_url !== 'string') {
        return NextResponse.json({ error: '원본 로고 URL 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      updateData.original_logo_url = payload.original_logo_url ?? null;
    }

    if (payload?.is_active !== undefined) {
      if (typeof payload.is_active !== 'boolean') {
        return NextResponse.json({ error: '활성 상태 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      updateData.is_active = payload.is_active;
    }

    if (Object.keys(updateData).length === 1) {
      return NextResponse.json({ error: '업데이트할 항목이 없습니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('partner_malls')
      .update(updateData)
      .eq('id', partnerId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '파트너몰 업데이트에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const url = new URL(request.url);
    const partnerId = url.searchParams.get('id');

    if (!partnerId) {
      return NextResponse.json({ error: '파트너몰 ID가 필요합니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Delete will cascade to partner_mall_products due to ON DELETE CASCADE
    const { error } = await adminClient
      .from('partner_malls')
      .delete()
      .eq('id', partnerId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: { id: partnerId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '파트너몰 삭제에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
