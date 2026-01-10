'use client';

import { useEffect, useState, useRef } from 'react';
import { Product, ProductColor, ProductLayer, ProductSide, SizeOption } from '@/types/types';
import { createClient } from '@/lib/supabase-client';
import { Save, X, Plus, Trash2, Upload, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

interface ProductEditorProps {
  product?: Product | null;
  onSave: (product: Product) => void;
  onCancel: () => void;
}

const buildPrintArea = (printArea?: ProductSide['printArea']) => ({
  x: Math.max(0, Math.round(printArea?.x ?? 0)),
  y: Math.max(0, Math.round(printArea?.y ?? 0)),
  width: Math.max(0, Math.round(printArea?.width ?? 200)),
  height: Math.max(0, Math.round(printArea?.height ?? 200)),
});

const buildRealLifeDimensions = (dimensions?: ProductSide['realLifeDimensions']) => ({
  productWidthMm: Math.max(0, Math.round(dimensions?.productWidthMm ?? 0)),
  printAreaWidthMm: Math.max(0, Math.round(dimensions?.printAreaWidthMm ?? 0)),
  printAreaHeightMm: Math.max(0, Math.round(dimensions?.printAreaHeightMm ?? 0)),
});

const normalizeLayer = (layer: Partial<ProductLayer>, index: number): ProductLayer => ({
  id: layer.id || `layer-${Date.now()}-${index}`,
  name: layer.name || `Layer ${index + 1}`,
  imageUrl: typeof layer.imageUrl === 'string' ? layer.imageUrl : '',
  colorOptions: Array.isArray(layer.colorOptions)
    ? layer.colorOptions.map((option) => ({
        hex: typeof option?.hex === 'string' ? option.hex : '#FFFFFF',
        colorCode: typeof option?.colorCode === 'string' ? option.colorCode : '',
      }))
    : [],
  zIndex: typeof layer.zIndex === 'number' ? layer.zIndex : index,
});

const normalizeSide = (side: Partial<ProductSide>, index: number): ProductSide => ({
  id: side.id || `side-${Date.now()}-${index}`,
  name: side.name || `면 ${index + 1}`,
  imageUrl: typeof side.imageUrl === 'string' ? side.imageUrl : '',
  printArea: buildPrintArea(side.printArea),
  layers: Array.isArray(side.layers) ? side.layers.map((layer, layerIndex) => normalizeLayer(layer, layerIndex)) : [],
  realLifeDimensions: buildRealLifeDimensions(side.realLifeDimensions),
  zoomScale: typeof side.zoomScale === 'number' ? side.zoomScale : 1.0,
});

const normalizeSides = (rawSides: ProductSide[] | null | undefined) =>
  (rawSides || []).map((side, index) => normalizeSide(side, index));

const isLayeredSide = (side: ProductSide): side is ProductSide & { layers: ProductLayer[] } =>
  Array.isArray(side.layers) && side.layers.length > 0;

const getSidePreviewUrl = (side: ProductSide) => {
  if (isLayeredSide(side)) {
    const sortedLayers = [...side.layers].sort((a, b) => a.zIndex - b.zIndex);
    return sortedLayers.find((layer) => layer.imageUrl)?.imageUrl || '';
  }
  return side.imageUrl;
};

export default function ProductEditor({ product, onSave, onCancel }: ProductEditorProps) {
  const isNewProduct = !product;

  // Basic product fields
  const [title, setTitle] = useState(product?.title || '');
  const [basePrice, setBasePrice] = useState(product?.base_price || 0);
  const [category, setCategory] = useState(product?.category || '');
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [thumbnailImageLink, setThumbnailImageLink] = useState(product?.thumbnail_image_link ?? '');
  const [descriptionImage, setDescriptionImage] = useState(product?.description_image ?? '');
  const [sizingChartImage, setSizingChartImage] = useState(product?.sizing_chart_image ?? '');
  const [productCode, setProductCode] = useState(product?.product_code ?? '');
  const [discountRates, setDiscountRates] = useState<Array<{ min_quantity: number; discount_rate: number }>>(
    Array.isArray(product?.discount_rates) ? product.discount_rates : []
  );

  // Product sides
  const [sides, setSides] = useState<ProductSide[]>(() => normalizeSides(product?.configuration || []));
  const [currentSideIndex, setCurrentSideIndex] = useState(0);

  // Size options
  const [sizeOptions, setSizeOptions] = useState<SizeOption[]>(product?.size_options || []);

  // Product colors (single image products)
  const [productColors, setProductColors] = useState<ProductColor[]>([]);
  const [colorsLoading, setColorsLoading] = useState(false);
  const [addingColor, setAddingColor] = useState(false);
  const [deletingColorId, setDeletingColorId] = useState<string | null>(null);
  const [colorDraft, setColorDraft] = useState({
    color_id: '',
    name: '',
    hex: '#FFFFFF',
    label: '',
    color_code: '',
    sort_order: 0,
    is_active: true,
  });

  // UI state
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  type UploadTarget =
    | { kind: 'side'; sideIndex: number; layerIndex?: number }
    | { kind: 'product'; field: 'thumbnail_image_link' | 'description_image' | 'sizing_chart_image' };
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSide = sides[currentSideIndex];
  const isCurrentSideLayered = currentSide ? isLayeredSide(currentSide) : false;
  const currentSideLayers = currentSide?.layers ?? [];
  const hasLayeredItem = sides.some((side) => isLayeredSide(side));

  const fetchProductColors = async (productId: string) => {
    setColorsLoading(true);
    try {
      const response = await fetch(`/api/admin/product-colors?productId=${productId}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '색상 데이터를 불러오지 못했습니다.');
      }
      const payload = await response.json();
      setProductColors(payload?.data || []);
    } catch (error) {
      console.error('Error fetching product colors:', error);
    } finally {
      setColorsLoading(false);
    }
  };

  useEffect(() => {
    if (!product?.id) return;
    if (hasLayeredItem) return;
    void fetchProductColors(product.id);
  }, [product?.id, hasLayeredItem]);

  const handleAddProductColor = async () => {
    if (!product?.id) {
      alert('제품을 먼저 저장해주세요.');
      return;
    }

    const colorId = colorDraft.color_id.trim();
    const name = colorDraft.name.trim();
    const hex = colorDraft.hex.trim();
    const isValidHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);

    if (!colorId) {
      alert('color_id가 필요합니다.');
      return;
    }
    if (!name) {
      alert('이름이 필요합니다.');
      return;
    }
    if (!isValidHex) {
      alert('HEX 형식이 올바르지 않습니다. (예: #FFFFFF)');
      return;
    }

    setAddingColor(true);
    try {
      const response = await fetch('/api/admin/product-colors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          color_id: colorId,
          name,
          hex,
          label: colorDraft.label.trim() || null,
          color_code: colorDraft.color_code.trim() || null,
          sort_order: Number.isFinite(colorDraft.sort_order) ? colorDraft.sort_order : 0,
          is_active: colorDraft.is_active,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '색상 추가에 실패했습니다.');
      }

      const payload = await response.json();
      const created = payload?.data as ProductColor;
      setProductColors((prev) => [...prev, created].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
      setColorDraft({
        color_id: '',
        name: '',
        hex: '#FFFFFF',
        label: '',
        color_code: '',
        sort_order: 0,
        is_active: true,
      });
    } catch (error) {
      console.error('Error adding product color:', error);
      alert(error instanceof Error ? error.message : '색상 추가에 실패했습니다.');
    } finally {
      setAddingColor(false);
    }
  };

  const handleDeleteProductColor = async (id: string) => {
    const confirmed = window.confirm('이 색상을 삭제할까요?');
    if (!confirmed) return;

    setDeletingColorId(id);
    try {
      const response = await fetch(`/api/admin/product-colors?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '색상 삭제에 실패했습니다.');
      }
      setProductColors((prev) => prev.filter((color) => color.id !== id));
    } catch (error) {
      console.error('Error deleting product color:', error);
      alert(error instanceof Error ? error.message : '색상 삭제에 실패했습니다.');
    } finally {
      setDeletingColorId(null);
    }
  };

  // Add new side
  const handleAddSide = () => {
    const newSide: ProductSide = {
      id: `side-${Date.now()}`,
      name: `면 ${sides.length + 1}`,
      imageUrl: '',
      printArea: buildPrintArea(),
      layers: [],
      realLifeDimensions: buildRealLifeDimensions(),
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

  const updateRealLifeDimensions = (index: number, field: keyof NonNullable<ProductSide['realLifeDimensions']>, value: number) => {
    const newSides = [...sides];
    newSides[index] = {
      ...newSides[index],
      realLifeDimensions: {
        ...buildRealLifeDimensions(newSides[index].realLifeDimensions),
        [field]: Math.max(0, Math.round(value)),
      },
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

  const setSideMode = (index: number, mode: 'single' | 'layered') => {
    const newSides = [...sides];
    const currentSide = newSides[index];
    if (mode === 'layered') {
      newSides[index] = {
        ...currentSide,
        layers: currentSide.layers && currentSide.layers.length > 0
          ? currentSide.layers
          : [
              {
                id: `layer-${Date.now()}`,
                name: 'Layer 1',
                imageUrl: '',
                colorOptions: [],
                zIndex: 0,
              },
            ],
        imageUrl: currentSide.imageUrl || '',
      };
    } else {
      newSides[index] = {
        ...currentSide,
        layers: [],
      };
    }
    setSides(newSides);
  };

  const addLayer = (sideIndex: number) => {
    const newSides = [...sides];
    const side = newSides[sideIndex];
    const layers = Array.isArray(side.layers) ? [...side.layers] : [];
    layers.push({
      id: `layer-${Date.now()}`,
      name: `Layer ${layers.length + 1}`,
      imageUrl: '',
      colorOptions: [],
      zIndex: layers.length,
    });
    newSides[sideIndex] = {
      ...side,
      layers,
    };
    setSides(newSides);
  };

  const removeLayer = (sideIndex: number, layerIndex: number) => {
    const newSides = [...sides];
    const side = newSides[sideIndex];
    const layers = Array.isArray(side.layers) ? [...side.layers] : [];
    if (layers.length <= 1) {
      alert('최소 1개의 레이어가 필요합니다.');
      return;
    }
    layers.splice(layerIndex, 1);
    newSides[sideIndex] = {
      ...side,
      layers,
    };
    setSides(newSides);
  };

  const updateLayerField = (
    sideIndex: number,
    layerIndex: number,
    field: keyof ProductLayer,
    value: string | number
  ) => {
    const newSides = [...sides];
    const side = newSides[sideIndex];
    const layers = Array.isArray(side.layers) ? [...side.layers] : [];
    if (!layers[layerIndex]) return;
    layers[layerIndex] = {
      ...layers[layerIndex],
      [field]: value,
    };
    newSides[sideIndex] = {
      ...side,
      layers,
    };
    setSides(newSides);
  };

  const addLayerColorOption = (sideIndex: number, layerIndex: number) => {
    const newSides = [...sides];
    const side = newSides[sideIndex];
    const layers = Array.isArray(side.layers) ? [...side.layers] : [];
    const layer = layers[layerIndex];
    if (!layer) return;
    const colorOptions = Array.isArray(layer.colorOptions) ? [...layer.colorOptions] : [];
    colorOptions.push({ hex: '#FFFFFF', colorCode: '' });
    layers[layerIndex] = {
      ...layer,
      colorOptions,
    };
    newSides[sideIndex] = {
      ...side,
      layers,
    };
    setSides(newSides);
  };

  const updateLayerColorOption = (
    sideIndex: number,
    layerIndex: number,
    optionIndex: number,
    field: 'hex' | 'colorCode',
    value: string
  ) => {
    const newSides = [...sides];
    const side = newSides[sideIndex];
    const layers = Array.isArray(side.layers) ? [...side.layers] : [];
    const layer = layers[layerIndex];
    if (!layer) return;
    const colorOptions = Array.isArray(layer.colorOptions) ? [...layer.colorOptions] : [];
    if (!colorOptions[optionIndex]) return;
    colorOptions[optionIndex] = {
      ...colorOptions[optionIndex],
      [field]: value,
    };
    layers[layerIndex] = {
      ...layer,
      colorOptions,
    };
    newSides[sideIndex] = {
      ...side,
      layers,
    };
    setSides(newSides);
  };

  const removeLayerColorOption = (sideIndex: number, layerIndex: number, optionIndex: number) => {
    const newSides = [...sides];
    const side = newSides[sideIndex];
    const layers = Array.isArray(side.layers) ? [...side.layers] : [];
    const layer = layers[layerIndex];
    if (!layer) return;
    const colorOptions = Array.isArray(layer.colorOptions) ? [...layer.colorOptions] : [];
    colorOptions.splice(optionIndex, 1);
    layers[layerIndex] = {
      ...layer,
      colorOptions,
    };
    newSides[sideIndex] = {
      ...side,
      layers,
    };
    setSides(newSides);
  };

  const persistProductImageField = async (
    field: 'thumbnail_image_link' | 'description_image' | 'sizing_chart_image',
    value: string | null
  ) => {
    if (!product?.id) return;
    try {
      const response = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id, [field]: value }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '이미지 링크 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error persisting product image:', error);
      alert(error instanceof Error ? error.message : '이미지 링크 저장 중 오류가 발생했습니다.');
    }
  };

  // Handle image upload
  const handleImageUpload = async (target: UploadTarget, file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();

      // Create unique file name
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath =
        target.kind === 'product'
          ? `product-images/product-meta/${product?.id ?? 'new'}/${target.field}/${fileName}`
          : `product-images/${fileName}`;

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

      if (target.kind === 'side') {
        if (typeof target.layerIndex === 'number') {
          updateLayerField(target.sideIndex, target.layerIndex, 'imageUrl', publicUrl);
        } else {
          updateSideField(target.sideIndex, 'imageUrl', publicUrl);
        }
      } else if (target.field === 'thumbnail_image_link') {
        setThumbnailImageLink(publicUrl);
        await persistProductImageField('thumbnail_image_link', publicUrl);
      } else if (target.field === 'description_image') {
        setDescriptionImage(publicUrl);
        await persistProductImageField('description_image', publicUrl);
      } else {
        setSizingChartImage(publicUrl);
        await persistProductImageField('sizing_chart_image', publicUrl);
      }

      alert('이미지가 업로드되었습니다.');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // Trigger file input
  const triggerFileInput = (sideIndex: number, layerIndex?: number) => {
    setUploadTarget({ kind: 'side', sideIndex, layerIndex });
    fileInputRef.current?.click();
  };

  const triggerProductFileInput = (field: 'thumbnail_image_link' | 'description_image' | 'sizing_chart_image') => {
    setUploadTarget({ kind: 'product', field });
    fileInputRef.current?.click();
  };

  const clearProductImage = (field: 'thumbnail_image_link' | 'description_image' | 'sizing_chart_image') => {
    if (field === 'thumbnail_image_link') {
      setThumbnailImageLink('');
    } else if (field === 'description_image') {
      setDescriptionImage('');
    } else {
      setSizingChartImage('');
    }
    void persistProductImageField(field, null);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadTarget) {
      const target = uploadTarget;
      setUploadTarget(null);
      void handleImageUpload(target, file);
    }
    e.target.value = ''; // Reset input
  };

  // Add size option
  const handleAddSizeOption = () => {
    const newSize: SizeOption = {
      id: '',
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
      const hasLayers = isLayeredSide(sides[i]);
      if (hasLayers) {
        const layers = sides[i].layers || [];
        if (layers.length === 0) {
          alert(`면 ${i + 1}에 최소 1개의 레이어가 필요합니다.`);
          return false;
        }
        for (let j = 0; j < layers.length; j++) {
          if (!layers[j].name.trim()) {
            alert(`면 ${i + 1}의 레이어 ${j + 1} 이름을 입력해주세요.`);
            return false;
          }
          if (!layers[j].imageUrl.trim()) {
            alert(`면 ${i + 1}의 레이어 ${j + 1} 이미지를 업로드해주세요.`);
            return false;
          }
        }
      } else if (!sides[i].imageUrl.trim()) {
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
      const configuration = sides.map((side) => {
        const hasLayers = isLayeredSide(side);
        return {
          ...side,
          imageUrl: hasLayers ? '' : side.imageUrl,
          layers: hasLayers ? side.layers : [],
          printArea: buildPrintArea(side.printArea),
          realLifeDimensions: buildRealLifeDimensions(side.realLifeDimensions),
          zoomScale: typeof side.zoomScale === 'number' ? side.zoomScale : 1.0,
        };
      });

      const productData = {
        title,
        base_price: basePrice,
        category: category || null,
        is_active: isActive,
        configuration,
        size_options: sizeOptions.length > 0 ? sizeOptions : null,
        thumbnail_image_link: thumbnailImageLink.trim() ? thumbnailImageLink.trim() : null,
        description_image: descriptionImage.trim() ? descriptionImage.trim() : null,
        sizing_chart_image: sizingChartImage.trim() ? sizingChartImage.trim() : null,
        product_code: productCode.trim() ? productCode.trim() : null,
        discount_rates: discountRates.length > 0 ? discountRates : null,
      };

      if (!isNewProduct && !product?.id) {
        throw new Error('제품 ID가 필요합니다.');
      }

      const response = await fetch('/api/admin/products', {
        method: isNewProduct ? 'POST' : 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          isNewProduct ? productData : { id: product?.id, ...productData }
        ),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || '제품 저장에 실패했습니다.');
      }

      const responsePayload = await response.json();
      const savedProduct = responsePayload?.data as Product;
      onSave(savedProduct);
    } catch (error) {
      console.error('Error saving product:', error);
      alert('제품 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {isNewProduct ? '새 제품 추가' : '제품 편집'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {isNewProduct ? '제품 정보를 입력하고 면을 추가하세요.' : `${product.title} 편집 중`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Panel - Basic Info */}
        <div className="space-y-4">
          {/* Basic Information */}
          <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  placeholder="예: 의류"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제품 코드 (product_code)</label>
                <input
                  type="text"
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  placeholder="예: TSHIRT-001"
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

          {/* Discount Rates */}
          <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">수량별 할인율</h3>
                <p className="text-xs text-gray-500 mt-0.5">discount_rates (주문 수량에 따른 할인율)</p>
              </div>
              <button
                onClick={() => setDiscountRates([...discountRates, { min_quantity: 0, discount_rate: 0 }])}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                추가
              </button>
            </div>
            <div className="space-y-2">
              {discountRates.map((rate, index) => (
                <div key={`discount-rate-${index}`} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">최소 수량</label>
                    <input
                      type="number"
                      value={rate.min_quantity}
                      onChange={(e) => {
                        const newRates = [...discountRates];
                        newRates[index] = { ...newRates[index], min_quantity: parseInt(e.target.value) || 0 };
                        setDiscountRates(newRates);
                      }}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      placeholder="예: 10"
                      min="0"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">할인율 (%)</label>
                    <input
                      type="number"
                      value={rate.discount_rate}
                      onChange={(e) => {
                        const newRates = [...discountRates];
                        newRates[index] = { ...newRates[index], discount_rate: parseFloat(e.target.value) || 0 };
                        setDiscountRates(newRates);
                      }}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      placeholder="예: 5"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                  <button
                    onClick={() => setDiscountRates(discountRates.filter((_, i) => i !== index))}
                    className="p-1 text-red-600 hover:bg-red-50 rounded mt-5"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {discountRates.length === 0 && (
                <p className="text-sm text-gray-500">할인율이 없습니다.</p>
              )}
              {discountRates.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  예: 최소 수량 10, 할인율 5% → 10개 이상 주문 시 5% 할인
                </p>
              )}
            </div>
          </div>

          {/* Product Images */}
          <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">제품 이미지</h3>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">제품 썸네일 (thumbnail_image_link)</label>
                <div className="flex items-start gap-3">
                  {thumbnailImageLink ? (
                    <img
                      src={thumbnailImageLink}
                      alt="제품 썸네일"
                      className="w-20 h-20 object-cover rounded border border-gray-200"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={thumbnailImageLink}
                      onChange={(e) => setThumbnailImageLink(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      placeholder="https://..."
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => triggerProductFileInput('thumbnail_image_link')}
                        disabled={uploading}
                        className="inline-flex items-center gap-1 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        업로드
                      </button>
                      {!!thumbnailImageLink && (
                        <button
                          onClick={() => clearProductImage('thumbnail_image_link')}
                          disabled={uploading}
                          className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          지우기
                        </button>
                      )}
                    </div>
                    {!product?.id && (
                      <p className="text-xs text-gray-500">새 제품은 저장 후 링크가 DB에 저장됩니다.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">상세 이미지 (description_image)</label>
                <div className="flex items-start gap-3">
                  {descriptionImage ? (
                    <img
                      src={descriptionImage}
                      alt="상세 이미지"
                      className="w-20 h-20 object-cover rounded border border-gray-200"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={descriptionImage}
                      onChange={(e) => setDescriptionImage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      placeholder="https://..."
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => triggerProductFileInput('description_image')}
                        disabled={uploading}
                        className="inline-flex items-center gap-1 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        업로드
                      </button>
                      {!!descriptionImage && (
                        <button
                          onClick={() => clearProductImage('description_image')}
                          disabled={uploading}
                          className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          지우기
                        </button>
                      )}
                    </div>
                    {!product?.id && (
                      <p className="text-xs text-gray-500">새 제품은 저장 후 링크가 DB에 저장됩니다.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">사이즈 차트 이미지 (sizing_chart_image)</label>
                <div className="flex items-start gap-3">
                  {sizingChartImage ? (
                    <img
                      src={sizingChartImage}
                      alt="사이즈 차트"
                      className="w-20 h-20 object-cover rounded border border-gray-200"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={sizingChartImage}
                      onChange={(e) => setSizingChartImage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      placeholder="https://..."
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => triggerProductFileInput('sizing_chart_image')}
                        disabled={uploading}
                        className="inline-flex items-center gap-1 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        업로드
                      </button>
                      {!!sizingChartImage && (
                        <button
                          onClick={() => clearProductImage('sizing_chart_image')}
                          disabled={uploading}
                          className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          지우기
                        </button>
                      )}
                    </div>
                    {!product?.id && (
                      <p className="text-xs text-gray-500">새 제품은 저장 후 링크가 DB에 저장됩니다.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Size Options */}
          <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
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
                <div key={`size-${index}`} className="flex gap-2 w-full">
                  <input
                    type="text"
                    value={size.id}
                    onChange={(e) => updateSizeOption(index, 'id', e.target.value)}
                    className="w-30 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    placeholder="ID"
                  />
                  <input
                    type="text"
                    value={size.name}
                    onChange={(e) => updateSizeOption(index, 'name', e.target.value)}
                    className="w-30 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    placeholder="코드 (예: S)"
                  />
                  <input
                    type="text"
                    value={size.label}
                    onChange={(e) => updateSizeOption(index, 'label', e.target.value)}
                    className="w-30 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
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

          {/* Product Colors (Single Image Products Only) */}
          {!hasLayeredItem && (
            <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">색상 옵션</h3>
                  <p className="text-xs text-gray-500 mt-0.5">단일 이미지 제품만 해당됩니다. (product_colors)</p>
                </div>
              </div>

              {!product?.id ? (
                <p className="text-sm text-gray-600">제품을 저장한 후 색상을 추가할 수 있습니다.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">color_id *</label>
                      <input
                        type="text"
                        value={colorDraft.color_id}
                        onChange={(e) => setColorDraft((prev) => ({ ...prev, color_id: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        placeholder="예: white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">이름 *</label>
                      <input
                        type="text"
                        value={colorDraft.name}
                        onChange={(e) => setColorDraft((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        placeholder="예: 화이트"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">HEX *</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={colorDraft.hex}
                          onChange={(e) => setColorDraft((prev) => ({ ...prev, hex: e.target.value }))}
                          className="h-9 w-10 border border-gray-300 rounded"
                        />
                        <input
                          type="text"
                          value={colorDraft.hex}
                          onChange={(e) => setColorDraft((prev) => ({ ...prev, hex: e.target.value }))}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                          placeholder="#FFFFFF"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">sort_order</label>
                      <input
                        type="number"
                        value={colorDraft.sort_order}
                        onChange={(e) => setColorDraft((prev) => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">label</label>
                      <input
                        type="text"
                        value={colorDraft.label}
                        onChange={(e) => setColorDraft((prev) => ({ ...prev, label: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        placeholder="옵션 설명 (선택)"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">color_code</label>
                      <input
                        type="text"
                        value={colorDraft.color_code}
                        onChange={(e) => setColorDraft((prev) => ({ ...prev, color_code: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        placeholder="코드 (선택)"
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={colorDraft.is_active}
                          onChange={(e) => setColorDraft((prev) => ({ ...prev, is_active: e.target.checked }))}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                        />
                        활성
                      </label>
                      <button
                        onClick={handleAddProductColor}
                        disabled={addingColor}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        {addingColor ? '추가 중...' : '추가'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">등록된 색상</p>
                      {colorsLoading && <p className="text-xs text-gray-500">불러오는 중...</p>}
                    </div>
                    {productColors.length === 0 && !colorsLoading && (
                      <p className="text-sm text-gray-500">등록된 색상이 없습니다.</p>
                    )}
                    {productColors.map((color) => (
                      <div
                        key={color.id}
                        className="flex items-center justify-between gap-2 border border-gray-200 rounded-md px-2 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-5 h-5 rounded border border-gray-300 shrink-0"
                            style={{ backgroundColor: color.hex }}
                            title={color.hex}
                          />
                          <div className="min-w-0">
                            <p className="text-sm text-gray-900 truncate">
                              {color.name} <span className="text-xs text-gray-500">({color.color_id})</span>
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {color.hex}
                              {color.label ? ` · ${color.label}` : ''}
                              {color.color_code ? ` · ${color.color_code}` : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteProductColor(color.id)}
                          disabled={deletingColorId === color.id}
                          className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Middle Panel - Sides List */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">제품 면 ({sides.length})</h3>
              <button
                onClick={handleAddSide}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                면 추가
              </button>
            </div>

            <div className="space-y-3">
              {sides.map((side, index) => {
                const previewUrl = getSidePreviewUrl(side);
                const layered = isLayeredSide(side);
                const layerCount = side.layers?.length ?? 0;
                return (
                  <div
                    key={`${side.id}-${index}`}
                    className={`border rounded-md p-3 cursor-pointer transition-all ${
                      currentSideIndex === index
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setCurrentSideIndex(index)}
                  >
                    <div className="flex items-center gap-3">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={side.name}
                          className="w-16 h-16 object-cover rounded border border-gray-200"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded border border-gray-200 flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
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
                          <span
                            className={`px-2 py-0.5 text-[10px] rounded-full ${
                              layered ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {layered ? `레이어 ${layerCount}` : '단일'}
                          </span>
                        </div>
                        <div className="flex gap-2 mt-2">
                          {!layered && (
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
                          )}
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
                );
              })}

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
              <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentSideIndex(Math.max(0, currentSideIndex - 1))}
                    disabled={currentSideIndex === 0}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-30 disabled:cursor-not-allowed"
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
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Side Settings */}
              <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">면 설정</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">면 ID</label>
                    <input
                      type="text"
                      value={currentSide.id}
                      onChange={(e) => updateSideField(currentSideIndex, 'id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                      placeholder="예: front"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">렌더링 모드</label>
                    <select
                      value={isCurrentSideLayered ? 'layered' : 'single'}
                      onChange={(e) => setSideMode(currentSideIndex, e.target.value as 'single' | 'layered')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    >
                      <option value="single">단일 이미지</option>
                      <option value="layered">레이어</option>
                    </select>
                  </div>
                  {!isCurrentSideLayered && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">이미지 URL</label>
                      <input
                        type="text"
                        value={currentSide.imageUrl}
                        onChange={(e) => updateSideField(currentSideIndex, 'imageUrl', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                        placeholder="https://..."
                      />
                      <button
                        onClick={() => triggerFileInput(currentSideIndex)}
                        disabled={uploading}
                        className="inline-flex items-center gap-1 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        이미지 업로드
                      </button>
                      <p className="text-xs text-gray-500">
                        단일 이미지 제품의 색상은 product_colors 테이블에서 관리됩니다.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Print Area Configuration */}
              <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">인쇄 영역 (픽셀)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">X 위치</label>
                    <input
                      type="number"
                      value={currentSide.printArea.x}
                      onChange={(e) => updatePrintArea(currentSideIndex, 'x', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Y 위치</label>
                    <input
                      type="number"
                      value={currentSide.printArea.y}
                      onChange={(e) => updatePrintArea(currentSideIndex, 'y', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">너비</label>
                  <input
                      type="number"
                      value={currentSide.printArea.width}
                      onChange={(e) => updatePrintArea(currentSideIndex, 'width', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">높이</label>
                    <input
                      type="number"
                      value={currentSide.printArea.height}
                      onChange={(e) => updatePrintArea(currentSideIndex, 'height', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Real Life Dimensions */}
              <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">실제 치수 (mm)</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">제품 너비</label>
                    <input
                      type="number"
                      value={currentSide.realLifeDimensions?.productWidthMm || 0}
                      onChange={(e) => updateRealLifeDimensions(currentSideIndex, 'productWidthMm', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">인쇄 영역 너비</label>
                    <input
                      type="number"
                      value={currentSide.realLifeDimensions?.printAreaWidthMm || 0}
                      onChange={(e) => updateRealLifeDimensions(currentSideIndex, 'printAreaWidthMm', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">인쇄 영역 높이</label>
                    <input
                      type="number"
                      value={currentSide.realLifeDimensions?.printAreaHeightMm || 0}
                      onChange={(e) => updateRealLifeDimensions(currentSideIndex, 'printAreaHeightMm', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Zoom Scale */}
              <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    현재: {((currentSide.zoomScale || 1.0) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              {/* Layer Configuration */}
              {isCurrentSideLayered && (
                <div className="bg-white border border-gray-200/60 rounded-md p-4 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">레이어 설정</h3>
                    <button
                      onClick={() => addLayer(currentSideIndex)}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                      레이어 추가
                    </button>
                  </div>

                  {currentSideLayers.map((layer, layerIndex) => (
                    <div key={`${layer.id}-${layerIndex}`} className="border border-gray-200 rounded-md p-3 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">레이어 ID</label>
                              <input
                                type="text"
                                value={layer.id}
                                onChange={(e) => updateLayerField(currentSideIndex, layerIndex, 'id', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">이름</label>
                              <input
                                type="text"
                                value={layer.name}
                                onChange={(e) => updateLayerField(currentSideIndex, layerIndex, 'name', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Z-Index</label>
                              <input
                                type="number"
                                value={layer.zIndex}
                                onChange={(e) => updateLayerField(currentSideIndex, layerIndex, 'zIndex', parseInt(e.target.value) || 0)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                onClick={() => triggerFileInput(currentSideIndex, layerIndex)}
                                disabled={uploading}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                              >
                                <Upload className="w-3 h-3" />
                                이미지 업로드
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">이미지 URL</label>
                            <input
                              type="text"
                              value={layer.imageUrl}
                              onChange={(e) => updateLayerField(currentSideIndex, layerIndex, 'imageUrl', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => removeLayer(currentSideIndex, layerIndex)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-600">컬러 옵션</p>
                          <button
                            onClick={() => addLayerColorOption(currentSideIndex, layerIndex)}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            옵션 추가
                          </button>
                        </div>
                        {layer.colorOptions.length === 0 && (
                          <p className="text-xs text-gray-400">등록된 컬러 옵션이 없습니다.</p>
                        )}
                        {layer.colorOptions.map((option, optionIndex) => (
                          <div key={`${layer.id}-color-${optionIndex}`} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={option.hex}
                              onChange={(e) => updateLayerColorOption(currentSideIndex, layerIndex, optionIndex, 'hex', e.target.value)}
                              className="w-20 px-2 py-1 text-xs border border-gray-300 rounded"
                              placeholder="#FFFFFF"
                            />
                            <input
                              type="text"
                              value={option.colorCode}
                              onChange={(e) => updateLayerColorOption(currentSideIndex, layerIndex, optionIndex, 'colorCode', e.target.value)}
                              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                              placeholder="WHT-001"
                            />
                            <button
                              onClick={() => removeLayerColorOption(currentSideIndex, layerIndex, optionIndex)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="bg-white border border-gray-200/60 rounded-md p-6 text-center">
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
