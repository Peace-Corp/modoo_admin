import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createOrganizerAccessToken } from '@/lib/cobuy-organizer-token';

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

function customerSiteOrigin(): string {
  return (process.env.NEXT_PUBLIC_CUSTOMER_SITE_URL || 'https://modoouniform.com').replace(/\/$/, '');
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const sessionId = request.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId가 필요합니다.' }, { status: 400 });
    }

    let token: string;
    try {
      token = createOrganizerAccessToken(sessionId);
    } catch (e) {
      const message = e instanceof Error ? e.message : '토큰을 만들 수 없습니다.';
      return NextResponse.json(
        { error: message.includes('COBUY_ORGANIZER_LINK_SECRET') ? 'COBUY_ORGANIZER_LINK_SECRET 환경 변수를 설정하세요 (32자 이상).' : message },
        { status: 503 }
      );
    }

    const url = `${customerSiteOrigin()}/cobuy/host/${encodeURIComponent(token)}`;
    return NextResponse.json({ url, token });
  } catch (error) {
    const message = error instanceof Error ? error.message : '처리에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
