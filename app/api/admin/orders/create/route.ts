import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { randomBytes } from 'crypto';

interface CreateOrderVariant {
  sizeLabel: string;
  sizeCode: string;
  quantity: number;
}

type PaymentType = 'completed' | 'bank_transfer' | 'customer_payment';

interface CreateOrderRequest {
  designId: string;
  productId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  variants: CreateOrderVariant[];
  notes?: string;
  shippingMethod?: 'pickup' | 'domestic';
  postalCode?: string;
  state?: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
  // Pricing adjustment fields
  pricingMode?: 'auto' | 'custom_unit_price' | 'custom_total';
  customUnitPrice?: number;
  couponCode?: string;
  couponId?: string;
  customTotalPrice?: number;
  couponDiscount?: number;
  adminDiscount?: number;
  adminDiscountType?: 'fixed' | 'percentage';
  adminSurcharge?: number;
  pricingNote?: string;
  // Payment type
  paymentType?: PaymentType;
}

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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORDER-${year}${month}${day}-${random}`;
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
    } catch {
      return fallback;
    }
  }
  return value as T;
};

const resolveProductColor = (colorSelections: Record<string, unknown>): string | null => {
  if (!colorSelections || typeof colorSelections !== 'object') return null;
  if (typeof colorSelections.productColor === 'string') return colorSelections.productColor;
  if (typeof colorSelections.body === 'string') return colorSelections.body;
  const front = colorSelections.front as Record<string, unknown> | undefined;
  if (front && typeof front.body === 'string') {
    return front.body;
  }
  return null;
};

function getBaseUrl(): string {
  return 'https://modoouniform.com';
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const payload = await request.json().catch(() => null) as CreateOrderRequest | null;

    if (!payload) {
      return NextResponse.json({ error: '요청 데이터가 올바르지 않습니다.' }, { status: 400 });
    }

    const { designId, productId, customerName, customerEmail, customerPhone, variants, notes } = payload;

    if (!designId || typeof designId !== 'string') {
      return NextResponse.json({ error: '디자인 ID가 필요합니다.' }, { status: 400 });
    }

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: '제품 ID가 필요합니다.' }, { status: 400 });
    }

    if (!customerName || typeof customerName !== 'string') {
      return NextResponse.json({ error: '고객 이름이 필요합니다.' }, { status: 400 });
    }

    if (!customerEmail || typeof customerEmail !== 'string') {
      return NextResponse.json({ error: '고객 이메일이 필요합니다.' }, { status: 400 });
    }

    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return NextResponse.json({ error: '최소 하나의 사이즈/수량을 선택해주세요.' }, { status: 400 });
    }

    const totalQuantity = variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
    if (totalQuantity <= 0) {
      return NextResponse.json({ error: '총 수량은 1개 이상이어야 합니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: design, error: designError } = await adminClient
      .from('saved_designs')
      .select('id, product_id, title, canvas_state, color_selections, preview_url, price_per_item, image_urls, text_svg_exports, custom_fonts')
      .eq('id', designId)
      .single();

    if (designError || !design) {
      return NextResponse.json({ error: designError?.message || '디자인을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (design.product_id !== productId) {
      return NextResponse.json({ error: '디자인과 제품이 일치하지 않습니다.' }, { status: 400 });
    }

    const { data: product, error: productError } = await adminClient
      .from('products')
      .select('id, title, base_price, size_options')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: productError?.message || '제품을 찾을 수 없습니다.' }, { status: 404 });
    }

    // --- Pricing calculation with adjustments ---
    const pricingMode = payload.pricingMode || 'auto';
    const paymentType: PaymentType = payload.paymentType || 'completed';

    let unitPrice: number;
    let originalAmount: number;
    let couponDiscount = 0;
    let adminDiscount = 0;
    let adminSurcharge = 0;
    let totalAmount: number;

    if (pricingMode === 'custom_total' && payload.customTotalPrice != null && payload.customTotalPrice > 0) {
      // Direct total amount mode - no itemized adjustments
      const designPrice = toNumber(design.price_per_item);
      unitPrice = designPrice > 0 ? designPrice : toNumber(product.base_price);
      originalAmount = unitPrice * totalQuantity;
      totalAmount = payload.customTotalPrice;
    } else {
      if (pricingMode === 'custom_unit_price' && payload.customUnitPrice != null && payload.customUnitPrice > 0) {
        unitPrice = payload.customUnitPrice;
      } else {
        const designPrice = toNumber(design.price_per_item);
        unitPrice = designPrice > 0 ? designPrice : toNumber(product.base_price);
      }

      originalAmount = unitPrice * totalQuantity;
      couponDiscount = Math.max(0, toNumber(payload.couponDiscount));

      if (payload.adminDiscount && payload.adminDiscount > 0) {
        if (payload.adminDiscountType === 'percentage') {
          adminDiscount = Math.floor(originalAmount * (payload.adminDiscount / 100));
        } else {
          adminDiscount = payload.adminDiscount;
        }
      }

      adminSurcharge = Math.max(0, toNumber(payload.adminSurcharge));
      totalAmount = Math.max(0, originalAmount - couponDiscount - adminDiscount + adminSurcharge);
    }

    // Normalize canvas state and color selections
    const colorSelections = normalizeJson<Record<string, unknown>>(design.color_selections ?? null, {});
    const canvasState = normalizeJson<Record<string, unknown>>(design.canvas_state ?? null, {});
    const productColor = resolveProductColor(colorSelections);

    const orderVariants = variants
      .filter(v => v.quantity > 0)
      .map((variant) => ({
        size_id: variant.sizeCode,
        size_name: variant.sizeLabel,
        quantity: variant.quantity,
        color_hex: productColor || undefined,
      }));

    const itemOptions: Record<string, unknown> = { variants: orderVariants };
    if (orderVariants.length === 1) {
      const [single] = orderVariants;
      itemOptions.size_id = single.size_id;
      itemOptions.size_name = single.size_name;
      if (single.color_hex) {
        itemOptions.color_hex = single.color_hex;
      }
    }

    const orderId = buildOrderId();

    // --- Payment method / status based on paymentType ---
    let paymentMethod: string;
    let paymentStatus: string;
    let orderStatus: string;
    let paymentLinkToken: string | null = null;

    switch (paymentType) {
      case 'bank_transfer':
        paymentMethod = 'bank_transfer';
        paymentStatus = 'pending';
        orderStatus = 'payment_completed';
        break;
      case 'customer_payment':
        paymentMethod = 'toss';
        paymentStatus = 'pending';
        orderStatus = 'payment_completed';
        paymentLinkToken = randomBytes(16).toString('hex');
        break;
      case 'completed':
      default:
        paymentMethod = 'admin';
        paymentStatus = 'completed';
        orderStatus = 'payment_completed';
        break;
    }

    const orderPayload: Record<string, unknown> = {
      id: orderId,
      user_id: null,
      order_category: 'regular',
      cobuy_session_id: null,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone || null,
      shipping_method: payload.shippingMethod || 'pickup',
      country_code: payload.shippingMethod === 'domestic' ? 'KR' : null,
      state: payload.state || null,
      city: payload.city || null,
      postal_code: payload.postalCode || null,
      address_line_1: payload.addressLine1 || null,
      address_line_2: payload.addressLine2 || null,
      delivery_fee: 0,
      payment_method: paymentMethod,
      payment_key: null,
      payment_status: paymentStatus,
      order_status: orderStatus,
      total_amount: totalAmount,
      notes: notes || null,
      // Pricing adjustment fields
      original_amount: originalAmount,
      custom_unit_price: pricingMode === 'custom_unit_price' ? unitPrice : null,
      admin_discount: adminDiscount,
      admin_surcharge: adminSurcharge,
      coupon_discount: couponDiscount,
      applied_coupon_id: payload.couponId || null,
      pricing_note: payload.pricingNote || null,
      payment_link_token: paymentLinkToken,
    };

    const { error: orderError } = await adminClient
      .from('orders')
      .insert(orderPayload);

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    const orderItemPayload = {
      order_id: orderId,
      product_id: productId,
      design_id: designId,
      product_title: product.title || 'Product',
      quantity: totalQuantity,
      price_per_item: unitPrice,
      canvas_state: canvasState,
      color_selections: colorSelections,
      item_options: itemOptions,
      thumbnail_url: design.preview_url || null,
      image_urls: design.image_urls || null,
      text_svg_exports: design.text_svg_exports || null,
      custom_fonts: design.custom_fonts || null,
    };

    const { error: orderItemError } = await adminClient
      .from('order_items')
      .insert(orderItemPayload);

    if (orderItemError) {
      await adminClient.from('orders').delete().eq('id', orderId);
      return NextResponse.json({ error: orderItemError.message }, { status: 500 });
    }

    // Build payment link URL if customer_payment
    let paymentLinkUrl: string | null = null;
    if (paymentLinkToken) {
      const customerBase = getBaseUrl();
      paymentLinkUrl = `${customerBase}/order/custom/${paymentLinkToken}`;
    }

    return NextResponse.json({
      data: {
        orderId,
        totalAmount,
        originalAmount,
        totalQuantity,
        paymentType,
        paymentLinkToken,
        paymentLinkUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '주문 생성에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
