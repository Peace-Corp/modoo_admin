import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// Public API - No authentication required
// Fetches order details by share token for factory viewing

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;

    if (!shareToken || typeof shareToken !== 'string') {
      return NextResponse.json({ error: '공유 토큰이 필요합니다.' }, { status: 400 });
    }

    // Validate token format (32-character hex)
    if (!/^[a-f0-9]{32}$/.test(shareToken)) {
      return NextResponse.json({ error: '유효하지 않은 공유 링크입니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Fetch order by share token
    // Only select fields safe for factory viewing (exclude sensitive data)
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select(`
        id,
        order_status,
        order_category,
        shipping_method,
        country_code,
        state,
        city,
        postal_code,
        address_line_1,
        address_line_2,
        deadline,
        created_at
      `)
      .eq('share_token', shareToken)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Fetch order items with product details
    // Exclude price information
    const { data: items, error: itemsError } = await adminClient
      .from('order_items')
      .select(`
        id,
        product_id,
        product_title,
        quantity,
        canvas_state,
        color_selections,
        item_options,
        thumbnail_url,
        image_urls,
        text_svg_exports,
        custom_fonts,
        products(product_code),
        created_at
      `)
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        order,
        items: items || [],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '주문 정보를 불러오지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
