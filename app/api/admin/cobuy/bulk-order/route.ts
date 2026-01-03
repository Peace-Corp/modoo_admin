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

const buildOrderId = () => {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORDER-${Date.now()}-${random}`;
};

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeJson = <T,>(value: T | string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.warn('Failed to parse JSON value:', error);
      return fallback;
    }
  }
  return value as T;
};

const resolveProductColor = (colorSelections: Record<string, any>): string | null => {
  if (!colorSelections || typeof colorSelections !== 'object') return null;
  if (typeof colorSelections.productColor === 'string') return colorSelections.productColor;
  if (typeof colorSelections.body === 'string') return colorSelections.body;
  if (colorSelections.front && typeof colorSelections.front.body === 'string') {
    return colorSelections.front.body;
  }
  return null;
};

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const payload = await request.json().catch(() => null);
    const sessionId = payload?.sessionId;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: '세션 ID가 필요합니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: session, error: sessionError } = await adminClient
      .from('cobuy_sessions')
      .select('id, user_id, saved_design_id, title, status, bulk_order_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message || '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (session.bulk_order_id) {
      return NextResponse.json({ error: '이미 주문이 생성된 세션입니다.' }, { status: 409 });
    }

    if (session.status !== 'finalized') {
      return NextResponse.json({ error: '확정된 세션만 주문을 생성할 수 있습니다.' }, { status: 400 });
    }

    const { data: participants, error: participantError } = await adminClient
      .from('cobuy_participants')
      .select('id, name, email, phone, selected_size, payment_status, payment_amount')
      .eq('cobuy_session_id', sessionId)
      .eq('payment_status', 'completed');

    if (participantError) {
      return NextResponse.json({ error: participantError.message }, { status: 500 });
    }

    if (!participants || participants.length === 0) {
      return NextResponse.json({ error: '결제 완료된 참여자가 없습니다.' }, { status: 400 });
    }

    const { data: design, error: designError } = await adminClient
      .from('saved_designs')
      .select('id, product_id, title, canvas_state, color_selections, preview_url, price_per_item')
      .eq('id', session.saved_design_id)
      .single();

    if (designError || !design) {
      return NextResponse.json({ error: designError?.message || '디자인 정보를 찾을 수 없습니다.' }, { status: 500 });
    }

    const { data: product, error: productError } = await adminClient
      .from('products')
      .select('id, title, base_price, size_options')
      .eq('id', design.product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: productError?.message || '제품 정보를 찾을 수 없습니다.' }, { status: 500 });
    }

    const { data: creatorProfile } = await adminClient
      .from('profiles')
      .select('email, phone_number')
      .eq('id', session.user_id)
      .single();

    const totalQuantity = participants.length;
    const totalPaid = participants.reduce((sum, participant) => {
      return sum + toNumber(participant.payment_amount);
    }, 0);

    const designPrice = toNumber(design.price_per_item);
    const basePrice = designPrice > 0 ? designPrice : toNumber(product.base_price);
    const totalAmount = totalPaid > 0 ? totalPaid : basePrice * totalQuantity;
    const pricePerItem = totalQuantity > 0 ? Number((totalAmount / totalQuantity).toFixed(2)) : basePrice;

    const sizeOptions = normalizeJson<Array<{ id?: string; name?: string; label?: string }>>(
      product.size_options ?? null,
      []
    );

    const variantMap = new Map<string, { size_id?: string; size_name?: string; quantity: number }>();

    participants.forEach((participant) => {
      const selectedSize = participant.selected_size || 'unknown';
      const match = sizeOptions.find((option) =>
        option.id === selectedSize || option.name === selectedSize || option.label === selectedSize
      );

      const sizeId = match?.id || selectedSize;
      const sizeName = match?.name || match?.label || selectedSize;
      const key = sizeId || sizeName;

      const existing = variantMap.get(key);
      if (existing) {
        existing.quantity += 1;
      } else {
        variantMap.set(key, {
          size_id: sizeId,
          size_name: sizeName,
          quantity: 1,
        });
      }
    });

    const colorSelections = normalizeJson<Record<string, any>>(design.color_selections ?? null, {});
    const canvasState = normalizeJson<Record<string, any>>(design.canvas_state ?? null, {});
    const productColor = resolveProductColor(colorSelections);

    const variants = Array.from(variantMap.values()).map((variant) => ({
      ...variant,
      color_hex: productColor || undefined,
    }));

    const itemOptions: Record<string, unknown> = { variants };
    if (variants.length === 1) {
      const [single] = variants;
      itemOptions.size_id = single.size_id;
      itemOptions.size_name = single.size_name;
      if (single.color_hex) {
        itemOptions.color_hex = single.color_hex;
      }
    }

    const orderId = buildOrderId();

    const orderPayload = {
      id: orderId,
      user_id: session.user_id,
      customer_name: creatorProfile?.email || `CoBuy ${session.title || session.id}`,
      customer_email: creatorProfile?.email || 'unknown@cobuy.local',
      customer_phone: creatorProfile?.phone_number || null,
      shipping_method: 'pickup',
      country_code: null,
      state: null,
      city: null,
      postal_code: null,
      address_line_1: null,
      address_line_2: null,
      delivery_fee: 0,
      payment_method: 'toss',
      payment_key: null,
      payment_status: 'completed',
      order_status: 'pending',
      total_amount: totalAmount,
    };

    const { error: orderError } = await adminClient
      .from('orders')
      .insert(orderPayload);

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    const orderItemPayload = {
      order_id: orderId,
      product_id: design.product_id,
      design_id: design.id,
      product_title: product.title || 'CoBuy Product',
      quantity: totalQuantity,
      price_per_item: pricePerItem,
      canvas_state: canvasState,
      color_selections: colorSelections,
      item_options: itemOptions,
      thumbnail_url: design.preview_url || null,
    };

    const { error: orderItemError } = await adminClient
      .from('order_items')
      .insert(orderItemPayload);

    if (orderItemError) {
      await adminClient.from('orders').delete().eq('id', orderId);
      return NextResponse.json({ error: orderItemError.message }, { status: 500 });
    }

    const { error: updateError } = await adminClient
      .from('cobuy_sessions')
      .update({
        bulk_order_id: orderId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ data: { orderId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '공동구매 주문 생성에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
