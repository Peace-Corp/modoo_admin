import React, { useState, useMemo, useEffect } from 'react';
import * as fabric from 'fabric';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Plus, TextCursor, Layers, FileImage, Trash2, RefreshCcw, ZoomIn, ZoomOut, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Undo2, Redo2 } from 'lucide-react';
import { ProductSide } from '@/types/types';
import TextStylePanel from './TextStylePanel';
import { isCurvedText } from '@/lib/curvedText';
import { uploadFileToStorage } from '@/lib/supabase-storage';
import { STORAGE_BUCKETS, STORAGE_FOLDERS } from '@/lib/storage-config';
import { createClient } from '@/lib/supabase-client';
import { convertToPNG, isAiOrPsdFile, getConversionErrorMessage, MAX_UPLOAD_BYTES } from '@/lib/cloudconvert';
import LoadingModal from '@/components/LoadingModal';

interface ToolbarProps {
  sides?: ProductSide[];
  handleExitEditMode?: () => void;
  variant?: 'mobile' | 'desktop' | 'editor';
  horizontal?: boolean;
  onSelectedObjectChange?: (obj: fabric.FabricObject | null) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ sides = [], handleExitEditMode, variant = 'mobile', horizontal = false, onSelectedObjectChange }) => {
  const { getActiveCanvas, activeSideId, setActiveSide, isEditMode, canvasMap, incrementCanvasVersion, zoomIn, zoomOut, getZoomLevel, undo, redo, canUndo, canRedo } = useCanvasStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null);
  const [color, setColor] = useState("");
  const currentZoom = getZoomLevel();
  const isDesktop = variant === 'desktop' || variant === 'editor';

  // Loading modal state
  const [isLoadingModalOpen, setIsLoadingModalOpen] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingSubmessage, setLoadingSubmessage] = useState('');

  // Image upload popup state
  const [isImagePopupOpen, setIsImagePopupOpen] = useState(false);
  const [imageUploadAgreed, setImageUploadAgreed] = useState(false);
  // const canvas = getActiveCanvas();

  const handleObjectSelection = (object : fabric.FabricObject | null) => {
    // console.log('handleObjectSelection called with:', object?.type);

    if (!object) {
      setSelectedObject(null);
      onSelectedObjectChange?.(null);
      return;
    }

    setSelectedObject(object);
    onSelectedObjectChange?.(object);

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

  const handleAddImageClick = () => {
    console.log('handleAddImageClick called - showing modal');
    setImageUploadAgreed(false);
    setIsImagePopupOpen(true);
  };

  const handleImagePopupConfirm = () => {
    if (!imageUploadAgreed) return;
    setIsImagePopupOpen(false);
    addImage();
  };

  const addSingleImageToCanvas = async (file: File, canvas: fabric.Canvas) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      alert(
        `파일이 너무 큽니다 (현재 ${mb}MB / 최대 50MB)\n\n` +
        `아래 방법 중 하나로 진행해주세요:\n` +
        `1) 더 작은 파일(최대 50MB)로 다시 업로드\n` +
        `2) 디자인을 완료한 뒤 [주문 요청사항] 탭에서 첨부파일로 추가\n` +
        `3) modoo.contact@gmail.com 으로 원본 파일 전달`
      );
      return;
    }

    const supabase = createClient();

    let displayUrl: string;
    let originalFileUploadResult;

    if (isAiOrPsdFile(file)) {
      console.log('AI/PSD file detected, converting to PNG...');

      setLoadingMessage('파일 변환 중...');
      setLoadingSubmessage(`${file.name} - AI/PSD 파일을 PNG로 변환하고 있습니다. (최대 수 분 소요)`);
      setIsLoadingModalOpen(true);

      // Conversion + original-file upload run in parallel.
      const [conversionResult, origUploadResult] = await Promise.all([
        convertToPNG(file),
        uploadFileToStorage(
          supabase,
          file,
          STORAGE_BUCKETS.USER_DESIGNS,
          STORAGE_FOLDERS.IMAGES
        ),
      ]);

      if (!conversionResult.success || !conversionResult.pngBlob) {
        setIsLoadingModalOpen(false);
        const errorMessage = getConversionErrorMessage(conversionResult.error);
        console.error('Conversion failed:', conversionResult.error);
        alert(errorMessage);
        return;
      }

      if (!origUploadResult.success || !origUploadResult.url) {
        setIsLoadingModalOpen(false);
        const rawErr = origUploadResult.error || '';
        console.error('Failed to upload original file:', rawErr);
        const friendly = rawErr.includes('exceeded the maximum')
          ? '파일 용량이 서버 한도를 초과했습니다 (최대 50MB).\n\n' +
            '아래 방법 중 하나로 진행해주세요:\n' +
            '1) 더 작은 파일(최대 50MB)로 다시 업로드\n' +
            '2) 디자인을 완료한 뒤 [주문 요청사항] 탭에서 첨부파일로 추가\n' +
            '3) modoo.contact@gmail.com 으로 원본 파일 전달'
          : `원본 파일 업로드에 실패했습니다.\n사유: ${rawErr || '알 수 없음'}`;
        alert(friendly);
        return;
      }

      originalFileUploadResult = origUploadResult;

      setLoadingMessage('파일 업로드 중...');
      setLoadingSubmessage(`${file.name} - 변환된 PNG를 저장하고 있습니다.`);

      const pngFile = new File([conversionResult.pngBlob], `${file.name.split('.')[0]}.png`, {
        type: 'image/png',
      });

      const pngUploadResult = await uploadFileToStorage(
        supabase,
        pngFile,
        STORAGE_BUCKETS.USER_DESIGNS,
        STORAGE_FOLDERS.IMAGES
      );

      if (!pngUploadResult.success || !pngUploadResult.url) {
        setIsLoadingModalOpen(false);
        const rawErr = pngUploadResult.error || '';
        console.error('Failed to upload PNG:', rawErr);
        const friendly = rawErr.includes('exceeded the maximum')
          ? '변환된 PNG가 서버 한도를 초과했습니다 (최대 50MB).\n\n' +
            '아래 방법 중 하나로 진행해주세요:\n' +
            '1) 더 작은 파일(최대 50MB)로 다시 업로드\n' +
            '2) 디자인을 완료한 뒤 [주문 요청사항] 탭에서 첨부파일로 추가\n' +
            '3) modoo.contact@gmail.com 으로 원본 파일 전달'
          : `변환된 이미지 업로드에 실패했습니다.\n사유: ${rawErr || '알 수 없음'}`;
        alert(friendly);
        return;
      }

      displayUrl = pngUploadResult.url;
    } else {
      originalFileUploadResult = await uploadFileToStorage(
        supabase,
        file,
        STORAGE_BUCKETS.USER_DESIGNS,
        STORAGE_FOLDERS.IMAGES
      );

      if (!originalFileUploadResult.success || !originalFileUploadResult.url) {
        const rawErr = originalFileUploadResult.error || '';
        console.error('Failed to upload image:', rawErr);
        const friendly = rawErr.includes('exceeded the maximum')
          ? '파일 용량이 서버 한도를 초과했습니다 (최대 50MB).\n\n' +
            '아래 방법 중 하나로 진행해주세요:\n' +
            '1) 더 작은 파일(최대 50MB)로 다시 업로드\n' +
            '2) 디자인을 완료한 뒤 [주문 요청사항] 탭에서 첨부파일로 추가\n' +
            '3) modoo.contact@gmail.com 으로 원본 파일 전달'
          : `이미지 업로드에 실패했습니다: ${file.name}\n사유: ${rawErr || '알 수 없음'}`;
        alert(friendly);
        return;
      }

      displayUrl = originalFileUploadResult.url;
    }

    const img = await fabric.FabricImage.fromURL(displayUrl, {
      crossOrigin: 'anonymous',
    });

    const maxWidth = canvas.width * 0.5;
    const maxHeight = canvas.height * 0.5;

    if (img.width > maxWidth || img.height > maxHeight) {
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
      img.scale(scale);
    }

    img.set({
      left: canvas.width / 2,
      top: canvas.height / 2,
      originX: 'center',
      originY: 'center',
    });

    // @ts-expect-error - Adding custom data property to FabricImage
    img.data = {
      // @ts-expect-error - Reading data property
      ...(img.data || {}),
      supabaseUrl: displayUrl,
      supabasePath: originalFileUploadResult.path,
      originalFileUrl: originalFileUploadResult.url,
      originalFileName: file.name,
      fileType: file.type || 'unknown',
      isConverted: isAiOrPsdFile(file),
      uploadedAt: new Date().toISOString(),
    };

    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.renderAll();
    incrementCanvasVersion();
  };

  const addImage = async () => {
    console.log('addImage called - opening file picker');
    const canvas = getActiveCanvas();
    if (!canvas) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.ai,.psd';
    input.multiple = true;

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;
      if (!files || files.length === 0) return;

      const fileList = Array.from(files);
      const totalCount = fileList.length;
      const hasConvertible = fileList.some(isAiOrPsdFile);

      if (totalCount > 1 || hasConvertible) {
        setLoadingMessage('이미지 업로드 중...');
        setLoadingSubmessage(`${totalCount}개 파일 처리 중...`);
        setIsLoadingModalOpen(true);
      }

      let successCount = 0;
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (totalCount > 1) {
          setLoadingSubmessage(`(${i + 1}/${totalCount}) ${file.name} 처리 중...`);
        }
        try {
          await addSingleImageToCanvas(file, canvas);
          successCount++;
        } catch (error) {
          console.error(`Error adding image ${file.name}:`, error);
        }
      }

      if (totalCount > 1 || hasConvertible) {
        setLoadingMessage('완료!');
        setLoadingSubmessage(`${successCount}개 파일이 추가되었습니다.`);
        setIsLoadingModalOpen(true);
        setTimeout(() => setIsLoadingModalOpen(false), 1500);
      } else {
        setIsLoadingModalOpen(false);
      }
    };

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
      // remove all objects except for background image and center guide line
      if (objData?.id !== 'background-product-image' && objData?.id !== 'center-line') {
        canvas.remove(obj)
      }
    })

    canvas.renderAll();

    // Trigger pricing recalculation
    incrementCanvasVersion();
  }

  // Layer manipulation functions
  const bringToFront = () => {
    const canvas = getActiveCanvas();
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      canvas.bringObjectToFront(activeObject);
      canvas.renderAll();
    }
  };

  const sendToBack = () => {
    const canvas = getActiveCanvas();
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      const objects = canvas.getObjects();
      const systemObjects = objects.filter(obj => {
        const objData = obj.get('data') as { id?: string } | undefined;
        return objData?.id === 'background-product-image' ||
               objData?.id === 'center-line' ||
               obj.get('excludeFromExport') === true;
      });

      const maxSystemIndex = Math.max(...systemObjects.map(obj => objects.indexOf(obj)), -1);
      const currentIndex = objects.indexOf(activeObject);
      const targetIndex = maxSystemIndex + 1;

      if (currentIndex > targetIndex) {
        canvas.remove(activeObject);
        canvas.insertAt(targetIndex, activeObject);
        canvas.setActiveObject(activeObject);
        canvas.renderAll();
      }
    }
  };

  const bringForward = () => {
    const canvas = getActiveCanvas();
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      canvas.bringObjectForward(activeObject);
      canvas.renderAll();
    }
  };

  const sendBackward = () => {
    const canvas = getActiveCanvas();
    const activeObject = canvas?.getActiveObject();
    if (canvas && activeObject) {
      const objects = canvas.getObjects();
      const systemObjects = objects.filter(obj => {
        const objData = obj.get('data') as { id?: string } | undefined;
        return objData?.id === 'background-product-image' ||
               objData?.id === 'center-line' ||
               obj.get('excludeFromExport') === true;
      });

      const maxSystemIndex = Math.max(...systemObjects.map(obj => objects.indexOf(obj)), -1);
      const currentIndex = objects.indexOf(activeObject);
      if (currentIndex > maxSystemIndex + 1) {
        canvas.sendObjectBackwards(activeObject);
        canvas.renderAll();
      }
    }
  };

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

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input or textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Skip if a fabric.js IText is in editing mode
      const canvas = getActiveCanvas();
      const active = canvas?.getActiveObject();
      if (active && 'isEditing' in active && (active as fabric.IText).isEditing) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        redo();
      } else if (isCtrlOrCmd && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (!canvas) return;
        const selectedObjects = canvas.getActiveObjects();
        if (selectedObjects.length > 0) {
          e.preventDefault();
          selectedObjects.forEach(obj => canvas.remove(obj));
          canvas.discardActiveObject();
          canvas.renderAll();
          incrementCanvasVersion();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [getActiveCanvas, undo, redo, incrementCanvasVersion]);

  // Only show toolbar in edit mode
  if (!isEditMode) return null;

  const currentSide = sides.find(side => side.id === activeSideId);

  // Compact editor variant – dark vertical tool sidebar (Photoshop-like)
  if (variant === 'editor') {
    const editorBtnBase = 'p-1.5 rounded transition-colors flex items-center justify-center';
    const editorBtnIdle = 'text-neutral-400 hover:text-white hover:bg-neutral-700';
    const editorBtnDisabled = 'text-neutral-600 cursor-not-allowed';

    return (
      <>
        <div className={horizontal
          ? "h-9 bg-neutral-800 flex flex-row items-center px-2 gap-0.5 shrink-0 border-b border-neutral-700"
          : "w-9 bg-neutral-800 flex flex-col items-center pt-2 pb-1 gap-0.5 shrink-0 border-r border-neutral-700"
        }>
          {/* Add tools */}
          <button onClick={addText} className={`${editorBtnBase} ${editorBtnIdle}`} title="텍스트 추가">
            <TextCursor className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleAddImageClick} className={`${editorBtnBase} ${editorBtnIdle}`} title="이미지 추가">
            <FileImage className="w-3.5 h-3.5" />
          </button>

          <div className={horizontal ? "h-5 border-l border-neutral-600 mx-1" : "w-5 border-t border-neutral-600 my-1"} />

          {/* Layer controls */}
          <button onClick={bringToFront} disabled={!selectedObject} className={`${editorBtnBase} ${selectedObject ? editorBtnIdle : editorBtnDisabled}`} title="맨 앞으로">
            <ChevronsUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={bringForward} disabled={!selectedObject} className={`${editorBtnBase} ${selectedObject ? editorBtnIdle : editorBtnDisabled}`} title="앞으로">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={sendBackward} disabled={!selectedObject} className={`${editorBtnBase} ${selectedObject ? editorBtnIdle : editorBtnDisabled}`} title="뒤로">
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={sendToBack} disabled={!selectedObject} className={`${editorBtnBase} ${selectedObject ? editorBtnIdle : editorBtnDisabled}`} title="맨 뒤로">
            <ChevronsDown className="w-3.5 h-3.5" />
          </button>

          <div className={horizontal ? "h-5 border-l border-neutral-600 mx-1" : "w-5 border-t border-neutral-600 my-1"} />

          {/* Undo/Redo */}
          <button onClick={() => undo()} disabled={!canUndo()} className={`${editorBtnBase} ${canUndo() ? editorBtnIdle : editorBtnDisabled}`} title="실행 취소 (Ctrl+Z)">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => redo()} disabled={!canRedo()} className={`${editorBtnBase} ${canRedo() ? editorBtnIdle : editorBtnDisabled}`} title="다시 실행 (Ctrl+Shift+Z)">
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className={horizontal ? "h-5 border-l border-neutral-600 mx-1" : "w-5 border-t border-neutral-600 my-1"} />

          {/* Destructive */}
          <button onClick={handleDeleteObject} disabled={!selectedObject} className={`${editorBtnBase} ${selectedObject ? 'text-red-400 hover:text-red-300 hover:bg-neutral-700' : editorBtnDisabled}`} title="삭제">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleResetCanvas} className={`${editorBtnBase} ${editorBtnIdle}`} title="초기화">
            <RefreshCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Loading Modal for file conversion */}
        <LoadingModal
          isOpen={isLoadingModalOpen}
          message={loadingMessage}
          submessage={loadingSubmessage}
        />

        {/* Image Upload Modal */}
        {isImagePopupOpen && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-200"
            onClick={() => setIsImagePopupOpen(false)}
          >
            <div
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold mb-4">이미지 파일 안내</h2>
              <div className="space-y-3 text-sm text-gray-700">
                <p><strong className="text-black">AI/PSD 파일</strong>을 권장드립니다.</p>
                <p>다른 파일 형식(PNG, JPG 등)도 사용 가능하지만, 인쇄 품질 확인을 위해 연락드릴 수 있습니다.</p>
              </div>
              <label className="flex items-start gap-3 mt-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={imageUploadAgreed}
                  onChange={(e) => setImageUploadAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                />
                <span className="text-sm text-gray-700">위 내용을 확인했습니다.</span>
              </label>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsImagePopupOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  취소
                </button>
                <button
                  onClick={handleImagePopupConfirm}
                  disabled={!imageUploadAgreed}
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (isDesktop) {
    return (
      <>
        <div className="w-full space-y-3">
          {/* Main Toolbar */}
          <div className="w-full flex items-center justify-start gap-4 rounded-md border border-gray-200 bg-white p-2">
            <div className="flex items-center gap-2">
              <button
                onClick={addText}
                className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                title="텍스트 추가"
              >
                <TextCursor className="size-4" />
                텍스트
              </button>
              <button
                onClick={handleAddImageClick}
                className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                title="이미지 추가"
              >
                <FileImage className="size-4" />
                이미지
              </button>
              <button
                onClick={handleResetCanvas}
                className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                title="초기화"
              >
                <RefreshCcw className="size-4" />
                초기화
              </button>
            </div>
          </div>

          {/* Layer Manipulation Controls - Fixed height to prevent layout shift */}
          <div className={`w-full flex items-center justify-between gap-4 rounded-md border px-5 py-3 shadow-sm transition-all ${
            selectedObject
              ? 'border-blue-200 bg-blue-50/50'
              : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold mr-2 ${selectedObject ? 'text-gray-700' : 'text-gray-400'}`}>
                레이어 조정:
              </span>
              <button
                onClick={bringToFront}
                disabled={!selectedObject}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                title="맨 앞으로"
              >
                <ChevronsUp className="size-4" />
              </button>
              <button
                onClick={bringForward}
                disabled={!selectedObject}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                title="앞으로"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                onClick={sendBackward}
                disabled={!selectedObject}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                title="뒤로"
              >
                <ArrowDown className="size-4" />
              </button>
              <button
                onClick={sendToBack}
                disabled={!selectedObject}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                title="맨 뒤로"
              >
                <ChevronsDown className="size-4" />
              </button>
            </div>

            <button
              onClick={handleDeleteObject}
              disabled={!selectedObject}
              className="flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
              title="삭제"
            >
              <Trash2 className="size-4" />
              삭제
            </button>
          </div>
        </div>

        {/* Mobile: Render TextStylePanel here, Desktop: Rendered by parent component */}
        {!isDesktop && selectedObject && (selectedObject.type === "i-text" || selectedObject.type === "text" || isCurvedText(selectedObject)) && (
          <TextStylePanel
            selectedObject={selectedObject as fabric.IText}
            onClose={() => setSelectedObject(null)}
            variant="mobile"
          />
        )}

        {/* Loading Modal for file conversion */}
        <LoadingModal
          isOpen={isLoadingModalOpen}
          message={loadingMessage}
          submessage={loadingSubmessage}
        />

        {/* Image Upload Modal */}
        {isImagePopupOpen && (
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-200"
            onClick={() => setIsImagePopupOpen(false)}
          >
            <div
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold mb-4">이미지 파일 안내</h2>
              <div className="space-y-3 text-sm text-gray-700">
                <p>
                  <strong className="text-black">AI/PSD 파일</strong>을 권장드립니다.
                </p>
                <p>
                  다른 파일 형식(PNG, JPG 등)도 사용 가능하지만, 인쇄 품질 확인을 위해 연락드릴 수 있습니다.
                </p>
              </div>
              <label className="flex items-start gap-3 mt-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={imageUploadAgreed}
                  onChange={(e) => setImageUploadAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                />
                <span className="text-sm text-gray-700">
                  위 내용을 확인했습니다.
                </span>
              </label>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsImagePopupOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  취소
                </button>
                <button
                  onClick={handleImagePopupConfirm}
                  disabled={!imageUploadAgreed}
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
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
        <div className="fixed bottom-20 right-6 flex flex-col items-end gap-3 z-50">
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
              onClick={handleAddImageClick}
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
      {selectedObject && (selectedObject.type === "i-text" || selectedObject.type === "text" || isCurvedText(selectedObject)) && (
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

      {/* Image Upload Modal */}
      {isImagePopupOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-200"
          onClick={() => setIsImagePopupOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4">이미지 파일 안내</h2>
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                <strong className="text-black">AI/PSD 파일</strong>을 권장드립니다.
              </p>
              <p>
                다른 파일 형식(PNG, JPG 등)도 사용 가능하지만, 인쇄 품질 확인을 위해 연락드릴 수 있습니다.
              </p>
            </div>
            <label className="flex items-start gap-3 mt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={imageUploadAgreed}
                onChange={(e) => setImageUploadAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
              />
              <span className="text-sm text-gray-700">
                위 내용을 확인했습니다.
              </span>
            </label>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsImagePopupOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                onClick={handleImagePopupConfirm}
                disabled={!imageUploadAgreed}
                className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

export default Toolbar;
