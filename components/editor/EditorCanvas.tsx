'use client';

import dynamic from 'next/dynamic';
import { ProductSide, CanvasState, CustomFont } from '@/types/types';
import { useCanvasStore } from '@/store/useCanvasStore';
import Toolbar from '@/components/canvas/Toolbar';
import EditorSideNav from './EditorSideNav';
import * as fabric from 'fabric';

const SingleSideCanvas = dynamic(() => import('@/components/canvas/SingleSideCanvas'), {
  ssr: false,
  loading: () => <div className="w-[400px] h-[500px] bg-gray-100 animate-pulse rounded-lg" />,
});

interface EditorCanvasProps {
  sides: ProductSide[];
  isEditing: boolean;
  showToolbar: boolean;
  canvasStates?: Record<string, CanvasState | string | null>;
  productColor?: string;
  customFonts?: CustomFont[];
  onSelectedObjectChange?: (obj: fabric.FabricObject | null) => void;
  onCanvasReady?: (canvas: fabric.Canvas, sideId: string, scale: number) => void;
}

export default function EditorCanvas({
  sides,
  isEditing,
  showToolbar,
  canvasStates,
  productColor,
  customFonts,
  onSelectedObjectChange,
  onCanvasReady,
}: EditorCanvasProps) {
  const { activeSideId, canvasMap } = useCanvasStore();

  const handleExitEditMode = () => {
    Object.values(canvasMap).forEach((canvas) => {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    });
  };

  const hasCanvasStates = canvasStates && Object.keys(canvasStates).length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-neutral-100">
      {/* Side navigation – compact strip */}
      <div className="py-1 shrink-0">
        <EditorSideNav sides={sides} />
      </div>

      {/* Main area: left tool sidebar + canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left tool sidebar (editor variant) */}
        {showToolbar && isEditing && (
          <Toolbar
            sides={sides}
            handleExitEditMode={handleExitEditMode}
            variant="editor"
            onSelectedObjectChange={onSelectedObjectChange}
          />
        )}

        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center overflow-hidden p-3">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {sides.map((side) => {
              const canvasState = hasCanvasStates ? canvasStates[side.id] : undefined;

              return (
                <div
                  key={side.id}
                  className={side.id === activeSideId ? 'block' : 'hidden'}
                >
                  <SingleSideCanvas
                    side={side}
                    width={400}
                    height={500}
                    isEdit={isEditing}
                    productColor={productColor}
                    {...(canvasState !== undefined && {
                      canvasState,
                      renderFromCanvasStateOnly: true,
                    })}
                    {...(customFonts && customFonts.length > 0 && { customFonts })}
                    enableZoomPan
                    onCanvasReady={onCanvasReady}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
