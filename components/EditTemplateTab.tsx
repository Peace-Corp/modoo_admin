'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Product, DesignTemplate, ProductSide, CanvasState } from '@/types/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import SingleSideCanvas from '@/components/canvas/SingleSideCanvas';
import * as fabric from 'fabric';
import {
  Save,
  X,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  TextCursor,
  FileImage,
  RefreshCcw,
  Eye,
  EyeOff,
  Layers,
  Edit2,
  Check,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Palette,
  Spline,
} from 'lucide-react';
import { CurvedText, isCurvedText, convertToCurvedText } from '@/lib/curvedText';
import { createClient } from '@/lib/supabase-client';
import { uploadFileToStorage } from '@/lib/supabase-storage';
import { STORAGE_BUCKETS, STORAGE_FOLDERS } from '@/lib/storage-config';

interface EditTemplateTabProps {
  product: Product;
  onClose: () => void;
}

export default function EditTemplateTab({ product, onClose }: EditTemplateTabProps) {
  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DesignTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state for new/edit template
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);

  // Canvas editing state
  const [isEditing, setIsEditing] = useState(false);
  const [currentSideIndex, setCurrentSideIndex] = useState(0);
  const [editedCanvasStates, setEditedCanvasStates] = useState<Record<string, CanvasState>>({});

  // Text styling state
  const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState(30);
  const [fillColor, setFillColor] = useState('#333333');
  const [fontWeight, setFontWeight] = useState('normal');
  const [fontStyle, setFontStyle] = useState('normal');
  const [underline, setUnderlineState] = useState(false);
  const [linethrough, setLinethrough] = useState(false);
  const [textAlign, setTextAlign] = useState('left');
  const [curveIntensity, setCurveIntensity] = useState(0);

  const canvasReadyRef = useRef<Record<string, { canvas: fabric.Canvas; scale: number }>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Font families available
  const fontFamilies = [
    'Arial',
    'Times New Roman',
    'Courier New',
    'Georgia',
    'Verdana',
    'Helvetica',
    'Impact',
    'Trebuchet MS',
  ];

  const {
    setEditMode,
    getActiveCanvas,
    activeSideId,
    setActiveSide,
    canvasMap,
    incrementCanvasVersion,
  } = useCanvasStore();

  const sides = product.configuration || [];
  const currentSide = sides[currentSideIndex];

  // Fetch templates for this product
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/design-templates?productId=${product.id}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '템플릿 데이터를 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setTemplates(payload?.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  }, [product.id]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Reset form when creating or selecting a template
  useEffect(() => {
    if (isCreating) {
      setFormTitle('');
      setFormDescription('');
      setFormSortOrder(templates.length);
      setFormIsActive(true);
      setEditedCanvasStates({});
    } else if (selectedTemplate) {
      setFormTitle(selectedTemplate.title);
      setFormDescription(selectedTemplate.description || '');
      setFormSortOrder(selectedTemplate.sort_order ?? 0);
      setFormIsActive(selectedTemplate.is_active ?? true);
      // Parse canvas states
      const parsedStates: Record<string, CanvasState> = {};
      if (selectedTemplate.canvas_state) {
        Object.entries(selectedTemplate.canvas_state).forEach(([sideId, state]) => {
          if (typeof state === 'string') {
            try {
              parsedStates[sideId] = JSON.parse(state);
            } catch {
              parsedStates[sideId] = { objects: [] };
            }
          } else {
            parsedStates[sideId] = state as CanvasState;
          }
        });
      }
      setEditedCanvasStates(parsedStates);
    }
  }, [isCreating, selectedTemplate, templates.length]);

  // Handle canvas ready callback
  const handleCanvasReady = useCallback((canvas: fabric.Canvas, sideId: string, canvasScale: number) => {
    canvasReadyRef.current[sideId] = { canvas, scale: canvasScale };
    setActiveSide(sideId);
  }, [setActiveSide]);

  // Update text styling state from selected object
  const updateTextStateFromObject = useCallback((obj: fabric.FabricObject | null) => {
    // Check for CurvedText, IText, or Text objects
    const isCurved = obj && isCurvedText(obj);
    const isTextType = obj && (obj.type === 'i-text' || obj.type === 'text');

    if (!obj || (!isCurved && !isTextType)) {
      setSelectedObject(null);
      setCurveIntensity(0);
      return;
    }

    setSelectedObject(obj);

    if (isCurved) {
      // Handle CurvedText object
      const curvedObj = obj as CurvedText;
      setFontFamily(curvedObj.fontFamily || 'Arial');
      setFontSize(curvedObj.fontSize || 30);
      setFillColor((curvedObj.fill as string) || '#333333');
      setFontWeight(curvedObj.fontWeight || 'normal');
      setFontStyle(curvedObj.fontStyle || 'normal');
      setUnderlineState(false); // CurvedText doesn't support underline
      setLinethrough(false); // CurvedText doesn't support linethrough
      setTextAlign('center'); // CurvedText is always centered
      setCurveIntensity(curvedObj.curveIntensity || 0);
    } else {
      // Handle IText/Text object
      const textObj = obj as fabric.IText;
      setFontFamily((textObj.fontFamily as string) || 'Arial');
      setFontSize((textObj.fontSize as number) || 30);
      setFillColor((textObj.fill as string) || '#333333');
      setFontWeight((textObj.fontWeight as string) || 'normal');
      setFontStyle((textObj.fontStyle as string) || 'normal');
      setUnderlineState(textObj.underline || false);
      setLinethrough(textObj.linethrough || false);
      setTextAlign((textObj.textAlign as string) || 'left');
      setCurveIntensity(0);
    }
  }, []);

  // Listen for canvas selection events
  useEffect(() => {
    if (!isEditing) {
      setSelectedObject(null);
      return;
    }

    const canvas = getActiveCanvas();
    if (!canvas) return;

    const handleSelectionCreated = (e: { selected: fabric.FabricObject[] }) => {
      updateTextStateFromObject(e.selected?.[0] || null);
    };

    const handleSelectionUpdated = (e: { selected: fabric.FabricObject[] }) => {
      updateTextStateFromObject(e.selected?.[0] || null);
    };

    const handleSelectionCleared = () => {
      setSelectedObject(null);
    };

    canvas.on('selection:created', handleSelectionCreated);
    canvas.on('selection:updated', handleSelectionUpdated);
    canvas.on('selection:cleared', handleSelectionCleared);

    return () => {
      canvas.off('selection:created', handleSelectionCreated);
      canvas.off('selection:updated', handleSelectionUpdated);
      canvas.off('selection:cleared', handleSelectionCleared);
    };
  }, [isEditing, activeSideId, canvasMap, getActiveCanvas, updateTextStateFromObject]);

  // Text styling functions
  const updateTextProperty = useCallback((property: string, value: unknown) => {
    if (!selectedObject) return;
    const canvas = getActiveCanvas();
    if (!canvas) return;

    selectedObject.set(property as keyof fabric.FabricObject, value);
    canvas.renderAll();
    incrementCanvasVersion();
  }, [selectedObject, getActiveCanvas, incrementCanvasVersion]);

  const handleFontFamilyChange = (value: string) => {
    setFontFamily(value);
    if (selectedObject && isCurvedText(selectedObject)) {
      // Use CurvedText's setter method for proper bounds recalculation
      (selectedObject as CurvedText).setFont(value);
      incrementCanvasVersion();
    } else {
      updateTextProperty('fontFamily', value);
    }
  };

  const handleFontSizeChange = (value: number) => {
    setFontSize(value);
    if (selectedObject && isCurvedText(selectedObject)) {
      // Use CurvedText's setter method for proper bounds recalculation
      (selectedObject as CurvedText).setFontSize(value);
      incrementCanvasVersion();
    } else {
      updateTextProperty('fontSize', value);
    }
  };

  const handleFillColorChange = (value: string) => {
    setFillColor(value);
    if (selectedObject && isCurvedText(selectedObject)) {
      // Use CurvedText's setter method
      (selectedObject as CurvedText).setFill(value);
      incrementCanvasVersion();
    } else {
      updateTextProperty('fill', value);
    }
  };

  const handleTextAlignChange = (value: string) => {
    setTextAlign(value);
    updateTextProperty('textAlign', value);
  };

  const toggleBold = () => {
    const newWeight = fontWeight === 'bold' ? 'normal' : 'bold';
    setFontWeight(newWeight);
    if (selectedObject && isCurvedText(selectedObject)) {
      // Use CurvedText's setter method for proper bounds recalculation
      (selectedObject as CurvedText).setFontWeight(newWeight);
      incrementCanvasVersion();
    } else {
      updateTextProperty('fontWeight', newWeight);
    }
  };

  const toggleItalic = () => {
    const newStyle = fontStyle === 'italic' ? 'normal' : 'italic';
    setFontStyle(newStyle);
    if (selectedObject && isCurvedText(selectedObject)) {
      // Use CurvedText's setter method for proper bounds recalculation
      (selectedObject as CurvedText).setFontStyle(newStyle);
      incrementCanvasVersion();
    } else {
      updateTextProperty('fontStyle', newStyle);
    }
  };

  const toggleUnderline = () => {
    const newUnderline = !underline;
    setUnderlineState(newUnderline);
    updateTextProperty('underline', newUnderline);
  };

  const toggleLinethrough = () => {
    const newLinethrough = !linethrough;
    setLinethrough(newLinethrough);
    updateTextProperty('linethrough', newLinethrough);
  };

  // Edit text content for CurvedText
  const handleEditCurvedText = () => {
    if (selectedObject && isCurvedText(selectedObject)) {
      (selectedObject as CurvedText).enterEditing();
    }
  };

  // Handle curve intensity change - converts between IText and CurvedText as needed
  const handleCurveIntensityChange = (value: number) => {
    setCurveIntensity(value);

    if (!selectedObject) return;
    const canvas = getActiveCanvas();
    if (!canvas) return;

    if (isCurvedText(selectedObject)) {
      // Already a CurvedText - just update the curve
      const curvedObj = selectedObject as CurvedText;
      curvedObj.setCurve(value);
      canvas.renderAll();
      incrementCanvasVersion();
    } else if (value !== 0 && (selectedObject.type === 'i-text' || selectedObject.type === 'text')) {
      // Convert IText/Text to CurvedText when curve is applied
      const textObj = selectedObject as fabric.IText;
      const newCurvedText = convertToCurvedText(textObj, value);

      // Copy custom data if it exists
      // @ts-expect-error - Accessing custom data property
      if (textObj.data) {
        // @ts-expect-error - Setting custom data property
        newCurvedText.data = { ...textObj.data };
      }

      // Update the selected object reference
      setSelectedObject(newCurvedText);
      incrementCanvasVersion();
    }
  };

  // Check if selected object is text (including CurvedText)
  const isTextSelected = selectedObject && (
    selectedObject.type === 'i-text' ||
    selectedObject.type === 'text' ||
    isCurvedText(selectedObject)
  );
  const isCurvedTextSelected = selectedObject && isCurvedText(selectedObject);

  // Enter edit mode for a template
  const startEditing = () => {
    setIsEditing(true);
    setEditMode(true);
    setCurrentSideIndex(0);
    if (sides.length > 0) {
      setActiveSide(sides[0].id);
    }
  };

  // Exit edit mode
  const stopEditing = () => {
    // Save current canvas states before exiting
    saveCanvasStates();
    setIsEditing(false);
    setEditMode(false);
  };

  // Helper to prepare objects for serialization (ensures CurvedText has accurate bounds)
  const prepareObjectsForSave = (objects: fabric.FabricObject[]) => {
    return objects.map((obj) => {
      // Ensure CurvedText objects have up-to-date bounds before serialization
      if (isCurvedText(obj)) {
        const curvedText = obj as CurvedText;
        curvedText.updateBounds();
      }
      return obj.toObject(['data']);
    });
  };

  // Save a single side's canvas state
  const saveCurrentSideState = () => {
    if (!activeSideId) return;

    const canvas = canvasMap[activeSideId];
    if (!canvas) return;

    const objects = canvas.getObjects().filter((obj) => {
      if (obj.excludeFromExport) return false;
      const objData = obj as { data?: { id?: string } };
      return objData.data?.id !== 'background-product-image';
    });

    const newState: CanvasState = {
      version: '6.0.0',
      objects: prepareObjectsForSave(objects),
    };

    setEditedCanvasStates((prev) => ({
      ...prev,
      [activeSideId]: newState,
    }));
  };

  // Save current canvas states from all canvases
  const saveCanvasStates = () => {
    setEditedCanvasStates((prev) => {
      const newStates = { ...prev };

      sides.forEach((side) => {
        const canvas = canvasMap[side.id];
        if (canvas) {
          const objects = canvas.getObjects().filter((obj) => {
            if (obj.excludeFromExport) return false;
            const objData = obj as { data?: { id?: string } };
            return objData.data?.id !== 'background-product-image';
          });

          newStates[side.id] = {
            version: '6.0.0',
            objects: prepareObjectsForSave(objects),
          };
        }
      });

      return newStates;
    });
  };

  // Add text to canvas
  const addText = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;

    const text = new fabric.IText('텍스트', {
      left: canvas.width / 2,
      top: canvas.height / 2,
      originX: 'center',
      originY: 'center',
      fontFamily: 'Arial',
      fill: '#333',
      fontSize: 30,
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    incrementCanvasVersion();
  };

  // Add image to canvas
  const addImage = async () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      try {
        const supabase = createClient();
        const uploadResult = await uploadFileToStorage(
          supabase,
          file,
          STORAGE_BUCKETS.USER_DESIGNS,
          STORAGE_FOLDERS.IMAGES
        );

        if (!uploadResult.success || !uploadResult.url) {
          console.error('Failed to upload image:', uploadResult.error);
          alert('이미지 업로드에 실패했습니다.');
          return;
        }

        const img = await fabric.FabricImage.fromURL(uploadResult.url, {
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

        // @ts-expect-error - Adding custom data property
        img.data = {
          supabaseUrl: uploadResult.url,
          supabasePath: uploadResult.path,
          uploadedAt: new Date().toISOString(),
        };

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        incrementCanvasVersion();
      } catch (error) {
        console.error('Error adding image:', error);
        alert('이미지 추가 중 오류가 발생했습니다.');
      }
    };

    input.click();
  };

  // Delete selected object
  const deleteSelected = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;

    const selectedObjects = canvas.getActiveObjects();
    if (selectedObjects.length > 0) {
      selectedObjects.forEach((obj) => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.renderAll();
      incrementCanvasVersion();
    }
  };

  // Reset canvas (remove all user objects)
  const resetCanvas = () => {
    const canvas = getActiveCanvas();
    if (!canvas) return;

    canvas.getObjects().forEach((obj) => {
      const objData = obj as { data?: { id?: string } };
      if (objData.data?.id !== 'background-product-image') {
        canvas.remove(obj);
      }
    });
    canvas.renderAll();
    incrementCanvasVersion();
  };

  // Save template
  const handleSave = async () => {
    if (!formTitle.trim()) {
      alert('템플릿 제목을 입력해주세요.');
      return;
    }

    // Save current canvas states first
    if (isEditing) {
      saveCanvasStates();
    }

    setSaving(true);
    try {
      // Serialize canvas states to JSON strings for each side
      const canvasStateForSave: Record<string, string> = {};
      Object.entries(editedCanvasStates).forEach(([sideId, state]) => {
        canvasStateForSave[sideId] = JSON.stringify(state);
      });

      const payload = {
        product_id: product.id,
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        canvas_state: canvasStateForSave,
        sort_order: formSortOrder,
        is_active: formIsActive,
      };

      let response: Response;

      if (isCreating) {
        response = await fetch('/api/admin/design-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else if (selectedTemplate) {
        response = await fetch('/api/admin/design-templates', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedTemplate.id, ...payload }),
        });
      } else {
        throw new Error('Invalid state for save');
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || '템플릿 저장에 실패했습니다.');
      }

      const data = await response.json();
      const savedTemplate = data.data as DesignTemplate;

      if (isCreating) {
        setTemplates((prev) => [...prev, savedTemplate]);
        setSelectedTemplate(savedTemplate);
        setIsCreating(false);
      } else {
        setTemplates((prev) =>
          prev.map((t) => (t.id === savedTemplate.id ? savedTemplate : t))
        );
        setSelectedTemplate(savedTemplate);
      }

      alert('템플릿이 저장되었습니다.');
      setIsEditing(false);
      setEditMode(false);
    } catch (error) {
      console.error('Error saving template:', error);
      alert(error instanceof Error ? error.message : '템플릿 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // Delete template
  const handleDelete = async (template: DesignTemplate) => {
    if (!confirm(`"${template.title}" 템플릿을 삭제할까요?`)) return;

    try {
      const response = await fetch(`/api/admin/design-templates?id=${template.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || '템플릿 삭제에 실패했습니다.');
      }

      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      if (selectedTemplate?.id === template.id) {
        setSelectedTemplate(null);
        setIsEditing(false);
        setEditMode(false);
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      alert(error instanceof Error ? error.message : '템플릿 삭제에 실패했습니다.');
    }
  };

  // Navigate sides
  const goToPrevSide = () => {
    // Save current side's state before switching
    saveCurrentSideState();
    const newIndex = Math.max(0, currentSideIndex - 1);
    setCurrentSideIndex(newIndex);
    if (sides[newIndex]) {
      setActiveSide(sides[newIndex].id);
    }
  };

  const goToNextSide = () => {
    // Save current side's state before switching
    saveCurrentSideState();
    const newIndex = Math.min(sides.length - 1, currentSideIndex + 1);
    setCurrentSideIndex(newIndex);
    if (sides[newIndex]) {
      setActiveSide(sides[newIndex].id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      {/* Text Styling Sidebar - Fixed left panel that slides in */}
      <div
        className={`fixed left-0 top-0 h-full w-72 bg-white border-r border-gray-200 shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${
          isTextSelected && isEditing ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Type className="w-5 h-5" />
              텍스트 스타일
            </h3>
          </div>

          <div className="space-y-4">
            {/* Edit Text Button - only show for CurvedText */}
            {isCurvedTextSelected && (
              <div>
                <button
                  onClick={handleEditCurvedText}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  텍스트 편집
                </button>
                <p className="text-xs text-gray-500 mt-1.5 text-center">
                  더블클릭으로도 편집할 수 있습니다
                </p>
              </div>
            )}

            {/* Font Family */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">글꼴</label>
              <select
                value={fontFamily}
                onChange={(e) => handleFontFamilyChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              >
                {fontFamilies.map((font) => (
                  <option key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">크기</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="8"
                  max="120"
                  value={fontSize}
                  onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                  className="flex-1"
                />
                <input
                  type="number"
                  min="8"
                  max="200"
                  value={fontSize}
                  onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                  className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm text-center"
                />
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Palette className="w-4 h-4" />
                색상
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={fillColor}
                  onChange={(e) => handleFillColorChange(e.target.value)}
                  className="w-10 h-10 border border-gray-300 rounded-md cursor-pointer"
                />
                <input
                  type="text"
                  value={fillColor}
                  onChange={(e) => handleFillColorChange(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="#000000"
                />
              </div>
            </div>

            {/* Text Style Buttons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">스타일</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={toggleBold}
                  className={`p-2 rounded-md border transition-colors ${
                    fontWeight === 'bold'
                      ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-100'
                  }`}
                  title="굵게"
                >
                  <Bold className="w-5 h-5" />
                </button>
                <button
                  onClick={toggleItalic}
                  className={`p-2 rounded-md border transition-colors ${
                    fontStyle === 'italic'
                      ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-100'
                  }`}
                  title="기울임"
                >
                  <Italic className="w-5 h-5" />
                </button>
                <button
                  onClick={toggleUnderline}
                  className={`p-2 rounded-md border transition-colors ${
                    underline
                      ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-100'
                  }`}
                  title="밑줄"
                >
                  <Underline className="w-5 h-5" />
                </button>
                <button
                  onClick={toggleLinethrough}
                  className={`p-2 rounded-md border transition-colors ${
                    linethrough
                      ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-100'
                  }`}
                  title="취소선"
                >
                  <Strikethrough className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Text Alignment - hide for CurvedText since it's always centered */}
            {!isCurvedTextSelected && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">정렬</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTextAlignChange('left')}
                    className={`flex-1 p-2 rounded-md border transition-colors ${
                      textAlign === 'left'
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'border-gray-300 hover:bg-gray-100'
                    }`}
                    title="왼쪽 정렬"
                  >
                    <AlignLeft className="w-5 h-5 mx-auto" />
                  </button>
                  <button
                    onClick={() => handleTextAlignChange('center')}
                    className={`flex-1 p-2 rounded-md border transition-colors ${
                      textAlign === 'center'
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'border-gray-300 hover:bg-gray-100'
                    }`}
                    title="가운데 정렬"
                  >
                    <AlignCenter className="w-5 h-5 mx-auto" />
                  </button>
                  <button
                    onClick={() => handleTextAlignChange('right')}
                    className={`flex-1 p-2 rounded-md border transition-colors ${
                      textAlign === 'right'
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'border-gray-300 hover:bg-gray-100'
                    }`}
                    title="오른쪽 정렬"
                  >
                    <AlignRight className="w-5 h-5 mx-auto" />
                  </button>
                </div>
              </div>
            )}

            {/* Text Curve / Warp */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Spline className="w-4 h-4" />
                텍스트 휘기
              </label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={curveIntensity}
                    onChange={(e) => handleCurveIntensityChange(Number(e.target.value))}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min="-100"
                    max="100"
                    value={curveIntensity}
                    onChange={(e) => handleCurveIntensityChange(Number(e.target.value))}
                    className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm text-center"
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>↑ 위로 휘기</span>
                  <span>↓ 아래로 휘기</span>
                </div>
                {curveIntensity !== 0 && !isCurvedTextSelected && (
                  <p className="text-xs text-blue-600">
                    휘기를 적용하면 곡선 텍스트로 변환됩니다
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">템플릿 편집</h2>
          <p className="text-sm text-gray-500 mt-1">{product.title} - 디자인 템플릿 관리</p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <X className="w-5 h-5" />
          닫기
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Panel - Template List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">템플릿 목록</h3>
              <button
                onClick={() => {
                  setIsCreating(true);
                  setSelectedTemplate(null);
                  setIsEditing(false);
                  setEditMode(false);
                }}
                className="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md"
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>

            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`p-3 border rounded-md cursor-pointer transition-all ${
                    selectedTemplate?.id === template.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setSelectedTemplate(template);
                    setIsCreating(false);
                    setIsEditing(false);
                    setEditMode(false);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{template.title}</p>
                      {template.description && (
                        <p className="text-xs text-gray-500 mt-1 truncate">{template.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {template.is_active ? (
                        <Eye className="w-4 h-4 text-green-600" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-gray-400" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(template);
                        }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {templates.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Layers className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">템플릿이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Template Editor */}
        <div className="lg:col-span-3">
          {(selectedTemplate || isCreating) ? (
            <div className="space-y-4">
              {/* Template Info Form */}
              <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">
                    {isCreating ? '새 템플릿' : '템플릿 정보'}
                  </h3>
                  <div className="flex items-center gap-2">
                    {!isEditing && (
                      <button
                        onClick={startEditing}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-md"
                      >
                        <Edit2 className="w-4 h-4" />
                        디자인 편집
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      제목 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      placeholder="템플릿 제목"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">정렬 순서</label>
                    <input
                      type="number"
                      value={formSortOrder}
                      onChange={(e) => setFormSortOrder(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      placeholder="템플릿 설명 (선택)"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                      />
                      활성 상태
                    </label>
                  </div>
                </div>
              </div>

              {/* Canvas Editor */}
              {isEditing && currentSide && (
                <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
                  {/* Toolbar */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addText}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
                      >
                        <TextCursor className="w-4 h-4" />
                        텍스트
                      </button>
                      <button
                        onClick={addImage}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
                      >
                        <FileImage className="w-4 h-4" />
                        이미지
                      </button>
                      <button
                        onClick={deleteSelected}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                        삭제
                      </button>
                      <button
                        onClick={resetCanvas}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50"
                      >
                        <RefreshCcw className="w-4 h-4" />
                        초기화
                      </button>
                    </div>
                    <button
                      onClick={stopEditing}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      <Check className="w-4 h-4" />
                      편집 완료
                    </button>
                  </div>

                  {/* Side Navigation */}
                  {sides.length > 1 && (
                    <div className="flex items-center justify-center gap-4 mb-4">
                      <button
                        onClick={goToPrevSide}
                        disabled={currentSideIndex === 0}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-30"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="text-center">
                        <span className="font-medium">{currentSide.name}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          ({currentSideIndex + 1} / {sides.length})
                        </span>
                      </div>
                      <button
                        onClick={goToNextSide}
                        disabled={currentSideIndex === sides.length - 1}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-30"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  {/* Canvas */}
                  <div className="flex justify-center">
                    <SingleSideCanvas
                      key={`${currentSide.id}-edit`}
                      side={currentSide}
                      width={400}
                      height={500}
                      isEdit={true}
                      canvasState={editedCanvasStates[currentSide.id] || null}
                      onCanvasReady={handleCanvasReady}
                    />
                  </div>
                </div>
              )}

              {/* Preview - when not editing */}
              {!isEditing && selectedTemplate && (
                <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4">미리보기</h3>

                  {/* Side Navigation */}
                  {sides.length > 1 && (
                    <div className="flex items-center justify-center gap-4 mb-4">
                      <button
                        onClick={goToPrevSide}
                        disabled={currentSideIndex === 0}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-30"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="text-center">
                        <span className="font-medium">{currentSide?.name}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          ({currentSideIndex + 1} / {sides.length})
                        </span>
                      </div>
                      <button
                        onClick={goToNextSide}
                        disabled={currentSideIndex === sides.length - 1}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-30"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  {/* Preview Canvas */}
                  {currentSide && (
                    <div className="flex justify-center">
                      <SingleSideCanvas
                        key={`${currentSide.id}-preview`}
                        side={currentSide}
                        width={400}
                        height={500}
                        isEdit={false}
                        canvasState={editedCanvasStates[currentSide.id] || null}
                        renderFromCanvasStateOnly={true}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-gray-200/60 rounded-md p-8 shadow-sm text-center">
              <Layers className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">템플릿을 선택하세요</h3>
              <p className="text-gray-500 mb-4">왼쪽에서 템플릿을 선택하거나 새 템플릿을 추가하세요.</p>
              <button
                onClick={() => {
                  setIsCreating(true);
                  setSelectedTemplate(null);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="w-5 h-5" />
                새 템플릿 추가
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}
