import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendFactoryAssignmentEmail } from '@/lib/gmail';
import { randomBytes } from 'crypto';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, manufacturer_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 403 });
    }

    if (!profile || (profile.role !== 'admin' && profile.role !== 'factory')) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'all';
    const factoryId = url.searchParams.get('factoryId');
    const orderId = url.searchParams.get('orderId');

    const adminClient = createAdminClient();

    // Factory users: sort by deadline (마감일), Admin users: sort by created_at
    const isFactoryUser = profile.role === 'factory';

    // Select only fields needed for the list view, include order_items count/status
    const selectFields = isFactoryUser
      ? `id, order_category, order_status, factory_status, assigned_manufacturer_id, deadline, factory_amount, factory_payment_date, factory_payment_status, customer_note, attachment_urls, created_at, order_items(id, design_title, thumbnail_url)`
      : `id, customer_name, customer_email, customer_phone, order_category, delivery_fee, created_at, total_amount, order_status, payment_status, payment_method, assigned_manufacturer_id, shipping_method, country_code, postal_code, state, city, address_line_1, address_line_2, deadline, factory_status, factory_amount, factory_payment_date, factory_payment_status, refund_reason, customer_note, attachment_urls, notes, original_amount, custom_unit_price, admin_discount, admin_surcharge, coupon_discount, applied_coupon_id, pricing_note, payment_link_token, share_token, order_items(id, purchase_order_status, design_title)`;

    let query = adminClient.from('orders').select(selectFields as string);

    // Filter by specific orderId if provided
    if (orderId) {
      query = query.eq('id', orderId);
    }

    if (isFactoryUser) {
      // For factory users, sort by deadline (nulls last to show orders with deadlines first)
      query = query.order('deadline', { ascending: true, nullsFirst: false });
    } else {
      // For admin users, sort by created_at (newest first)
      query = query.order('created_at', { ascending: false });
    }

    if (isFactoryUser) {
      if (!profile.manufacturer_id) {
        return NextResponse.json({ data: [] });
      }
      query = query.eq('assigned_manufacturer_id', profile.manufacturer_id);
    } else if (profile.role === 'admin' && factoryId) {
      query = query.eq('assigned_manufacturer_id', factoryId);
    }

    if (status !== 'all') {
      if (profile.role === 'factory') {
        query = query.eq('factory_status', status);
      } else {
        query = query.eq('order_status', status);
      }
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : '주문 데이터를 불러오지 못했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, manufacturer_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 403 });
    }

    if (!profile || (profile.role !== 'admin' && profile.role !== 'factory')) {
      return NextResponse.json({ error: '권한이 필요합니다.' }, { status: 403 });
    }

    const isFactoryUser = profile.role === 'factory';

    const payload = await request.json().catch(() => null);
    const orderId = payload?.orderId;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: '주문 ID가 필요합니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Factory users can update factory_status and factory_amount on their own orders
    if (isFactoryUser) {
      const factoryStatusInput = payload?.factoryStatus;
      const factoryAmountInput = payload?.factoryAmount;

      if (!factoryStatusInput && factoryAmountInput === undefined) {
        return NextResponse.json({ error: '변경할 항목이 없습니다.' }, { status: 400 });
      }

      if (factoryStatusInput) {
        const validFactoryStatuses = ['assigned', 'in_progress', 'completed', 'shipped'];
        if (!validFactoryStatuses.includes(factoryStatusInput)) {
          return NextResponse.json({ error: '유효하지 않은 공장 배정 상태입니다.' }, { status: 400 });
        }
      }

      // Verify order belongs to this factory
      const { data: existingOrder, error: orderCheckError } = await adminClient
        .from('orders')
        .select('id, assigned_manufacturer_id')
        .eq('id', orderId)
        .single();

      if (orderCheckError || !existingOrder) {
        return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
      }

      if (existingOrder.assigned_manufacturer_id !== profile.manufacturer_id) {
        return NextResponse.json({ error: '이 주문에 대한 권한이 없습니다.' }, { status: 403 });
      }

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (factoryStatusInput) {
        updateData.factory_status = factoryStatusInput;
        updateData.order_status = factoryStatusInput === 'shipped' ? 'shipping' : 'in_production';
      }

      if (factoryAmountInput !== undefined) {
        updateData.factory_amount = factoryAmountInput;
      }

      const { data, error } = await adminClient
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data });
    }

    // Admin flow below
    const manufacturerId = payload?.factoryId ?? null;

    // Factory-specific fields
    const deadlineInput = payload?.deadline ?? null;
    const factoryAmountInput = payload?.factoryAmount ?? null;
    const factoryPaymentDateInput = payload?.factoryPaymentDate ?? null;
    const factoryPaymentStatusInput = payload?.factoryPaymentStatus ?? null;
    const orderStatusInput = payload?.orderStatus ?? null;
    const factoryStatusInput = payload?.factoryStatus ?? null;

    if (manufacturerId !== null && typeof manufacturerId !== 'string') {
      return NextResponse.json({ error: '공장 ID 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    // Validate order status
    const validOrderStatuses = ['payment_pending', 'payment_completed', 'in_production', 'shipping', 'delivered', 'cancelled', 'partially_cancelled'];
    if (orderStatusInput !== null && !validOrderStatuses.includes(orderStatusInput)) {
      return NextResponse.json({ error: '유효하지 않은 주문 상태입니다.' }, { status: 400 });
    }

    // Validate factory status
    const validFactoryStatuses = ['pending', 'assigned', 'in_progress', 'completed', 'shipped', 'cancelled'];
    if (factoryStatusInput !== null && !validFactoryStatuses.includes(factoryStatusInput)) {
      return NextResponse.json({ error: '유효하지 않은 공장 배정 상태입니다.' }, { status: 400 });
    }

    // Validate factory payment status
    const validPaymentStatuses = ['pending', 'completed', 'cancelled'];
    if (factoryPaymentStatusInput !== null && !validPaymentStatuses.includes(factoryPaymentStatusInput)) {
      return NextResponse.json({ error: '유효하지 않은 결제 상태입니다.' }, { status: 400 });
    }

    let manufacturerInfo: { id: string; name: string; email: string | null } | null = null;

    if (manufacturerId !== null) {
      const { data: manufacturer, error: manufacturerError } = await adminClient
        .from('manufacturers')
        .select('id, name, email')
        .eq('id', manufacturerId)
        .single();

      if (manufacturerError || !manufacturer) {
        return NextResponse.json({ error: '공장을 찾을 수 없습니다.' }, { status: 400 });
      }
      manufacturerInfo = manufacturer;
    }

    const { data: existingOrder } = await adminClient
      .from('orders')
      .select('assigned_manufacturer_id, customer_note, share_token')
      .eq('id', orderId)
      .single();

    const previousManufacturerId = existingOrder?.assigned_manufacturer_id ?? null;
    const isNewFactoryAssignment = manufacturerId !== null && manufacturerId !== previousManufacturerId;

    // Handle payment_status update (manual payment confirmation)
    const paymentStatusInput = payload?.payment_status ?? null;
    if (paymentStatusInput !== null) {
      const validOrderPaymentStatuses = ['pending', 'completed', 'failed', 'refunded'];
      if (!validOrderPaymentStatuses.includes(paymentStatusInput)) {
        return NextResponse.json({ error: '유효하지 않은 결제 상태입니다.' }, { status: 400 });
      }
    }

    // Handle payment link generation for existing orders
    const generatePaymentLink = payload?.generate_payment_link === true;

    // Handle price adjustment
    const priceAdjustment = payload?.priceAdjustment ?? null;

    // Build update object
    const updateData: Record<string, unknown> = {
      assigned_manufacturer_id: manufacturerId,
      updated_at: new Date().toISOString(),
    };

    if (paymentStatusInput !== null) {
      updateData.payment_status = paymentStatusInput;
    }

    if (generatePaymentLink) {
      const newToken = randomBytes(16).toString('hex');
      updateData.payment_link_token = newToken;
    }

    if (priceAdjustment !== null && typeof priceAdjustment === 'object') {
      const { mode, value, note } = priceAdjustment as { mode: string; value: number; note?: string };
      if (typeof value !== 'number' || value < 0) {
        return NextResponse.json({ error: '유효하지 않은 금액입니다.' }, { status: 400 });
      }

      const { data: currentOrder } = await adminClient
        .from('orders')
        .select('total_amount, original_amount')
        .eq('id', orderId)
        .single();

      if (!currentOrder) {
        return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
      }

      const baseAmount = currentOrder.original_amount ?? currentOrder.total_amount;

      switch (mode) {
        case 'set_total':
          updateData.total_amount = value;
          if (!currentOrder.original_amount) {
            updateData.original_amount = currentOrder.total_amount;
          }
          updateData.admin_discount = Math.max(0, baseAmount - value);
          updateData.admin_surcharge = 0;
          break;
        case 'discount_fixed':
          updateData.total_amount = Math.max(0, baseAmount - value);
          if (!currentOrder.original_amount) {
            updateData.original_amount = currentOrder.total_amount;
          }
          updateData.admin_discount = value;
          updateData.admin_surcharge = 0;
          break;
        case 'discount_rate': {
          const discountAmount = Math.floor(baseAmount * (value / 100));
          updateData.total_amount = Math.max(0, baseAmount - discountAmount);
          if (!currentOrder.original_amount) {
            updateData.original_amount = currentOrder.total_amount;
          }
          updateData.admin_discount = discountAmount;
          updateData.admin_surcharge = 0;
          break;
        }
        case 'surcharge':
          updateData.total_amount = baseAmount + value;
          if (!currentOrder.original_amount) {
            updateData.original_amount = currentOrder.total_amount;
          }
          updateData.admin_surcharge = value;
          break;
        default:
          return NextResponse.json({ error: '유효하지 않은 조정 모드입니다.' }, { status: 400 });
      }

      if (note) {
        updateData.pricing_note = note;
      }
    }

    // Add factory-specific fields if provided
    if (deadlineInput !== undefined) {
      if (deadlineInput) {
        const date = new Date(deadlineInput);
        updateData.deadline = isNaN(date.getTime()) ? null : date.toISOString();
      } else {
        updateData.deadline = null;
      }
    }
    if (factoryAmountInput !== undefined) {
      updateData.factory_amount = factoryAmountInput;
    }
    if (factoryPaymentDateInput !== undefined) {
      if (factoryPaymentDateInput) {
        const date = new Date(factoryPaymentDateInput);
        updateData.factory_payment_date = isNaN(date.getTime()) ? null : date.toISOString();
      } else {
        updateData.factory_payment_date = null;
      }
    }
    if (factoryPaymentStatusInput !== undefined) {
      updateData.factory_payment_status = factoryPaymentStatusInput;
    }
    if (factoryStatusInput !== null) {
      updateData.factory_status = factoryStatusInput;
      if (orderStatusInput !== null) {
        updateData.order_status = orderStatusInput;
      } else {
        // Auto-sync order_status when only factoryStatus is provided
        if (factoryStatusInput === 'shipped') {
          updateData.order_status = 'shipping';
        } else if (['assigned', 'in_progress', 'completed'].includes(factoryStatusInput)) {
          updateData.order_status = 'in_production';
        }
      }
    } else if (orderStatusInput !== null) {
      updateData.order_status = orderStatusInput;
    }

    const { data, error } = await adminClient
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (isNewFactoryAssignment && manufacturerInfo?.email) {
      const { data: items } = await adminClient
        .from('order_items')
        .select('id, product_id, product_title, design_title, quantity, thumbnail_url')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      let finalShareToken = data?.share_token ?? existingOrder?.share_token ?? null;
      if (!finalShareToken) {
        finalShareToken = randomBytes(16).toString('hex');
        await adminClient.from('orders').update({ share_token: finalShareToken }).eq('id', orderId);
      }

      const emailItems = await Promise.all(
        (items || []).map(async (item) => {
          let publicUrl = item.thumbnail_url;
          if (publicUrl && publicUrl.startsWith('data:')) {
            try {
              const res = await fetch(publicUrl);
              const blob = await res.blob();
              const ext = blob.type.split('/')[1] || 'png';
              const fileName = `email-thumbnails/${orderId}/${item.id}.${ext}`;
              const { error: upErr } = await adminClient.storage
                .from('user-designs')
                .upload(fileName, blob, { contentType: blob.type, upsert: true });
              if (!upErr) {
                const { data: urlData } = adminClient.storage.from('user-designs').getPublicUrl(fileName);
                publicUrl = urlData.publicUrl;
              }
            } catch { /* keep null */ }
          }
          return {
            id: item.id,
            productId: item.product_id,
            productTitle: item.product_title,
            designTitle: item.design_title,
            quantity: item.quantity,
            thumbnailUrl: publicUrl,
          };
        })
      );

      const reqOrigin = new URL(request.url).origin;
      const emailAppUrl = process.env.NEXT_PUBLIC_APP_URL || reqOrigin;

      sendFactoryAssignmentEmail({
        factoryName: manufacturerInfo.name,
        factoryEmail: manufacturerInfo.email,
        orderId,
        deadline: (updateData.deadline as string | null) ?? deadlineInput ?? null,
        factoryAmount: factoryAmountInput ?? null,
        customerNote: existingOrder?.customer_note ?? null,
        shareToken: finalShareToken,
        appUrl: emailAppUrl,
        orderItems: emailItems,
      }).catch((err) => console.error('Factory assignment email failed:', err));
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '공장 배정에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
