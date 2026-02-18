'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase-client';
import {
  Product,
  ProductColor,
  ProductSide,
  OrderItem,
  DesignTemplate,
  CanvasState,
  CustomFont,
} from '@/types/types';
import { EditorMode } from './useEditorMode';
import { parseCanvasState, coerceCustomFonts } from '@/lib/downloadUtils';

interface UseEditorDataParams {
  productId: string;
  mode: EditorMode;
  orderId?: string;
  orderItemId?: string;
  templateId?: string;
}

interface EditorData {
  product: Product | null;
  productColors: ProductColor[];
  orderItem: OrderItem | null;
  templates: DesignTemplate[];
  selectedTemplate: DesignTemplate | null;
  canvasStates: Record<string, CanvasState | string | null>;
  productColor: string;
  customFonts: CustomFont[];
  loading: boolean;
  error: string | null;
  refetchTemplates: () => Promise<void>;
  setSelectedTemplate: (template: DesignTemplate | null) => void;
}

export function useEditorData({
  productId,
  mode,
  orderId,
  orderItemId,
  templateId,
}: UseEditorDataParams): EditorData {
  const [product, setProduct] = useState<Product | null>(null);
  const [productColors, setProductColors] = useState<ProductColor[]>([]);
  const [orderItem, setOrderItem] = useState<OrderItem | null>(null);
  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<DesignTemplate | null>(null);
  const [canvasStates, setCanvasStates] = useState<Record<string, CanvasState | string | null>>({});
  const [productColor, setProductColor] = useState('#FFFFFF');
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch product
  const fetchProduct = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('products')
      .select('*, manufacturers(id, name)')
      .eq('id', productId)
      .single();

    if (error) throw new Error(`제품을 불러올 수 없습니다: ${error.message}`);
    return data as Product;
  }, [productId]);

  // Fetch product colors
  const fetchProductColors = useCallback(async (prodId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('product_colors')
      .select(`
        *,
        manufacturer_colors (
          id, name, hex, color_code, label
        )
      `)
      .eq('product_id', prodId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching product colors:', error);
      return [];
    }
    return (data || []) as ProductColor[];
  }, []);

  // Fetch order item
  const fetchOrderItem = useCallback(async (itemId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('order_items')
      .select('*, products(product_code)')
      .eq('id', itemId)
      .single();

    if (error) throw new Error(`주문 항목을 불러올 수 없습니다: ${error.message}`);
    return data as OrderItem;
  }, []);

  // Fetch templates
  const fetchTemplates = useCallback(async (prodId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('design_templates')
      .select('*')
      .eq('product_id', prodId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
    return (data || []) as DesignTemplate[];
  }, []);

  const refetchTemplates = useCallback(async () => {
    const t = await fetchTemplates(productId);
    setTemplates(t);
  }, [fetchTemplates, productId]);

  // Initial data load
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Always fetch product
        const prod = await fetchProduct();
        if (cancelled) return;
        setProduct(prod);

        // Fetch product colors
        const colors = await fetchProductColors(prod.id);
        if (cancelled) return;
        setProductColors(colors);

        // Mode-specific data loading
        if (mode === 'order' && orderItemId) {
          const item = await fetchOrderItem(orderItemId);
          if (cancelled) return;
          setOrderItem(item);
          setCanvasStates(item.canvas_state || {});
          setCustomFonts(coerceCustomFonts(item.custom_fonts));

          // Extract product color from canvas state or item options
          const states = Object.values(item.canvas_state || {});
          for (const stateRaw of states) {
            const state = parseCanvasState(stateRaw);
            if (typeof state?.productColor === 'string' && state.productColor.startsWith('#')) {
              setProductColor(state.productColor);
              break;
            }
          }
          if (productColor === '#FFFFFF') {
            const variants = item.item_options?.variants;
            if (Array.isArray(variants) && variants.length > 0 && variants[0]?.color_hex) {
              setProductColor(variants[0].color_hex);
            } else if (item.item_options?.color_hex) {
              setProductColor(item.item_options.color_hex);
            }
          }
        } else if (mode === 'template') {
          const t = await fetchTemplates(prod.id);
          if (cancelled) return;
          setTemplates(t);

          if (templateId) {
            const selected = t.find((tmpl) => tmpl.id === templateId) || null;
            setSelectedTemplate(selected);
            if (selected) {
              setCanvasStates(selected.canvas_state as Record<string, CanvasState | string | null>);
            }
          }
        }
        // design mode: no canvas state to load (fresh canvas)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [productId, mode, orderItemId, templateId, fetchProduct, fetchProductColors, fetchOrderItem, fetchTemplates]);

  return {
    product,
    productColors,
    orderItem,
    templates,
    selectedTemplate,
    canvasStates,
    productColor,
    customFonts,
    loading,
    error,
    refetchTemplates,
    setSelectedTemplate,
  };
}
