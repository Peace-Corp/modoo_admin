import React, { useState, useEffect, useCallback } from 'react';
import * as fabric from 'fabric';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Type,
  Palette,
  CircleDot,
  LetterText,
  Baseline,
  CaseSensitive,
  Pilcrow,
} from 'lucide-react';

interface TextStylePanelProps {
  selectedObject: fabric.IText;
  onClose?: () => void;
}

const TextStylePanel: React.FC<TextStylePanelProps> = ({ selectedObject, onClose }) => {
  const [activeTab, setActiveTab] = useState<'font' | 'colors' | 'spacing'>('font');
  const [fontFamily, setFontFamily] = useState<string>('Arial');
  const [fontSize, setFontSize] = useState<number>(30);
  const [fillColor, setFillColor] = useState<string>('#333333');
  const [strokeColor, setStrokeColor] = useState<string>('#000000');
  const [strokeWidth, setStrokeWidth] = useState<number>(0);
  const [textAlign, setTextAlign] = useState<string>('left');
  const [fontWeight, setFontWeight] = useState<string>('normal');
  const [fontStyle, setFontStyle] = useState<string>('normal');
  const [underline, setUnderline] = useState<boolean>(false);
  const [linethrough, setLinethrough] = useState<boolean>(false);
  const [lineHeight, setLineHeight] = useState<number>(1.16);
  const [charSpacing, setCharSpacing] = useState<number>(0);
  const [arc, setArc] = useState(0);
  const [textBackgroundColor, setTextBackgroundColor] = useState<string>('');
  const [opacity, setOpacity] = useState<number>(1);

  // Font families available
  const fontFamilies = [
    'Arial',
    'Times New Roman',
    'Courier New',
    'Georgia',
    'Verdana',
    'Helvetica',
    'Comic Sans MS',
    'Impact',
    'Trebuchet MS',
    'Palatino',
  ];

  const applyArc = useCallback((arcValue: number, textObject: fabric.IText) => {
    if (!textObject) return;

    // @ts-ignore
    textObject.set('path', null);
    textObject.set('pathOffset', { x: 0, y: 0 });
    textObject.set('pathStartOffset', 0);

    if (arcValue === 0) {
      textObject.canvas?.renderAll();
      return;
    }

    const textWidth = textObject.getScaledWidth();
    const arcHeight = (arcValue / 100) * (textWidth / 2);

    const path = new fabric.Path(`M ${-textWidth / 2} 0 Q 0 ${-arcHeight} ${textWidth / 2} 0`);

    // @ts-ignore
    textObject.set('path', path);
    textObject.canvas?.renderAll();
  }, []);

  const updateTextProperty = useCallback((property: string, value: any) => {
    if (selectedObject) {
      selectedObject.set(property as keyof fabric.IText, value);
      if (property === 'fontSize' || property === 'charSpacing' || property === 'fontFamily') {
        // @ts-ignore
        applyArc(selectedObject.data?.arc || 0, selectedObject);
      }
      selectedObject.canvas?.renderAll();
    }
  }, [selectedObject, applyArc]);

  const handleFontFamilyChange = useCallback((value: string) => {
    setFontFamily(value);
    updateTextProperty('fontFamily', value);
  }, [updateTextProperty]);

  // Initialize state from selected object
  useEffect(() => {
    if (selectedObject) {
      setFontFamily((selectedObject.fontFamily as string) || 'Arial');
      setFontSize((selectedObject.fontSize as number) || 30);
      setFillColor((selectedObject.fill as string) || '#333333');
      setStrokeColor((selectedObject.stroke as string) || '#000000');
      setStrokeWidth((selectedObject.strokeWidth as number) || 0);
      setTextAlign((selectedObject.textAlign as string) || 'left');
      setFontWeight((selectedObject.fontWeight as string) || 'normal');
      setFontStyle((selectedObject.fontStyle as string) || 'normal');
      setUnderline(selectedObject.underline || false);
      setLinethrough(selectedObject.linethrough || false);
      setLineHeight((selectedObject.lineHeight as number) || 1.16);
      setCharSpacing((selectedObject.charSpacing as number) || 0);
      // @ts-ignore
      setArc(selectedObject.data?.arc || 0);
      setTextBackgroundColor((selectedObject.textBackgroundColor as string) || '');
      setOpacity((selectedObject.opacity as number) || 1);

      const handleEditingExited = () => {
        // @ts-ignore
        applyArc(selectedObject.data?.arc || 0, selectedObject);
      };

      selectedObject.on('editing:exited', handleEditingExited);

      return () => {
        selectedObject.off('editing:exited', handleEditingExited);
      };
    }
  }, [selectedObject, applyArc]);

  const handleFontSizeChange = (value: number) => {
    setFontSize(value);
    updateTextProperty('fontSize', value);
  };

  const handleFillColorChange = (value: string) => {
    setFillColor(value);
    updateTextProperty('fill', value);
  };

  const handleStrokeColorChange = (value: string) => {
    setStrokeColor(value);
    updateTextProperty('stroke', value);
  };

  const handleStrokeWidthChange = (value: number) => {
    setStrokeWidth(value);
    updateTextProperty('strokeWidth', value);
    updateTextProperty('paintFirst', 'stroke');
  };

  const handleTextAlignChange = (value: string) => {
    setTextAlign(value);
    updateTextProperty('textAlign', value);
  };

  const toggleBold = () => {
    const newWeight = fontWeight === 'bold' ? 'normal' : 'bold';
    setFontWeight(newWeight);
    updateTextProperty('fontWeight', newWeight);
  };

  const toggleItalic = () => {
    const newStyle = fontStyle === 'italic' ? 'normal' : 'italic';
    setFontStyle(newStyle);
    updateTextProperty('fontStyle', newStyle);
  };

  const toggleUnderline = () => {
    const newUnderline = !underline;
    setUnderline(newUnderline);
    updateTextProperty('underline', newUnderline);
  };

  const toggleLinethrough = () => {
    const newLinethrough = !linethrough;
    setLinethrough(newLinethrough);
    updateTextProperty('linethrough', newLinethrough);
  };

  const handleLineHeightChange = (value: number) => {
    setLineHeight(value);
    updateTextProperty('lineHeight', value);
  };

  const handleCharSpacingChange = (value: number) => {
    setCharSpacing(value);
    updateTextProperty('charSpacing', value);
  };

  const handleArcChange = (value: number) => {
    setArc(value);
    if (selectedObject) {
      // @ts-ignore
      selectedObject.data = { ...selectedObject.data, arc: value };
      applyArc(value, selectedObject);
    }
  };

  const handleTextBackgroundColorChange = (value: string) => {
    setTextBackgroundColor(value);
    updateTextProperty('textBackgroundColor', value);
  };

  const handleOpacityChange = (value: number) => {
    setOpacity(value);
    updateTextProperty('opacity', value);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
      <div className="border-t rounded-t-2xl bg-white border-gray-200 shadow-2xl  h-[33vh] flex flex-col px-4">
        {/* Header with Tabs */}
        <div className="shrink-0 sticky top-0 border-b border-gray-100">
          <div className='py-3 w-10 mx-auto'>
            <hr className='border-2 border-black/20 rounded-full'/>
          </div>

          {/* Tabs */}
          <div className="flex">
            <button
              onClick={() => setActiveTab('font')}
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                activeTab === 'font'
                  ? 'bg-black text-white rounded-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              폰트
            </button>
            <button
              onClick={() => setActiveTab('colors')}
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                activeTab === 'colors'
                  ? 'bg-black text-white rounded-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              색상
            </button>
            <button
              onClick={() => setActiveTab('spacing')}
              className={`flex-1 py-2 px-4 text-sm font-medium ${
                activeTab === 'spacing'
                  ? 'bg-black text-white rounded-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              간격
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Font Tab */}
          {activeTab === 'font' && (
            <>
              {/* Font Family */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Type className="size-4" />
                  글꼴
                </label>
                <select
                  value={fontFamily}
                  onChange={(e) => handleFontFamilyChange(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  {fontFamilies.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>

              {/* Font Size */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <CaseSensitive className="size-4" />
                  크기: {fontSize}px
                </label>
                <input
                  type="range"
                  min="8"
                  max="200"
                  value={fontSize}
                  onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Text Alignment */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">정렬</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTextAlignChange('left')}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      textAlign === 'left'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <AlignLeft className="size-5 mx-auto" />
                  </button>
                  <button
                    onClick={() => handleTextAlignChange('center')}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      textAlign === 'center'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <AlignCenter className="size-5 mx-auto" />
                  </button>
                  <button
                    onClick={() => handleTextAlignChange('right')}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      textAlign === 'right'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <AlignRight className="size-5 mx-auto" />
                  </button>
                  <button
                    onClick={() => handleTextAlignChange('justify')}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      textAlign === 'justify'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <AlignJustify className="size-5 mx-auto" />
                  </button>
                </div>
              </div>

              {/* Text Decorations */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">텍스트 스타일</label>
                <div className="flex gap-2">
                  <button
                    onClick={toggleBold}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      fontWeight === 'bold'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Bold className="size-5 mx-auto" />
                  </button>
                  <button
                    onClick={toggleItalic}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      fontStyle === 'italic'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Italic className="size-5 mx-auto" />
                  </button>
                  <button
                    onClick={toggleUnderline}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      underline
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Underline className="size-5 mx-auto" />
                  </button>
                  <button
                    onClick={toggleLinethrough}
                    className={`flex-1 p-2 rounded-lg border transition ${
                      linethrough
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Strikethrough className="size-5 mx-auto" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Colors Tab */}
          {activeTab === 'colors' && (
            <>
              {/* Fill Color */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Palette className="size-4" />
                  글자 색상
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={fillColor}
                    onChange={(e) => handleFillColorChange(e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={fillColor}
                    onChange={(e) => handleFillColorChange(e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Stroke Color */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <CircleDot className="size-4" />
                  테두리 색상
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => handleStrokeColorChange(e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={strokeColor}
                    onChange={(e) => handleStrokeColorChange(e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Stroke Width */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  테두리 두께: {strokeWidth}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={strokeWidth}
                  onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Text Background Color */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  배경 색상
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={textBackgroundColor || '#ffffff'}
                    onChange={(e) => handleTextBackgroundColorChange(e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={textBackgroundColor}
                    onChange={(e) => handleTextBackgroundColorChange(e.target.value)}
                    placeholder="투명"
                    className="flex-1 p-2 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={() => handleTextBackgroundColorChange('')}
                    className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition"
                  >
                    제거
                  </button>
                </div>
              </div>

              {/* Opacity */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  투명도: {Math.round(opacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={opacity}
                  onChange={(e) => handleOpacityChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </>
          )}

          {/* Spacing Tab */}
          {activeTab === 'spacing' && (
            <>
              {/* Line Height */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Baseline className="size-4" />
                  줄 간격: {lineHeight.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={lineHeight}
                  onChange={(e) => handleLineHeightChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Character Spacing */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <LetterText className="size-4" />
                  자간: {charSpacing}
                </label>
                <input
                  type="range"
                  min="-200"
                  max="800"
                  step="10"
                  value={charSpacing}
                  onChange={(e) => handleCharSpacingChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Arc */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Pilcrow className="size-4" />
                  휘기: {arc}
                </label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={arc}
                  onChange={(e) => handleArcChange(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TextStylePanel;
