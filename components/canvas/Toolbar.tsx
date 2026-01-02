import React, { useState, useMemo, useEffect } from 'react';
import * as fabric from 'fabric';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Plus, TextCursor, Layers, FileImage, Trash2, RefreshCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { ProductSide } from '@/types/types';
import TextStylePanel from './TextStylePanel';
import { uploadFileToStorage } from '@/lib/supabase-storage';
import { STORAGE_BUCKETS, STORAGE_FOLDERS } from '@/lib/storage-config';
import { createClient } from '@/lib/supabase-client';
import { convertToPNG, isAiOrPsdFile, getConversionErrorMessage } from '@/lib/cloudconvert';
import LoadingModal from '@/app/components/LoadingModal';

interface ToolbarProps {
  sides?: ProductSide[];
  handleExitEditMode?: () => void;
  variant?: 'mobile' | 'desktop';
}

const Toolbar: React.FC<ToolbarProps> = ({ sides = [], handleExitEditMode, variant = 'mobile' }) => {
  const { getActiveCanvas, activeSideId, setActiveSide, isEditMode, canvasMap, incrementCanvasVersion, zoomIn, zoomOut, getZoomLevel } = useCanvasStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null);
  const [color, setColor] = useState("");
  const currentZoom = getZoomLevel();
  const isDesktop = variant === 'desktop';

  // Loading modal state
  const [isLoadingModalOpen, setIsLoadingModalOpen] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingSubmessage, setLoadingSubmessage] = useState('');
  // const canvas = getActiveCanvas();

  const handleObjectSelection = (object : fabric.FabricObject | null) => {
    // console.log('handleObjectSelection called with:', object?.type);

    if (!object) {
      setSelectedObject(null);
      return;
    }

    setSelectedObject(object);

    if (object.type === "i-text" || object.type === "text") {
    }
  }

  // Resetting states
  const clearSettings = () => {
    setColor("");
  }

  useEffect(() => {
    const canvas = getActiveCanvas();
    if (!canvas) {
      setSelectedObject(null);
      return;
    }

    // Clear any existing selection when switching canvases
    setSelectedObject(null);

    const handleSelectionCreated = (options: { selected: fabric.FabricObject[] }) => {
      const selected = options.selected?.[0] || canvas.getActiveObject();
      handleObjectSelection(selected || null);
    };

    const handleSelectionUpdated = (options: { selected: fabric.FabricObject[]; deselected: fabric.FabricObject[] }) => {
      const selected = options.selected?.[0] || canvas.getActiveObject();
      handleObjectSelection(selected || null);
    };

    const handleSelectionCleared = () => {
      handleObjectSelection(null);
      clearSettings();
    };

    const handleObjectModified = (options: { target?: fabric.FabricObject }) => {
      const target = options.target || canvas.getActiveObject();
      handleObjectSelection(target || null);
      // Trigger pricing recalculation when object is modified (scaled, rotated, etc.)
      incrementCanvasVersion();
    };

    const handleObjectScaling = (options: { target?: fabric.FabricObject }) => {
      const target = options.target || canvas.getActiveObject();
      handleObjectSelection(target || null);
      // Trigger pricing recalculation when object is scaling
      incrementCanvasVersion();
    };

    canvas.on("selection:created", handleSelectionCreated);
    canvas.on("selection:updated", handleSelectionUpdated);
    canvas.on("selection:cleared", handleSelectionCleared);
    canvas.on("object:modified", handleObjectModified);
    canvas.on("object:scaling", handleObjectScaling);

    return () => {
      console.log('Cleaning up canvas event listeners');
      canvas.off("selection:created", handleSelectionCreated);
      canvas.off("selection:updated", handleSelectionUpdated);
      canvas.off("selection:cleared", handleSelectionCleared);
      canvas.off("object:modified", handleObjectModified);
      canvas.off("object:scaling", handleObjectScaling);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSideId, canvasMap]);
  
  


  const addText = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return; // for error handling

    const text = new fabric.IText('텍스트', {
      left: canvas.width / 2,
      top: canvas.height / 2,
      originX: 'center',
      originY: 'center',
      fontFamily: 'Arial',
      fill: '#333',
      fontSize: 30,
    })

    canvas.add(text);
    canvas.setActiveObject(text); // set the selected object to the text once created
    canvas.renderAll();  // render the new object

    // Manually trigger selection handler for newly created text
    handleObjectSelection(text);

    // Trigger pricing recalculation
    incrementCanvasVersion();
  };

  const addImage = async () => {
    const canvas = getActiveCanvas();
    if (!canvas) return; // for error handling

    // Create a hidden file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.ai,.psd'; // Accept images, AI, and PSD files

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      try {
        // Create Supabase client for browser
        const supabase = createClient();

        let displayUrl: string;
        let originalFileUploadResult;

        // Check if file is AI or PSD and needs conversion
        if (isAiOrPsdFile(file)) {
          console.log('AI/PSD file detected, converting to PNG...');

          // Show loading modal for conversion
          setLoadingMessage('파일 변환 중...');
          setLoadingSubmessage('AI/PSD 파일을 PNG로 변환하고 있습니다. 잠시만 기다려주세요.');
          setIsLoadingModalOpen(true);

          // Convert AI/PSD to PNG
          const conversionResult = await convertToPNG(file);

          if (!conversionResult.success || !conversionResult.pngBlob) {
            setIsLoadingModalOpen(false);
            const errorMessage = getConversionErrorMessage(conversionResult.error);
            console.error('Conversion failed:', conversionResult.error);
            alert(errorMessage);
            return;
          }

          console.log('Conversion successful, uploading original file and converted PNG...');

          // Update loading message for upload phase
          setLoadingMessage('파일 업로드 중...');
          setLoadingSubmessage('변환된 파일을 저장하고 있습니다.');

          // Upload the ORIGINAL AI/PSD file to Supabase
          originalFileUploadResult = await uploadFileToStorage(
            supabase,
            file,
            STORAGE_BUCKETS.USER_DESIGNS,
            STORAGE_FOLDERS.IMAGES
          );

          if (!originalFileUploadResult.success || !originalFileUploadResult.url) {
            setIsLoadingModalOpen(false);
            console.error('Failed to upload original file:', originalFileUploadResult.error);
            alert('원본 파일 업로드에 실패했습니다. 다시 시도해주세요.');
            return;
          }

          console.log('Original file uploaded:', originalFileUploadResult.url);

          // Create a PNG file from the blob for canvas display
          const pngFile = new File([conversionResult.pngBlob], `${file.name.split('.')[0]}.png`, {
            type: 'image/png',
          });

          // Upload the converted PNG for display
          const pngUploadResult = await uploadFileToStorage(
            supabase,
            pngFile,
            STORAGE_BUCKETS.USER_DESIGNS,
            STORAGE_FOLDERS.IMAGES
          );

          if (!pngUploadResult.success || !pngUploadResult.url) {
            setIsLoadingModalOpen(false);
            console.error('Failed to upload PNG:', pngUploadResult.error);
            alert('변환된 이미지 업로드에 실패했습니다.');
            return;
          }

          // Use the PNG URL for display
          displayUrl = pngUploadResult.url;
          console.log('PNG uploaded for display:', displayUrl);
        } else {
          // Regular image file - upload as usual
          console.log('Uploading image to Supabase...');

          originalFileUploadResult = await uploadFileToStorage(
            supabase,
            file,
            STORAGE_BUCKETS.USER_DESIGNS,
            STORAGE_FOLDERS.IMAGES
          );

          if (!originalFileUploadResult.success || !originalFileUploadResult.url) {
            console.error('Failed to upload image:', originalFileUploadResult.error);
            alert('이미지 업로드에 실패했습니다. 다시 시도해주세요.');
            return;
          }

          // Use the original image URL for display
          displayUrl = originalFileUploadResult.url;
          console.log('Image uploaded successfully:', displayUrl);
        }

        // Load image from display URL
        fabric.FabricImage.fromURL(displayUrl, {
          crossOrigin: 'anonymous',
        }).then((img) => {
          // Scale image to fit canvas if it's too large
          const maxWidth = canvas.width * 0.5;
          const maxHeight = canvas.height * 0.5;

          if (img.width > maxWidth || img.height > maxHeight) {
            const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
            img.scale(scale);
          }

          // Center the image on canvas
          img.set({
            left: canvas.width / 2,
            top: canvas.height / 2,
            originX: 'center',
            originY: 'center',
          });

          // Store Supabase metadata in the image object
          // @ts-expect-error - Adding custom data property to FabricImage
          img.data = {
            // @ts-expect-error - Reading data property
            ...(img.data || {}),
            supabaseUrl: displayUrl, // URL of the display image (PNG for AI/PSD)
            supabasePath: originalFileUploadResult.path, // Path to original file
            originalFileUrl: originalFileUploadResult.url, // URL of original file (AI/PSD or image)
            originalFileName: file.name,
            fileType: file.type || 'unknown',
            isConverted: isAiOrPsdFile(file), // Flag to indicate if file was converted
            uploadedAt: new Date().toISOString(),
          };

          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();

          // Trigger pricing recalculation
          incrementCanvasVersion();

          // Hide loading modal
          setIsLoadingModalOpen(false);

          // Show success message for converted files
          if (isAiOrPsdFile(file)) {
            // Show brief success message
            setLoadingMessage('완료!');
            setLoadingSubmessage('파일이 성공적으로 추가되었습니다.');
            setIsLoadingModalOpen(true);

            // Auto-hide after 1.5 seconds
            setTimeout(() => {
              setIsLoadingModalOpen(false);
            }, 1500);
          }
        }).catch((error) => {
          setIsLoadingModalOpen(false);
          console.error('Failed to load image:', error);
          alert('이미지를 불러오는데 실패했습니다.');
        });
      } catch (error) {
        setIsLoadingModalOpen(false);
        console.error('Error adding image:', error);
        alert('이미지 추가 중 오류가 발생했습니다.');
      }
    };

    // Trigger file input click
    input.click();
  };

  const handleSideSelect = (sideId: string) => {
    setActiveSide(sideId);
    setIsModalOpen(false);
  };

  const handleDeleteObject = () => {
    const canvas = getActiveCanvas();
    const selectedObject = canvas?.getActiveObject();
    const selectedObjects = canvas?.getActiveObjects();

    if (selectedObjects && selectedObjects.length > 0) {
    // Remove all selected objects
    selectedObjects.forEach(obj => canvas?.remove(obj));
    // Discard the selection after removal
    canvas?.discardActiveObject()
    canvas?.renderAll();
    // Trigger pricing recalculation
    incrementCanvasVersion();
  } else if (selectedObject) {
    // Remove a single selected object
    canvas?.remove(selectedObject);
    canvas?.renderAll();
    // Trigger pricing recalculation
    incrementCanvasVersion();
    }
  }

  const handleResetCanvas = () => {
    const canvas = getActiveCanvas();

    if (!canvas) return;

    canvas.getObjects().forEach((obj) => {
      const objData = obj.get('data') as { id?: string } | undefined;
      // remove all objects except for background image, center guide line, visual guide box
      if (objData?.id !== 'background-product-image' && objData?.id !== 'center-line' && objData?.id !== 'visual-guide-box') {
        canvas.remove(obj)
      }
    })

    canvas.renderAll();

    // Trigger pricing recalculation
    incrementCanvasVersion();
  }

  // Generate canvas previews when modal is open
  const canvasPreviews = useMemo(() => {
    if (!isModalOpen) return {};

    const previews: Record<string, string> = {};
    sides.forEach((side) => {
      const canvas = canvasMap[side.id];
      if (canvas) {
        // Generate a data URL from the canvas
        previews[side.id] = canvas.toDataURL({
          format: 'png',
          quality: 0.8,
          multiplier: 0.3, // Scale down for thumbnail
        });
      }
    });
    return previews;
  }, [isModalOpen, sides, canvasMap]);

  // Only show toolbar in edit mode
  if (!isEditMode) return null;

  const currentSide = sides.find(side => side.id === activeSideId);

  if (isDesktop) {
    return (
      <>
        <div className="w-full flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={addText}
              className="flex items-center gap-2 rounded-full border border-gray-200 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
              title="텍스트 추가"
            >
              <TextCursor className="size-4" />
              텍스트
            </button>
            <button
              onClick={addImage}
              className="flex items-center gap-2 rounded-full border border-gray-200 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
              title="이미지 추가"
            >
              <FileImage className="size-4" />
              이미지
            </button>
            <button
              onClick={handleResetCanvas}
              className="flex items-center gap-2 rounded-full border border-gray-200 px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
              title="초기화"
            >
              <RefreshCcw className="size-4" />
              초기화
            </button>
            {selectedObject && (
              <button
                onClick={handleDeleteObject}
                className="flex items-center gap-2 rounded-full border border-red-200 px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                title="삭제"
              >
                <Trash2 className="size-4" />
                삭제
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => zoomOut()}
              className="p-1.5 hover:bg-gray-100 rounded-full transition"
              title="축소"
            >
              <ZoomOut className='text-black/80 size-5' />
            </button>
            <span className='text-xs text-gray-600 min-w-12 text-center'>
              {Math.round(currentZoom * 100)}%
            </span>
            <button
              onClick={() => zoomIn()}
              className="p-1.5 hover:bg-gray-100 rounded-full transition"
              title="확대"
            >
              <ZoomIn className='text-black/80 size-5' />
            </button>
          </div>
        </div>

        {selectedObject && (selectedObject.type === "i-text" || selectedObject.type === "text") && (
          <TextStylePanel
            selectedObject={selectedObject as fabric.IText}
            onClose={() => setSelectedObject(null)}
          />
        )}

        {/* Loading Modal for file conversion */}
        <LoadingModal
          isOpen={isLoadingModalOpen}
          message={loadingMessage}
          submessage={loadingSubmessage}
        />
      </>
    );
  }

  return (
    <>

      {/* Exit Edit Mode Button */}
        {isEditMode && (
          <div className="w-full bg-white shadow-md z-100 fixed top-0 left-0 flex items-center justify-between px-4">
            <button
              onClick={handleExitEditMode}
              className="py-3 bg-white hover:bg-gray-100 text-gray-900 font-semibold transition flex items-center gap-2"
            >
              완료
            </button>

            <div className='flex items-center gap-3'>
              {/* Zoom controls */}
              <div className='flex items-center gap-1 border-r border-gray-300 pr-3'>
                <button
                  onClick={() => zoomOut()}
                  className='p-1.5 hover:bg-gray-100 rounded transition'
                  title="축소"
                >
                  <ZoomOut className='text-black/80 size-5' />
                </button>
                <span className='text-xs text-gray-600 min-w-12 text-center'>
                  {Math.round(currentZoom * 100)}%
                </span>
                <button
                  onClick={() => zoomIn()}
                  className='p-1.5 hover:bg-gray-100 rounded transition'
                  title="확대"
                >
                  <ZoomIn className='text-black/80 size-5' />
                </button>
              </div>

              <button onClick={handleResetCanvas} title="초기화">
                <RefreshCcw className='text-black/80 font-extralight' />
              </button>
              {selectedObject && (
                <button onClick={handleDeleteObject} title="삭제">
                  <Trash2 className='text-red-400 font-extralight' />
                </button>
              )}
            </div>
          </div>
        )}


      {/* Modal for side selection */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-white/20 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50 shadow-lg shadow-black"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">편집할 면 선택</h2>
            <div className="space-y-3">
              {sides.map((side) => (
                <button
                  key={side.id}
                  onClick={() => handleSideSelect(side.id)}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-center gap-4 ${
                    side.id === activeSideId
                      ? 'border-black bg-gray-100'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {/* Canvas Preview */}
                  <div className="flex-shrink-0 w-20 h-24 bg-gray-100 rounded border border-gray-200 overflow-hidden">
                    {canvasPreviews[side.id] ? (
                      <img
                        src={canvasPreviews[side.id]}
                        alt={`${side.name} preview`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        미리보기
                      </div>
                    )}
                  </div>

                  {/* Side Info */}
                  <div className="flex-1">
                    <div className="font-semibold">{side.name}</div>
                    {side.id === activeSideId && (
                      <div className="text-sm text-gray-600 mt-1">현재 편집 중</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}


      {/* Default Toolbar render only when no object is selected */}
      {/* Center button for side selection */}
      {sides.length > 0 && !selectedObject && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-white shadow-xl rounded-full px-6 py-3 flex items-center gap-2 hover:bg-gray-50 transition border border-gray-200"
          >
            <Layers className="size-5" />
            <span className="font-medium">{currentSide?.name || '면 선택'}</span>
          </button>
        </div>
      )}
      {!selectedObject && 
        <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-50">
          {/* Inner buttons - expand upwards */}
          <div className={`flex flex-col gap-2 transition-all duration-700 overflow-hidden ${
            isExpanded ? 'opacity-100 max-h-96' : 'opacity-0 max-h-0'
          }`}>
            <button
              onClick={addText}
            >
              <div className='bg-white rounded-full p-3 text-sm font-medium transition hover:bg-gray-50 border border-gray-200 whitespace-nowrap'>
                <TextCursor />
              </div>
              <p className='text-xs'>텍스트</p>
            </button>
            <button
              onClick={addImage}
            >
              <div className='bg-white rounded-full p-3 text-sm font-medium transition hover:bg-gray-50 border border-gray-200 whitespace-nowrap'>
                <FileImage />
              </div>
              <p className='text-xs'>이미지</p>
            </button>
          </div>

          {/* Plus button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`size-12 ${isExpanded ? "bg-black text-white" : "bg-white text-black"} shadow-xl rounded-full flex items-center justify-center hover:bg-gray-200 transition-all duration-300`}
            aria-label={isExpanded ? 'Close menu' : 'Open menu'}
          >
            <Plus className={`${isExpanded ? 'rotate-45' : ''} size-8 transition-all duration-300`}/>
          </button>
        </div>
      }


      {/* Render if selected item is text */}
      {selectedObject && (selectedObject.type === "i-text" || selectedObject.type === "text") && (
        <TextStylePanel
          selectedObject={selectedObject as fabric.IText}
          onClose={() => setSelectedObject(null)}
        />
      )}

      {/* Loading Modal for file conversion */}
      <LoadingModal
        isOpen={isLoadingModalOpen}
        message={loadingMessage}
        submessage={loadingSubmessage}
      />

    </>
  );
}

export default Toolbar;
