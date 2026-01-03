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

const parseNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
};

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '제품 데이터를 불러오지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const payload = await request.json().catch(() => null);
    const title = payload?.title;
    const basePrice = parseNumber(payload?.base_price);
    const category = payload?.category ?? null;
    const isActive = payload?.is_active ?? true;
    const configuration = payload?.configuration;
    const sizeOptions = payload?.size_options ?? null;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: '제품명이 필요합니다.' }, { status: 400 });
    }

    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      return NextResponse.json({ error: '기본 가격이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!Array.isArray(configuration)) {
      return NextResponse.json({ error: '제품 구성 정보가 필요합니다.' }, { status: 400 });
    }

    if (sizeOptions !== null && !Array.isArray(sizeOptions)) {
      return NextResponse.json({ error: '사이즈 옵션 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    if (category !== null && typeof category !== 'string') {
      return NextResponse.json({ error: '카테고리 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ error: '활성 상태 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('products')
      .insert({
        title,
        base_price: basePrice,
        category,
        is_active: isActive,
        configuration,
        size_options: sizeOptions,
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
    const message = error instanceof Error ? error.message : '제품 생성에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const payload = await request.json().catch(() => null);
    const productId = payload?.id;

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: '제품 ID가 필요합니다.' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof payload?.title === 'string') {
      updateData.title = payload.title;
    }

    if (payload?.base_price !== undefined) {
      const basePrice = parseNumber(payload.base_price);
      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        return NextResponse.json({ error: '기본 가격이 유효하지 않습니다.' }, { status: 400 });
      }
      updateData.base_price = basePrice;
    }

    if (payload?.category !== undefined) {
      if (payload.category !== null && typeof payload.category !== 'string') {
        return NextResponse.json({ error: '카테고리 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      updateData.category = payload.category ?? null;
    }

    if (payload?.is_active !== undefined) {
      if (typeof payload.is_active !== 'boolean') {
        return NextResponse.json({ error: '활성 상태 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      updateData.is_active = payload.is_active;
    }

    if (payload?.configuration !== undefined) {
      if (!Array.isArray(payload.configuration)) {
        return NextResponse.json({ error: '제품 구성 정보 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      updateData.configuration = payload.configuration;
    }

    if (payload?.size_options !== undefined) {
      if (payload.size_options !== null && !Array.isArray(payload.size_options)) {
        return NextResponse.json({ error: '사이즈 옵션 형식이 올바르지 않습니다.' }, { status: 400 });
      }
      updateData.size_options = payload.size_options ?? null;
    }

    if (Object.keys(updateData).length === 1) {
      return NextResponse.json({ error: '업데이트할 항목이 없습니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '제품 업데이트에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const url = new URL(request.url);
    const productId = url.searchParams.get('id') || url.searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: '제품 ID가 필요합니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: { id: productId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '제품 삭제에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
