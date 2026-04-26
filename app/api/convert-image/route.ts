import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        'This endpoint has been replaced. Use /api/convert-image/create-job and /api/convert-image/status.',
    },
    { status: 410 }
  );
}
