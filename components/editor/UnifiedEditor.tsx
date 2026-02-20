'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as fabric from 'fabric';
import { useCanvasStore } from '@/store/useCanvasStore';
import { DesignTemplate, CanvasState } from '@/types/types';
import { useEditorMode, EditorMode } from './hooks/useEditorMode';
import { useEditorData } from './hooks/useEditorData';
import { useEditorSave } from './hooks/useEditorSave';
import EditorHeader from './EditorHeader';
import EditorCanvas from './EditorCanvas';

import EditorRightPanel from './EditorRightPanel';
import Toolbar from '@/components/canvas/Toolbar';
import DesignModePanel from './panels/DesignModePanel';
import OrderModePanel from './panels/OrderModePanel';
import OrderEditPanel from './panels/OrderEditPanel';
import TemplateModePanel from './panels/TemplateModePanel';
import {
  coerceImageUrlsBySide,
  coerceTextSvgExports,
  coerceTextSvgObjectUrlsBySide,
  coerceCustomFonts,
  getTextSvgFromCanvasState,
  getFileExtensionFromName,
  getFileExtensionFromUrl,
  getFileExtensionFromType,
  buildFilename,
  sanitizeFilenameSegment,
  parseCanvasState,
  downloadBlob,
  downloadUrl,
  sleep,
} from '@/lib/downloadUtils';

interface UnifiedEditorProps {
  productId: string;
  mode: EditorMode;
  orderId?: string;
  orderItemId?: string;
  templateId?: string;
  designId?: string;
  returnUrl?: string;
}

export default function UnifiedEditor({
  productId,
  mode,
  orderId,
  orderItemId,
  templateId,
  designId,
  returnUrl,
}: UnifiedEditorProps) {
  const router = useRouter();
  const modeConfig = useEditorMode({ mode, returnUrl });
  const editorData = useEditorData({ productId, mode, orderId, orderItemId, templateId, designId });
  const { setEditMode, setActiveSide, canvasMap } = useCanvasStore();

  // Editing state
  const [isEditing, setIsEditing] = useState(modeConfig.initiallyEditable);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Selected text object for text style panel
  const [selectedTextObject, setSelectedTextObject] = useState<fabric.FabricObject | null>(null);

  // Design mode state
  const [designTitle, setDesignTitle] = useState('');

  // Template mode state
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateSortOrder, setTemplateSortOrder] = useState(0);
  const [templateIsActive, setTemplateIsActive] = useState(true);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  // Canvas states for rendering (may come from order or template)
  const [canvasStates, setCanvasStates] = useState<Record<string, CanvasState | string | null>>({});

  // Snapshot for reverting on edit cancel (order mode)
  const editSnapshotRef = useRef<Record<string, object>>({});

  // Sync editing state with canvas store
  useEffect(() => {
    setEditMode(isEditing);
    return () => setEditMode(false);
  }, [isEditing, setEditMode]);

  // Set initial active side when product loads
  useEffect(() => {
    const sides = editorData.product?.configuration || [];
    if (sides.length > 0) {
      setActiveSide(sides[0].id);
    }
  }, [editorData.product, setActiveSide]);

  // Update canvas states from data
  useEffect(() => {
    if (Object.keys(editorData.canvasStates).length > 0) {
      setCanvasStates(editorData.canvasStates);
    }
  }, [editorData.canvasStates]);

  // Update design form when savedDesign changes
  useEffect(() => {
    const saved = editorData.savedDesign;
    if (saved && mode === 'design') {
      setDesignTitle(saved.title || '');
    }
  }, [editorData.savedDesign, mode]);

  // Update template form when selectedTemplate changes
  useEffect(() => {
    const tmpl = editorData.selectedTemplate;
    if (tmpl) {
      setTemplateTitle(tmpl.title);
      setTemplateDescription(tmpl.description || '');
      setTemplateSortOrder(tmpl.sort_order ?? 0);
      setTemplateIsActive(tmpl.is_active ?? true);
      setIsCreatingTemplate(false);
      // Update canvas states for rendering
      const parsed: Record<string, CanvasState | string | null> = {};
      if (tmpl.canvas_state) {
        Object.entries(tmpl.canvas_state).forEach(([sideId, state]) => {
          parsed[sideId] = state as CanvasState | string;
        });
      }
      setCanvasStates(parsed);
    }
  }, [editorData.selectedTemplate]);

  // Save hook
  const { handleSave: executeSave } = useEditorSave({
    mode,
    product: editorData.product,
    orderItem: editorData.orderItem,
    savedDesign: editorData.savedDesign,
    selectedTemplate: editorData.selectedTemplate,
    designTitle,
    templateTitle,
    templateDescription,
    templateSortOrder,
    templateIsActive,
  });

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);

    const result = await executeSave();

    setIsSaving(false);

    if (result.success) {
      if (mode === 'order') {
        editSnapshotRef.current = {};
        setIsEditing(false);
      } else if (mode === 'design') {
        // Navigate back after design save, appending designId
        const backUrl = returnUrl || '/designs';
        const separator = backUrl.includes('?') ? '&' : '?';
        router.push(`${backUrl}${separator}designId=${result.id}`);
      } else if (mode === 'template') {
        // Refresh templates list
        await editorData.refetchTemplates();
      }
    } else {
      setSaveError(result.error || '저장에 실패했습니다.');
    }
  }, [executeSave, mode, router, returnUrl, editorData]);

  // Handle edit toggle (order mode) — snapshot on enter, restore on cancel
  const handleToggleEdit = useCallback(() => {
    if (!isEditing) {
      // Entering edit mode — snapshot all canvases
      const snapshot: Record<string, object> = {};
      Object.entries(canvasMap).forEach(([sideId, canvas]) => {
        snapshot[sideId] = canvas.toJSON();
      });
      editSnapshotRef.current = snapshot;
      setIsEditing(true);
    } else {
      // Cancelling edit mode — restore from snapshot
      Object.entries(editSnapshotRef.current).forEach(([sideId, json]) => {
        const canvas = canvasMap[sideId];
        if (canvas) {
          canvas.discardActiveObject();
          canvas.loadFromJSON(json).then(() => {
            canvas.requestRenderAll();
          });
        }
      });
      editSnapshotRef.current = {};
      setSelectedTextObject(null);
      setIsEditing(false);
    }
    setSaveError(null);
  }, [isEditing, canvasMap]);

  // Handle selected object change
  const handleSelectedObjectChange = useCallback((obj: fabric.FabricObject | null) => {
    setSelectedTextObject(obj);
  }, []);

  // Exit edit mode (deselect all objects)
  const handleExitEditMode = useCallback(() => {
    Object.values(canvasMap).forEach((canvas) => {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    });
  }, [canvasMap]);

  // Handle download all (order mode)
  const handleDownloadAll = useCallback(async () => {
    if (!editorData.orderItem || isDownloading) return;
    setIsDownloading(true);

    try {
      const orderItem = editorData.orderItem;
      const imageUrlsBySide = coerceImageUrlsBySide(orderItem.image_urls);
      const customFonts = coerceCustomFonts(orderItem.custom_fonts);
      const textSvgExports = coerceTextSvgExports(orderItem.text_svg_exports);
      const textSvgSideUrls: Record<string, string> = {};
      Object.entries(textSvgExports).forEach(([sideId, value]) => {
        if (sideId === '__objects') return;
        if (typeof value !== 'string' || !value) return;
        textSvgSideUrls[sideId] = value;
      });
      const textSvgObjectUrlsBySide = coerceTextSvgObjectUrlsBySide(textSvgExports.__objects);

      const files: Array<{ type: 'blob'; blob: Blob; filename: string } | { type: 'url'; url: string; filename: string }> = [];
      const seenUrls = new Set<string>();
      const prefix = `order-${orderItem.id}`;

      // Image URLs
      Object.entries(imageUrlsBySide).forEach(([sideId, images]) => {
        images.forEach((image, index) => {
          if (!image?.url || seenUrls.has(image.url)) return;
          seenUrls.add(image.url);
          const ext = getFileExtensionFromName(image.path?.split('/').pop()) || getFileExtensionFromUrl(image.url) || 'jpg';
          files.push({ type: 'url', url: image.url, filename: buildFilename(`${prefix}-${sideId}-image-${index + 1}`, ext) });
        });
      });

      // Text SVG URLs
      Object.entries(textSvgSideUrls).forEach(([sideId, url]) => {
        if (!url || seenUrls.has(url)) return;
        seenUrls.add(url);
        files.push({ type: 'url', url, filename: `${prefix}-${sideId}-text.svg` });
      });

      Object.entries(textSvgObjectUrlsBySide).forEach(([sideId, objectMap]) => {
        Object.entries(objectMap).forEach(([objectId, url]) => {
          if (!url || seenUrls.has(url)) return;
          seenUrls.add(url);
          files.push({ type: 'url', url, filename: `${prefix}-${sideId}-text-${sanitizeFilenameSegment(objectId)}.svg` });
        });
      });

      // Fallback: generate SVGs from canvas state if no tracked SVGs
      const hasTrackedSvgs = Object.keys(textSvgSideUrls).length > 0 || Object.keys(textSvgObjectUrlsBySide).length > 0;
      if (!hasTrackedSvgs) {
        Object.entries(orderItem.canvas_state || {}).forEach(([sideId, stateRaw]) => {
          const state = parseCanvasState(stateRaw);
          if (!state || !Array.isArray(state.objects)) return;
          const svg = getTextSvgFromCanvasState(state, sideId);
          if (!svg) return;
          files.push({ type: 'blob', blob: new Blob([svg], { type: 'image/svg+xml' }), filename: `${prefix}-${sideId}-text.svg` });
        });
      }

      // Fallback: extract image URLs from canvas state if no tracked images
      const hasTrackedImages = Object.keys(imageUrlsBySide).length > 0;
      if (!hasTrackedImages) {
        Object.entries(orderItem.canvas_state || {}).forEach(([sideId, stateRaw]) => {
          const state = parseCanvasState(stateRaw);
          if (!state || !Array.isArray(state.objects)) return;
          let imageIndex = 0;
          state.objects.forEach((obj) => {
            if (!obj || typeof obj !== 'object') return;
            if (obj.data?.id === 'background-product-image') return;
            const objectType = typeof obj.type === 'string' ? obj.type.toLowerCase() : '';
            if (objectType !== 'image') return;
            imageIndex++;
            const data = obj.data as { supabaseUrl?: string; originalFileUrl?: string; originalFileName?: string; fileType?: string } | undefined;
            const url = data?.supabaseUrl || data?.originalFileUrl || obj.src;
            if (url && !seenUrls.has(url)) {
              seenUrls.add(url);
              const ext = getFileExtensionFromName(data?.originalFileName) || getFileExtensionFromUrl(url) || getFileExtensionFromType(data?.fileType) || 'png';
              files.push({ type: 'url', url, filename: buildFilename(`${prefix}-${sideId}-image-${imageIndex}`, ext) });
            }
          });
        });
      }

      // Custom fonts
      customFonts.forEach((font) => {
        if (!font.url || seenUrls.has(font.url)) return;
        seenUrls.add(font.url);
        const ext = font.format || getFileExtensionFromUrl(font.url) || 'ttf';
        files.push({ type: 'url', url: font.url, filename: buildFilename(`${prefix}-font-${sanitizeFilenameSegment(font.fontFamily)}`, ext) });
      });

      if (files.length === 0) {
        alert('다운로드할 파일이 없습니다.');
        return;
      }

      for (const file of files) {
        if (file.type === 'blob') {
          downloadBlob(file.blob, file.filename);
        } else {
          await downloadUrl(file.url, file.filename);
        }
        await sleep(120);
      }
    } finally {
      setIsDownloading(false);
    }
  }, [editorData.orderItem, isDownloading]);

  // Template mode: select template
  const handleSelectTemplate = useCallback((template: DesignTemplate | null) => {
    editorData.setSelectedTemplate(template);
    setIsCreatingTemplate(false);
  }, [editorData]);

  // Template mode: create new
  const handleCreateNewTemplate = useCallback(() => {
    editorData.setSelectedTemplate(null);
    setIsCreatingTemplate(true);
    setTemplateTitle('');
    setTemplateDescription('');
    setTemplateSortOrder(editorData.templates.length);
    setTemplateIsActive(true);
    setCanvasStates({});
  }, [editorData]);

  // Template mode: delete
  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/admin/design-templates?id=${templateId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('삭제에 실패했습니다.');

      editorData.setSelectedTemplate(null);
      setIsCreatingTemplate(false);
      await editorData.refetchTemplates();
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    }
  }, [editorData]);

  // Loading state
  if (editorData.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (editorData.error || !editorData.product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{editorData.error || '제품 정보를 불러올 수 없습니다.'}</p>
          <button
            onClick={() => router.push(modeConfig.backUrl)}
            className="px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const product = editorData.product;
  const sides = product.configuration || [];

  // Determine effective toolbar visibility
  const showToolbar = mode === 'order'
    ? isEditing
    : modeConfig.showToolbar;

  // Overlay widths for canvas centering
  const TOOLBAR_W = 36; // w-9
  const PANEL_W_NARROW = 288; // w-72
  const PANEL_W_WIDE = 480; // w-120
  const rightPanelWidth = mode === 'order' && !isEditing ? PANEL_W_WIDE : PANEL_W_NARROW;
  const leftToolbarWidth = showToolbar && isEditing ? TOOLBAR_W : 0;

  return (
    <div className="h-screen relative overflow-hidden bg-neutral-700">
      {/* Full-screen canvas workspace */}
      <EditorCanvas
        sides={sides}
        isEditing={isEditing}
        canvasStates={mode !== 'design' ? canvasStates : undefined}
        productColor={mode === 'order' ? editorData.productColor : undefined}
        customFonts={editorData.customFonts.length > 0 ? editorData.customFonts : undefined}
        rightPanelWidth={rightPanelWidth}
        leftToolbarWidth={leftToolbarWidth}
      />

      {/* Floating UI overlay */}
      <div className="relative z-10 h-full flex flex-col pointer-events-none">
        {/* Header */}
        <div className="pointer-events-auto shrink-0">
          <EditorHeader
            modeConfig={modeConfig}
            isEditing={isEditing}
            isSaving={isSaving}
            onToggleEdit={mode === 'order' ? handleToggleEdit : undefined}
            onSave={handleSave}
            onDownload={mode === 'order' ? handleDownloadAll : undefined}
            isDownloading={isDownloading}
            saveError={saveError}
          />
          {mode === 'order' && isEditing && (
            <div className="text-[11px] text-amber-700 bg-amber-50/90 backdrop-blur-sm border-b border-amber-200 px-3 py-1">
              편집 모드 — 객체 이동/크기 조절, 스크롤 확대/축소, Space+드래그 이동
            </div>
          )}
        </div>

        {/* Workspace area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left toolbar */}
          {showToolbar && isEditing && (
            <div className="pointer-events-auto flex">
              <Toolbar
                sides={sides}
                handleExitEditMode={handleExitEditMode}
                variant="editor"
                onSelectedObjectChange={handleSelectedObjectChange}
              />
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right panel */}
          <div className="pointer-events-auto flex">
            <EditorRightPanel wide={mode === 'order' && !isEditing}>
              {mode === 'design' && (
                <DesignModePanel
                  product={product}
                  productColors={editorData.productColors}
                  designTitle={designTitle}
                  onDesignTitleChange={setDesignTitle}
                  selectedTextObject={selectedTextObject}
                  onSave={handleSave}
                  isSaving={isSaving}
                />
              )}

              {mode === 'order' && editorData.orderItem && (
                isEditing ? (
                  <OrderEditPanel
                    product={product}
                    productColors={editorData.productColors}
                    selectedTextObject={selectedTextObject}
                    onSave={handleSave}
                    isSaving={isSaving}
                  />
                ) : (
                  <OrderModePanel
                    product={product}
                    orderItem={editorData.orderItem}
                    productColors={editorData.productColors}
                  />
                )
              )}

              {mode === 'template' && (
                <TemplateModePanel
                  templates={editorData.templates}
                  selectedTemplate={editorData.selectedTemplate}
                  onSelectTemplate={handleSelectTemplate}
                  onCreateNew={handleCreateNewTemplate}
                  selectedTextObject={selectedTextObject}
                  templateTitle={templateTitle}
                  onTemplateTitleChange={setTemplateTitle}
                  templateDescription={templateDescription}
                  onTemplateDescriptionChange={setTemplateDescription}
                  templateSortOrder={templateSortOrder}
                  onTemplateSortOrderChange={setTemplateSortOrder}
                  templateIsActive={templateIsActive}
                  onTemplateIsActiveChange={setTemplateIsActive}
                  onSave={handleSave}
                  onDelete={handleDeleteTemplate}
                  isSaving={isSaving}
                  isCreating={isCreatingTemplate}
                />
              )}
            </EditorRightPanel>
          </div>
        </div>
      </div>
    </div>
  );
}
