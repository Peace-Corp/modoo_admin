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

export async function GET(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const url = new URL(request.url);
    const partnerMallId = url.searchParams.get('partner_mall_id');

    if (!partnerMallId) {
      return NextResponse.json({ error: '파트너몰 ID가 필요합니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('partner_mall_products')
      .select(`
        *,
        product:products (
          id,
          title,
          thumbnail_image_link,
          configuration,
          base_price
        )
      `)
      .eq('partner_mall_id', partnerMallId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '파트너몰 제품 데이터를 불러오지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const payload = await request.json().catch(() => null);
    const partnerMallId = payload?.partner_mall_id;
    const productId = payload?.product_id;
    const logoPlacements = payload?.logo_placements ?? {};
    const canvasState = payload?.canvas_state ?? {};
    const previewUrl = payload?.preview_url ?? null;

    if (!partnerMallId || typeof partnerMallId !== 'string') {
      return NextResponse.json({ error: '파트너몰 ID가 필요합니다.' }, { status: 400 });
    }

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: '제품 ID가 필요합니다.' }, { status: 400 });
    }

    if (typeof logoPlacements !== 'object') {
      return NextResponse.json({ error: '로고 배치 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    if (typeof canvasState !== 'object') {
      return NextResponse.json({ error: '캔버스 상태 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('partner_mall_products')
      .insert({
        partner_mall_id: partnerMallId,
        product_id: productId,
        logo_placements: logoPlacements,
        canvas_state: canvasState,
        preview_url: previewUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(`
        *,
        product:products (
          id,
          title,
          thumbnail_image_link,
          configuration
        )
      `)
      .single();

    if (error) {
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({ error: '이 제품은 이미 파트너몰에 추가되어 있습니다.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '파트너몰 제품 추가에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Bulk add multiple products to a partner mall
export async function PUT(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const payload = await request.json().catch(() => null);
    const partnerMallId = payload?.partner_mall_id;
    const products = payload?.products; // Array of { product_id, logo_placements, canvas_state, preview_url }

    if (!partnerMallId || typeof partnerMallId !== 'string') {
      return NextResponse.json({ error: '파트너몰 ID가 필요합니다.' }, { status: 400 });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: '제품 목록이 필요합니다.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const insertData = products.map((p: {
      product_id: string;
      logo_placements?: Record<string, unknown>;
      canvas_state?: Record<string, unknown>;
      preview_url?: string | null;
    }) => ({
      partner_mall_id: partnerMallId,
      product_id: p.product_id,
      logo_placements: p.logo_placements ?? {},
      canvas_state: p.canvas_state ?? {},
      preview_url: p.preview_url ?? null,
      created_at: now,
      updated_at: now,
    }));

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('partner_mall_products')
      .upsert(insertData, {
        onConflict: 'partner_mall_id,product_id',
        ignoreDuplicates: false,
      })
      .select(`
        *,
        product:products (
          id,
          title,
          thumbnail_image_link,
          configuration
        )
      `);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '파트너몰 제품 일괄 추가에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const payload = await request.json().catch(() => null);
    const id = payload?.id;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: '파트너몰 제품 ID가 필요합니다.' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (payload?.logo_placements !== undefined) {
      if (typeof payload.logo_placements !== 'object') {
        return NextResponse.json({ error: '로고 배치 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      updateData.logo_placements = payload.logo_placements;
    }

    if (payload?.canvas_state !== undefined) {
      if (typeof payload.canvas_state !== 'object') {
        return NextResponse.json({ error: '캔버스 상태 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      updateData.canvas_state = payload.canvas_state;
    }

    if (payload?.preview_url !== undefined) {
      if (payload.preview_url !== null && typeof payload.preview_url !== 'string') {
        return NextResponse.json({ error: '미리보기 URL 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      updateData.preview_url = payload.preview_url ?? null;
    }

    if (Object.keys(updateData).length === 1) {
      return NextResponse.json({ error: '업데이트할 항목이 없습니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('partner_mall_products')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        product:products (
          id,
          title,
          thumbnail_image_link,
          configuration
        )
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '파트너몰 제품 업데이트에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '파트너몰 제품 ID가 필요합니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('partner_mall_products')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: { id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '파트너몰 제품 삭제에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
