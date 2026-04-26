import { NextRequest, NextResponse } from 'next/server';
import CloudConvert from 'cloudconvert';

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'jobId is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.CLOUDCONVERT_API_KEY || process.env.NEXT_PUBLIC_CLOUDCONVERT_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'CloudConvert API key is not configured' },
        { status: 500 }
      );
    }

    const cloudConvert = new CloudConvert(apiKey);
    const job = await cloudConvert.jobs.get(jobId);

    if (job.status === 'finished') {
      const exportTask = job.tasks?.find(
        (t) => t.name === 'export-file' && t.status === 'finished'
      );
      const pngUrl = exportTask?.result?.files?.[0]?.url;

      if (!pngUrl) {
        return NextResponse.json(
          { success: false, status: 'error', error: 'Export URL not found' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, status: 'finished', pngUrl });
    }

    if (job.status === 'error') {
      const failed = job.tasks?.find((t) => t.status === 'error');
      return NextResponse.json({
        success: false,
        status: 'error',
        error: failed?.message || 'Job failed',
        code: failed?.code || null,
      });
    }

    return NextResponse.json({
      success: true,
      status: 'processing',
      jobStatus: job.status,
    });
  } catch (error) {
    console.error('status error:', error);
    return NextResponse.json(
      {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
