/**
 * Client-side CloudConvert utility for converting AI/PSD files to PNG
 * This calls the server-side API route that handles the actual CloudConvert conversion
 */

export interface ConversionResult {
  success: boolean;
  pngBlob?: Blob;
  error?: string;
}

/**
 * Convert AI or PSD file to PNG using CloudConvert API (via server-side API route)
 * @param file - The AI or PSD file to convert
 * @returns ConversionResult with PNG blob or error
 */
export async function convertToPNG(file: File): Promise<ConversionResult> {
  try {
    console.log(`Converting ${file.name} to PNG via API...`);

    // Create FormData to send file to API route
    const formData = new FormData();
    formData.append('file', file);

    // Call the server-side API route
    const response = await fetch('/api/convert-image', {
      method: 'POST',
      body: formData,
    });

    // Check if response is JSON (error) or binary (success)
    const contentType = response.headers.get('content-type');

    if (!response.ok) {
      // Error response - parse JSON
      const errorData = await response.json();
      console.error('Conversion failed:', errorData);

      // Log detailed error information
      if (errorData.details) {
        console.error('Error details:', errorData.details);
      }

      return {
        success: false,
        error: errorData.error || errorData.message || 'Conversion failed',
      };
    }

    if (contentType?.includes('image/png')) {
      // Success - get PNG blob
      const pngBlob = await response.blob();
      console.log('PNG conversion successful, blob size:', pngBlob.size);

      return {
        success: true,
        pngBlob,
      };
    } else {
      throw new Error('Unexpected response format from API');
    }
  } catch (error) {
    console.error('CloudConvert conversion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown conversion error',
    };
  }
}

/**
 * Check if a file is an AI or PSD file
 * @param file - The file to check
 * @returns true if file is AI or PSD
 */
export function isAiOrPsdFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension === 'ai' || extension === 'psd';
}

/**
 * Get user-friendly error message for conversion errors
 * @param error - Error message from conversion
 * @returns User-friendly error message in Korean
 */
export function getConversionErrorMessage(error?: string): string {
  if (!error) return '알 수 없는 오류가 발생했습니다.';

  if (error.includes('API key')) {
    return 'CloudConvert API 키가 설정되지 않았습니다.';
  }

  if (error.includes('Upload failed')) {
    return '파일 업로드에 실패했습니다. 다시 시도해주세요.';
  }

  if (error.includes('Export task failed')) {
    return '파일 변환에 실패했습니다. 파일이 손상되었을 수 있습니다.';
  }

  if (error.includes('job creation failed') || error.includes('Unprocessable')) {
    return '파일 변환이 지원되지 않습니다. AI 파일의 경우 PDF나 SVG로 먼저 변환해주세요.';
  }

  return `파일 변환 중 오류가 발생했습니다: ${error}`;
}