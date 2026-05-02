import { NextRequest, NextResponse } from 'next/server';
import { isAdminLike, isBackofficeOperatorRole } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { RangePreset, buildAnalyticsPayload, resolveRange } from '@/lib/analytics/aggregations';

const requireAdmin = async () => {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) return { error: NextResponse.json({ error: authError.message }, { status: 401 }) };
  if (!user) return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profileError) return { error: NextResponse.json({ error: profileError.message }, { status: 403 }) };
  if (!profile || (!isAdminLike(profile.role))) {
    return { error: NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 }) };
  }
  return {};
};

const VALID_PRESETS: RangePreset[] = ['this_week', 'this_month', 'q1', 'q2', 'q3', 'q4', 'custom'];

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const presetParam = (searchParams.get('preset') || 'this_month') as RangePreset;
    const preset: RangePreset = VALID_PRESETS.includes(presetParam) ? presetParam : 'this_month';
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const range = resolveRange(preset, from, to);
    const admin = createAdminClient();
    const payload = await buildAnalyticsPayload(admin, preset, range);

    return NextResponse.json({ data: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
