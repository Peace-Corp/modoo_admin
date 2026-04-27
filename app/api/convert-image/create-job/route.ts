import { NextRequest, NextResponse } from 'next/server';
import CloudConvert from 'cloudconvert';

export async function POST(request: NextRequest) {
  try {
    const { ext } = (await request.json()) as { ext?: string };
    const inputFormat = ext?.toLowerCase();

    if (!inputFormat || !['ai', 'psd'].includes(inputFormat)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only AI and PSD files are supported.' },
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

    const jobConfig: any = {
      tasks: {
        'upload-file': { operation: 'import/upload' },
        'convert-file': {
          operation: 'convert',
          input: 'upload-file',
          input_format: inputFormat,
          output_format: 'png',
        },
        'export-file': {
          operation: 'export/url',
          input: 'convert-file',
        },
      },
    };

    if (inputFormat === 'psd') {
      jobConfig.tasks['convert-file'].flatten = true;
    }

    if (inputFormat === 'ai') {
      jobConfig.tasks = {
        'upload-file': { operation: 'import/upload' },
        'convert-to-pdf': {
          operation: 'convert',
          input: 'upload-file',
          input_format: 'ai',
          output_format: 'pdf',
        },
        'convert-file': {
          operation: 'convert',
          input: 'convert-to-pdf',
          input_format: 'pdf',
          output_format: 'png',
          pixel_density: 150,
          alpha: true,
        },
        'export-file': {
          operation: 'export/url',
          input: 'convert-file',
        },
      };
    }

    let job;
    try {
      job = await cloudConvert.jobs.create(jobConfig);
    } catch (createError: any) {
      console.error('CloudConvert job creation failed:', createError);
      return NextResponse.json(
        {
          success: false,
          error: `CloudConvert job creation failed: ${createError.message || 'Unknown error'}`,
          details: createError.response?.data || null,
        },
        { status: 422 }
      );
    }

    const uploadTask = job.tasks?.find((t) => t.name === 'upload-file');
    if (!uploadTask || !uploadTask.result?.form) {
      return NextResponse.json(
        { success: false, error: 'Upload task form missing in job response' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      uploadForm: {
        url: uploadTask.result.form.url,
        parameters: uploadTask.result.form.parameters,
      },
    });
  } catch (error) {
    console.error('create-job error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
