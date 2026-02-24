import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';

const requireAdmin = async () => {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) };
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
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
    const status = url.searchParams.get('status');

    const admin = createAdminClient();
    let query = admin
      .from('cobuy_requests')
      .select(`
        *,
        product:products (id, title, thumbnail_image_link),
        profiles:profiles!cobuy_requests_user_id_fkey (email, name)
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform nested arrays to objects
    const transformed = (data || []).map((item: any) => ({
      ...item,
      product: Array.isArray(item.product) ? item.product[0] : item.product,
      profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
    }));

    return NextResponse.json(transformed);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const body = await request.json();
    const { id, status, admin_design_id, admin_design_preview_url, confirmed_price } = body;

    if (!id) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (status) updateData.status = status;
    if (admin_design_id !== undefined) updateData.admin_design_id = admin_design_id;
    if (admin_design_preview_url !== undefined) updateData.admin_design_preview_url = admin_design_preview_url;
    if (confirmed_price !== undefined) updateData.confirmed_price = confirmed_price;

    const { data, error } = await admin
      .from('cobuy_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
