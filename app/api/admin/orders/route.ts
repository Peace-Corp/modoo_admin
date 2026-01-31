import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';

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

    const adminClient = createAdminClient();

    // Factory users: sort by deadline (마감일), Admin users: sort by created_at
    const isFactoryUser = profile.role === 'factory';

    // Select only fields needed for the list view, include order_items count
    const selectFields = isFactoryUser
      ? `id, order_category, order_status, deadline, factory_amount, factory_payment_date, factory_payment_status, created_at, order_items(count)`
      : `id, customer_name, customer_email, customer_phone, order_category, created_at, total_amount, order_status, payment_status, payment_method, assigned_manufacturer_id, shipping_method, country_code, postal_code, state, city, address_line_1, address_line_2, deadline, factory_amount, factory_payment_date, factory_payment_status, notes, order_items(count)`;

    let query = adminClient.from('orders').select(selectFields);

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
      query = query.eq('order_status', status);
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

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const orderId = payload?.orderId;
    const manufacturerId = payload?.factoryId ?? null;

    // Factory-specific fields
    const deadlineInput = payload?.deadline ?? null;
    const factoryAmountInput = payload?.factoryAmount ?? null;
    const factoryPaymentDateInput = payload?.factoryPaymentDate ?? null;
    const factoryPaymentStatusInput = payload?.factoryPaymentStatus ?? null;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: '주문 ID가 필요합니다.' }, { status: 400 });
    }

    if (manufacturerId !== null && typeof manufacturerId !== 'string') {
      return NextResponse.json({ error: '공장 ID 형식이 올바르지 않습니다.' }, { status: 400 });
    }

    // Validate factory payment status
    const validPaymentStatuses = ['pending', 'completed', 'cancelled'];
    if (factoryPaymentStatusInput !== null && !validPaymentStatuses.includes(factoryPaymentStatusInput)) {
      return NextResponse.json({ error: '유효하지 않은 결제 상태입니다.' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    if (manufacturerId !== null) {
      const { data: manufacturer, error: manufacturerError } = await adminClient
        .from('manufacturers')
        .select('id')
        .eq('id', manufacturerId)
        .single();

      if (manufacturerError || !manufacturer) {
        return NextResponse.json({ error: '공장을 찾을 수 없습니다.' }, { status: 400 });
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      assigned_manufacturer_id: manufacturerId,
      updated_at: new Date().toISOString(),
    };

    // Add factory-specific fields if provided
    if (deadlineInput !== undefined) {
      updateData.deadline = deadlineInput ? new Date(deadlineInput).toISOString() : null;
    }
    if (factoryAmountInput !== undefined) {
      updateData.factory_amount = factoryAmountInput;
    }
    if (factoryPaymentDateInput !== undefined) {
      updateData.factory_payment_date = factoryPaymentDateInput ? new Date(factoryPaymentDateInput).toISOString() : null;
    }
    if (factoryPaymentStatusInput !== undefined) {
      updateData.factory_payment_status = factoryPaymentStatusInput;
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
  } catch (error) {
    const message = error instanceof Error ? error.message : '공장 배정에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
