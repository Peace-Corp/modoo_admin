import { NextRequest, NextResponse } from 'next/server';
import CloudConvert from 'cloudconvert';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (!fileExtension || !['ai', 'psd'].includes(fileExtension)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only AI and PSD files are supported.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_CLOUDCONVERT_API_KEY;

    if (!apiKey) {
      console.error('CloudConvert API key not found');
      return NextResponse.json(
        { success: false, error: 'CloudConvert API key is not configured' },
        { status: 500 }
      );
    }

    console.log(`Converting ${fileExtension.toUpperCase()} file to PNG:`, file.name);

    const cloudConvert = new CloudConvert(apiKey);
    const inputFormat = fileExtension === 'ai' ? 'ai' : 'psd';

    const jobConfig: any = {
      tasks: {
        'upload-file': {
          operation: 'import/upload',
        },
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

    let job;
    try {
      job = await cloudConvert.jobs.create(jobConfig);
    } catch (createError: any) {
      console.error('CloudConvert job creation failed:', createError);
      return NextResponse.json(
        {
          success: false,
          error: `CloudConvert job creation failed: ${createError.message || 'Unknown error'}`,
          details: createError.response?.data || createError,
        },
        { status: 422 }
      );
    }

    const uploadTask = job.tasks?.find((task) => task.name === 'upload-file');

    if (!uploadTask || !uploadTask.result?.form) {
      throw new Error('Upload task not found in job');
    }

    const uploadFormData = new FormData();
    const form = uploadTask.result.form;

    Object.keys(form.parameters).forEach((key) => {
      uploadFormData.append(key, form.parameters[key]);
    });

    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });
    uploadFormData.append('file', blob, file.name);

    const uploadResponse = await fetch(form.url, {
      method: 'POST',
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    job = await cloudConvert.jobs.wait(job.id);

    const exportTask = job.tasks?.find(
      (task) => task.name === 'export-file' && task.status === 'finished'
    );

    if (!exportTask || !exportTask.result?.files?.[0]?.url) {
      throw new Error('Export task failed or URL not found');
    }

    const pngUrl = exportTask.result.files[0].url;
    const pngResponse = await fetch(pngUrl);

    if (!pngResponse.ok) {
      throw new Error(`Failed to download converted PNG: ${pngResponse.statusText}`);
    }

    const pngArrayBuffer = await pngResponse.arrayBuffer();

    return new NextResponse(pngArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': pngArrayBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('CloudConvert conversion error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown conversion error',
      },
      { status: 500 }
    );
  }
}
