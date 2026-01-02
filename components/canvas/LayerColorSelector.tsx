'use client'
import React from 'react';
import { ProductLayer } from '@/types/types';
import { useCanvasStore } from '@/store/useCanvasStore';

interface LayerColorSelectorProps {
  sideId: string;
  layers: ProductLayer[];
}

const LayerColorSelector: React.FC<LayerColorSelectorProps> = ({ sideId, layers }) => {
  const { layerColors, setLayerColor } = useCanvasStore();

  // Sort layers by zIndex for consistent display
  const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

  const handleColorChange = (layerId: string, color: string) => {
    setLayerColor(sideId, layerId, color);
  };

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Product Colors</h3>
      <div className="space-y-3">
        {sortedLayers.map((layer) => {
          const currentColor = layerColors[sideId]?.[layer.id] || layer.colorOptions[0] || '#FFFFFF';

          return (
            <div key={layer.id} className="space-y-2">
              <label className="text-xs font-medium text-gray-600">
                {layer.name}
              </label>
              <div className="flex gap-2 flex-wrap">
                {layer.colorOptions.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(layer.id, color)}
                    className={`
                      w-10 h-10 rounded-full border-2 transition-all duration-200
                      ${currentColor === color
                        ? 'border-blue-500 scale-110 shadow-md'
                        : 'border-gray-300 hover:border-gray-400 hover:scale-105'
                      }
                    `}
                    style={{ backgroundColor: color }}
                    aria-label={`Select ${color} for ${layer.name}`}
                  >
                    {currentColor === color && (
                      <svg
                        className="w-full h-full p-2"
                        fill="none"
                        stroke={getContrastColor(color)}
                        strokeWidth="3"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Helper function to determine if we should use white or black for the checkmark
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark colors, black for light colors
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export default LayerColorSelector;