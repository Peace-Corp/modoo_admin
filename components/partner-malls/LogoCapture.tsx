'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, RefreshCw, Check, Loader2 } from 'lucide-react';

interface LogoCaptureProps {
  onLogoReady: (logoUrl: string, originalUrl: string) => void;
  onCancel?: () => void;
}

export default function LogoCapture({ onLogoReady, onCancel }: LogoCaptureProps) {
  const [mode, setMode] = useState<'select' | 'camera' | 'preview'>('select');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setStream(mediaStream);
      setMode('camera');

      // Wait for next render to attach to video
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      console.error('Camera access error:', err);
      setError('카메라에 접근할 수 없습니다. 권한을 확인해주세요.');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Capture photo from camera
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    setOriginalImage(dataUrl);
    stopCamera();
    processImage(dataUrl);
  }, [stopCamera]);

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('올바른 이미지 형식이 아닙니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setOriginalImage(dataUrl);
      processImage(dataUrl);
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Process image (remove background)
  const processImage = async (imageDataUrl: string) => {
    setIsProcessing(true);
    setError(null);
    setMode('preview');

    try {
      // Convert data URL to blob
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();

      // Create FormData
      const formData = new FormData();
      formData.append('image', blob, 'logo.png');

      // Call remove-background API
      const apiResponse = await fetch('/api/admin/remove-background', {
        method: 'POST',
        body: formData,
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({}));
        throw new Error(errorData?.error || '배경 제거에 실패했습니다.');
      }

      const result = await apiResponse.json();
      setProcessedImage(result.data.processed_url);
    } catch (err) {
      console.error('Image processing error:', err);
      setError(err instanceof Error ? err.message : '이미지 처리에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Retry processing
  const retryProcessing = () => {
    if (originalImage) {
      processImage(originalImage);
    }
  };

  // Reset to start
  const reset = () => {
    stopCamera();
    setOriginalImage(null);
    setProcessedImage(null);
    setError(null);
    setMode('select');
  };

  // Confirm selection
  const handleConfirm = () => {
    if (processedImage && originalImage) {
      onLogoReady(processedImage, originalImage);
    }
  };

  // Cancel and go back
  const handleCancel = () => {
    stopCamera();
    onCancel?.();
  };

  return (
    <div className="bg-white rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">로고 이미지 업로드</h2>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Hidden canvas for camera capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Selection Mode */}
      {mode === 'select' && (
        <div className="space-y-4">
          <p className="text-gray-600 mb-6">
            파트너몰 로고를 카메라로 촬영하거나 파일로 업로드해주세요.
            배경이 자동으로 제거됩니다.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={startCamera}
              className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <Camera className="w-12 h-12 text-gray-400 mb-2" />
              <span className="text-gray-700 font-medium">카메라로 촬영</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <Upload className="w-12 h-12 text-gray-400 mb-2" />
              <span className="text-gray-700 font-medium">파일 업로드</span>
            </button>
          </div>

          {onCancel && (
            <button
              onClick={handleCancel}
              className="mt-4 w-full py-2 text-gray-600 hover:text-gray-800"
            >
              취소
            </button>
          )}
        </div>
      )}

      {/* Camera Mode */}
      {mode === 'camera' && (
        <div className="space-y-4">
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => {
                stopCamera();
                setMode('select');
              }}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={capturePhoto}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              촬영하기
            </button>
          </div>
        </div>
      )}

      {/* Preview Mode */}
      {mode === 'preview' && (
        <div className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Original Image */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">원본 이미지</p>
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                {originalImage && (
                  <img
                    src={originalImage}
                    alt="Original"
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>
            </div>

            {/* Processed Image */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">배경 제거됨</p>
              <div className="aspect-square bg-[url('/checkerboard.png')] bg-repeat rounded-lg overflow-hidden flex items-center justify-center"
                style={{ backgroundColor: '#f0f0f0' }}
              >
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    <span className="text-sm text-gray-600">처리 중...</span>
                  </div>
                ) : processedImage ? (
                  <img
                    src={processedImage}
                    alt="Processed"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : error ? (
                  <div className="text-center p-4">
                    <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <span className="text-sm text-gray-600">처리 실패</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={reset}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-5 h-5" />
              다시 선택
            </button>

            {error && (
              <button
                onClick={retryProcessing}
                disabled={isProcessing}
                className="flex-1 py-3 px-4 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className="w-5 h-5" />
                다시 시도
              </button>
            )}

            {processedImage && !isProcessing && (
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                확인
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
