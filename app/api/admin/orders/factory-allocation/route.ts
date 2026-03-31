import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendFactoryAssignmentEmail } from '@/lib/gmail';

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

    const adminClient = createAdminClient();

    const { data: existingOrder } = await adminClient
      .from('orders')
      .select('assigned_manufacturer_id, customer_note, share_token')
      .eq('id', orderId)
      .single();

    const previousManufacturerId = existingOrder?.assigned_manufacturer_id ?? null;
    const isNewFactoryAssignment = assigned_manufacturer_id !== previousManufacturerId;

    const updateData: Record<string, unknown> = {
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

    if (isNewFactoryAssignment) {
      const { data: manufacturer } = await adminClient
        .from('manufacturers')
        .select('id, name, email')
        .eq('id', assigned_manufacturer_id)
        .single();

      if (manufacturer?.email) {
        sendFactoryAssignmentEmail({
          factoryName: manufacturer.name,
          factoryEmail: manufacturer.email,
          orderId,
          deadline: deadline ?? null,
          factoryAmount: factory_amount ?? null,
          customerNote: existingOrder?.customer_note ?? null,
          shareToken: data?.share_token ?? existingOrder?.share_token ?? null,
        }).catch((err) => console.error('Factory assignment email failed:', err));
      }
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
