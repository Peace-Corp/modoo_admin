import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      orderId,
      assigned_manufacturer_id,
      factory_amount,
      deadline,
      factory_payment_date,
      factory_payment_status,
    } = body;

    if (!orderId || !assigned_manufacturer_id) {
      return NextResponse.json(
        { error: 'Order ID and factory ID are required' },
        { status: 400 }
      );
    }

    // Update the order with factory allocation
    const updateData: any = {
      assigned_manufacturer_id,
      factory_payment_status: factory_payment_status || 'pending',
    };

    if (factory_amount !== undefined && factory_amount !== null) {
      updateData.factory_amount = factory_amount;
    }

    if (deadline) {
      updateData.deadline = deadline;
    }

    if (factory_payment_date) {
      updateData.factory_payment_date = factory_payment_date;
    }

    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error allocating factory:', error);
      return NextResponse.json(
        { error: 'Failed to allocate factory' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Factory allocation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
