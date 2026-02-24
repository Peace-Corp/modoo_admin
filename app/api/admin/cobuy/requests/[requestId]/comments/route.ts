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

export async function GET(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const { requestId } = await params;
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('cobuy_request_comments')
      .select(`*, profiles:profiles!cobuy_request_comments_user_id_fkey (email, name)`)
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const transformed = (data || []).map((item: any) => ({
      ...item,
      profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
    }));

    return NextResponse.json(transformed);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const { requestId } = await params;
    const body = await request.json();

    if (!body.content?.trim()) {
      return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('cobuy_request_comments')
      .insert({
        request_id: requestId,
        user_id: authResult.user!.id,
        content: body.content.trim(),
        is_admin: true,
      })
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
