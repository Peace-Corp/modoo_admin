'use client';

import { useState, useRef, useEffect } from 'react';
import { Product, ProductSide, SizeOption } from '@/types/types';
import { createClient } from '@/lib/supabase-client';
import { Save, X, Plus, Trash2, Upload, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

interface ProductEditorProps {
  product?: Product | null;
  onSave: (product: Product) => void;
  onCancel: () => void;
}

export default function ProductEditor({ product, onSave, onCancel }: ProductEditorProps) {
  const isNewProduct = !product;

  // Basic product fields
  const [title, setTitle] = useState(product?.title || '');
  const [basePrice, setBasePrice] = useState(product?.base_price || 0);
  const [category, setCategory] = useState(product?.category || '');
  const [isActive, setIsActive] = useState(product?.is_active ?? true);

  // Product sides
  const [sides, setSides] = useState<ProductSide[]>(product?.configuration || []);
  const [currentSideIndex, setCurrentSideIndex] = useState(0);

  // Size options
  const [sizeOptions, setSizeOptions] = useState<SizeOption[]>(product?.size_options || []);

  // UI state
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentSideEditing, setCurrentSideEditing] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSide = sides[currentSideIndex];

  // Add new side
  const handleAddSide = () => {
    const newSide: ProductSide = {
      id: `side-${Date.now()}`,
      name: `면 ${sides.length + 1}`,
      imageUrl: '',
      printArea: {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
      },
      realLifeDimensions: {
        printAreaWidthMm: 0,
        printAreaHeightMm: 0,
        productWidthMm: 0,
      },
      zoomScale: 1.0,
    };
    setSides([...sides, newSide]);
  };

  // Remove side
  const handleRemoveSide = (index: number) => {
    if (sides.length <= 1) {
      alert('최소 1개의 면이 필요합니다.');
      return;
    }
    const newSides = sides.filter((_, i) => i !== index);
    setSides(newSides);
    if (currentSideIndex >= newSides.length) {
      setCurrentSideIndex(newSides.length - 1);
    }
  };

  // Update side field
  const updateSideField = (index: number, field: keyof ProductSide, value: any) => {
    const newSides = [...sides];
    newSides[index] = {
      ...newSides[index],
      [field]: value,
    };
    setSides(newSides);
  };

  // Update print area
  const updatePrintArea = (index: number, field: string, value: number) => {
    const newSides = [...sides];
    newSides[index] = {
      ...newSides[index],
      printArea: {
        ...newSides[index].printArea,
        [field]: Math.max(0, Math.round(value)),
      },
    };
    setSides(newSides);
  };

  // Handle image upload
  const handleImageUpload = async (index: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();

      // Create unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `product-images/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      // Update side with new image URL
      updateSideField(index, 'imageUrl', publicUrl);

      alert('이미지가 업로드되었습니다.');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // Trigger file input
  const triggerFileInput = (index: number) => {
    setCurrentSideEditing(index);
    fileInputRef.current?.click();
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentSideEditing !== null) {
      handleImageUpload(currentSideEditing, file);
    }
    e.target.value = ''; // Reset input
  };

  // Add size option
  const handleAddSizeOption = () => {
    const newSize: SizeOption = {
      id: `size-${Date.now()}`,
      name: '',
      label: '',
    };
    setSizeOptions([...sizeOptions, newSize]);
  };

  // Remove size option
  const handleRemoveSizeOption = (index: number) => {
    setSizeOptions(sizeOptions.filter((_, i) => i !== index));
  };

  // Update size option
  const updateSizeOption = (index: number, field: keyof SizeOption, value: string) => {
    const newSizeOptions = [...sizeOptions];
    newSizeOptions[index] = {
      ...newSizeOptions[index],
      [field]: value,
    };
    setSizeOptions(newSizeOptions);
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!title.trim()) {
      alert('제품명을 입력해주세요.');
      return false;
    }
    if (basePrice <= 0) {
      alert('기본 가격을 입력해주세요.');
      return false;
    }
    if (sides.length === 0) {
      alert('최소 1개의 면을 추가해주세요.');
      return false;
    }
    for (let i = 0; i < sides.length; i++) {
      if (!sides[i].name.trim()) {
        alert(`면 ${i + 1}의 이름을 입력해주세요.`);
        return false;
      }
      if (!sides[i].imageUrl.trim()) {
        alert(`면 ${i + 1}의 이미지를 업로드해주세요.`);
        return false;
      }
    }
    return true;
  };

  // Save product
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();

      const productData = {
        title,
        base_price: basePrice,
        category: category || null,
        is_active: isActive,
        configuration: sides,
        size_options: sizeOptions.length > 0 ? sizeOptions : null,
        updated_at: new Date().toISOString(),
      };

      if (isNewProduct) {
        // Create new product
        const { data, error } = await supabase
          .from('products')
          .insert({
            ...productData,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        onSave(data);
      } else {
        // Update existing product
        const { data, error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id)
          .select()
          .single();

        if (error) throw error;
        onSave(data);
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('제품 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isNewProduct ? '새 제품 추가' : '제품 편집'}
          </h2>
          <p className="text-gray-500 mt-1">
            {isNewProduct ? '제품 정보를 입력하고 면을 추가하세요.' : `${product.title} 편집 중`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Basic Info */}
        <div className="space-y-4">
          {/* Basic Information */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">기본 정보</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제품명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 베이직 티셔츠"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  기본 가격 (원) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={basePrice}
                  onChange={(e) => setBasePrice(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 의류"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="is-active" className="text-sm font-medium text-gray-700">
                  활성 상태
                </label>
              </div>
            </div>
          </div>

          {/* Size Options */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">사이즈 옵션</h3>
              <button
                onClick={handleAddSizeOption}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>
            <div className="space-y-2">
              {sizeOptions.map((size, index) => (
                <div key={size.id} className="flex gap-2">
                  <input
                    type="text"
                    value={size.name}
                    onChange={(e) => updateSizeOption(index, 'name', e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    placeholder="코드 (예: S)"
                  />
                  <input
                    type="text"
                    value={size.label}
                    onChange={(e) => updateSizeOption(index, 'label', e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    placeholder="라벨 (예: Small)"
                  />
                  <button
                    onClick={() => handleRemoveSizeOption(index)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {sizeOptions.length === 0 && (
                <p className="text-sm text-gray-500">사이즈 옵션이 없습니다.</p>
              )}
            </div>
          </div>
        </div>

        {/* Middle Panel - Sides List */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">제품 면 ({sides.length})</h3>
              <button
                onClick={handleAddSide}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                면 추가
              </button>
            </div>

            <div className="space-y-3">
              {sides.map((side, index) => (
                <div
                  key={side.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    currentSideIndex === index
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setCurrentSideIndex(index)}
                >
                  <div className="flex items-center gap-3">
                    {side.imageUrl ? (
                      <img
                        src={side.imageUrl}
                        alt={side.name}
                        className="w-16 h-16 object-cover rounded border border-gray-200"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="text"
                        value={side.name}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateSideField(index, 'name', e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-1 text-sm font-medium border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        placeholder="면 이름"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerFileInput(index);
                          }}
                          disabled={uploading}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                        >
                          <Upload className="w-3 h-3" />
                          {side.imageUrl ? '변경' : '업로드'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSide(index);
                          }}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {sides.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">면을 추가해주세요.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Side Configuration */}
        <div className="space-y-4">
          {currentSide ? (
            <>
              {/* Side Navigation */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentSideIndex(Math.max(0, currentSideIndex - 1))}
                    disabled={currentSideIndex === 0}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="text-center">
                    <h3 className="font-semibold text-gray-900">{currentSide.name}</h3>
                    <p className="text-sm text-gray-500">
                      {currentSideIndex + 1} / {sides.length}
                    </p>
                  </div>

                  <button
                    onClick={() => setCurrentSideIndex(Math.min(sides.length - 1, currentSideIndex + 1))}
                    disabled={currentSideIndex === sides.length - 1}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Print Area Configuration */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">인쇄 영역 (픽셀)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">X 위치</label>
                    <input
                      type="number"
                      value={currentSide.printArea.x}
                      onChange={(e) => updatePrintArea(currentSideIndex, 'x', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Y 위치</label>
                    <input
                      type="number"
                      value={currentSide.printArea.y}
                      onChange={(e) => updatePrintArea(currentSideIndex, 'y', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">너비</label>
                    <input
                      type="number"
                      value={currentSide.printArea.width}
                      onChange={(e) => updatePrintArea(currentSideIndex, 'width', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">높이</label>
                    <input
                      type="number"
                      value={currentSide.printArea.height}
                      onChange={(e) => updatePrintArea(currentSideIndex, 'height', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Zoom Scale */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">줌 배율</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    배율 (0.1 - 5.0)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="5.0"
                    value={currentSide.zoomScale || 1.0}
                    onChange={(e) => updateSideField(currentSideIndex, 'zoomScale', parseFloat(e.target.value) || 1.0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    현재: {((currentSide.zoomScale || 1.0) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg p-8 text-center">
              <p className="text-gray-500">면을 선택하거나 추가해주세요.</p>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />
    </div>
  );
}