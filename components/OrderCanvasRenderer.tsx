/**
 * OrderCanvasRenderer - Standalone Canvas State Renderer
 *
 * This component renders Fabric.js canvas states from order_items in the database.
 * It recreates the exact visual output with proper dimensions and placements.
 *
 * COMPLETELY SELF-CONTAINED - No external component dependencies
 * Can be extracted and used in other codebases with the same Supabase database.
 *
 * Dependencies:
 * - fabric (6.9.1+): npm install fabric
 * - @supabase/supabase-js: npm install @supabase/supabase-js
 *
 * Database Requirements:
 * - order_items table with canvas_state column (jsonb)
 * - products table with configuration column (jsonb)
 * - Supabase Storage for product mockup images
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ProductSide {
  id: string;
  name: string;
  imageUrl: string;
  printArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  realLifeDimensions?: {
    printAreaWidthMm: number;
    printAreaHeightMm: number;
    productWidthMm: number;
  };
  zoomScale?: number;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_title: string;
  quantity: number;
  price_per_item: number;
  canvas_state: Record<string, string> | Record<string, unknown>;
  item_options?: {
    size_id?: string;
    size_name?: string;
    color_id?: string;
    color_name?: string;
    color_hex?: string;
  };
  thumbnail_url?: string | null;
}

interface Product {
  id: string;
  title: string;
  configuration: ProductSide[];
}

interface CanvasStateData {
  version?: string;
  objects: any[];
}

// ============================================================================
// SUPABASE CLIENT (INLINE)
// ============================================================================

/**
 * Creates a Supabase client
 * Replace these with your own Supabase credentials if using in another project
 */
function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

// ============================================================================
// SINGLE CANVAS RENDERER (INLINE COMPONENT)
// ============================================================================

interface SingleCanvasRendererProps {
  side: ProductSide;
  canvasState: string;
  productColor?: string;
  width?: number;
  height?: number;
  onCanvasReady?: (canvas: fabric.Canvas, sideId: string, scale: number) => void;
}

const SingleCanvasRenderer: React.FC<SingleCanvasRendererProps> = ({
  side,
  canvasState,
  productColor = '#FFFFFF',
  width = 500,
  height = 500,
  onCanvasReady,
}) => {
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasEl.current) return;

    // Initialize Fabric.js canvas
    const canvas = new fabric.Canvas(canvasEl.current, {
      width,
      height,
      backgroundColor: '#f3f3f3',
      preserveObjectStacking: true,
      selection: false, // Read-only mode
    });

    canvasRef.current = canvas;

    // Load and render
    renderCanvas(canvas);

    return () => {
      canvas.dispose();
      canvasRef.current = null;
    };
  }, [side, canvasState, productColor, width, height]);

  const renderCanvas = async (canvas: fabric.Canvas) => {
    try {
      const printW = side.printArea.width;
      const printH = side.printArea.height;

      // Temporary centered position (will be updated when image loads)
      const tempCenteredLeft = (width - printW) / 2;
      const tempCenteredTop = (height - printH) / 2;

      // Load background product image
      const img = await fabric.FabricImage.fromURL(side.imageUrl, {
        crossOrigin: 'anonymous',
      });

      if (!img) {
        throw new Error('Failed to load product image');
      }

      // Scale the image to fit the canvas
      const imgWidth = img.width || 0;
      const imgHeight = img.height || 0;

      if (imgWidth === 0 || imgHeight === 0) {
        throw new Error('Image has invalid dimensions');
      }

      // Get zoom scale from side configuration
      const zoomScale = side.zoomScale || 1.0;
      const baseScale = Math.min(width / imgWidth, height / imgHeight);
      const scale = baseScale * zoomScale;

      img.set({
        scaleX: scale,
        scaleY: scale,
        originX: 'center',
        originY: 'center',
        left: width / 2,
        top: height / 2,
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        hasControls: false,
        hasBorders: false,
        data: { id: 'background-product-image' },
      });

      // Apply product color filter
      img.filters = [];
      const colorFilter = new fabric.filters.BlendColor({
        color: productColor,
        mode: 'multiply',
        alpha: 1,
      });
      img.filters.push(colorFilter);
      img.applyFilters();

      canvas.add(img);
      canvas.sendObjectToBack(img);

      // Calculate print area position relative to the product image
      const scaledPrintW = side.printArea.width * scale;
      const scaledPrintH = side.printArea.height * scale;
      const scaledPrintX = side.printArea.x * scale;
      const scaledPrintY = side.printArea.y * scale;

      const imageLeft = width / 2 - (imgWidth * scale) / 2;
      const imageTop = height / 2 - (imgHeight * scale) / 2;

      const printAreaLeft = imageLeft + scaledPrintX;
      const printAreaTop = imageTop + scaledPrintY;

      // Parse and load saved canvas state
      if (canvasState) {
        const canvasData: CanvasStateData = JSON.parse(canvasState);

        console.log('Canvas data:', canvasData);
        console.log('Print area position:', { printAreaLeft, printAreaTop, scaledPrintW, scaledPrintH });
        console.log('Scale factor:', scale);

        if (canvasData.objects && canvasData.objects.length > 0) {
          console.log('Number of objects to load:', canvasData.objects.length);
          const objects = await fabric.util.enlivenObjects(canvasData.objects);
          console.log('Enlivened objects:', objects.length);

          objects.forEach((obj, index) => {
            if (obj && typeof obj === 'object' && 'type' in obj) {
              const fabricObj = obj as fabric.FabricObject;

              // Adjust object position to account for print area offset and centered image
              const currentLeft = fabricObj.left || 0;
              const currentTop = fabricObj.top || 0;

              console.log(`Object ${index} (${fabricObj.type}):`, {
                originalPosition: { left: currentLeft, top: currentTop },
                newPosition: { left: printAreaLeft + currentLeft, top: printAreaTop + currentTop },
                width: fabricObj.width,
                height: fabricObj.height,
              });

              canvas.add(fabricObj);
              console.log(`Object ${index} added to canvas`);
            }
          });

          console.log('Total objects on canvas:', canvas.getObjects().length);

          // Ensure all design objects are in front of the background
          const allObjects = canvas.getObjects();
          allObjects.forEach((obj) => {
            const objData = obj as { data?: { id?: string } };
            if (objData.data?.id !== 'background-product-image') {
              canvas.bringObjectToFront(obj);
            }
          });
          console.log('Brought all design objects to front');
        } else {
          console.log('No objects in canvas data');
        }
      }

      canvas.requestRenderAll();
      setIsLoaded(true);

      // Call onCanvasReady callback if provided
      if (onCanvasReady) {
        onCanvasReady(canvas, side.id, scale);
      }
    } catch (err) {
      console.error('Error rendering canvas:', err);
      setError(err instanceof Error ? err.message : 'Failed to render canvas');
      setIsLoaded(true);
    }
  };

  return (
    <div className="relative inline-block">
      <canvas ref={canvasEl} />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-sm text-gray-600">Loading...</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50">
          <div className="text-sm text-red-600">Error: {error}</div>
        </div>
      )}
      <div className="mt-2 text-center text-sm text-gray-600">{side.name}</div>
    </div>
  );
};

// ============================================================================
// MAIN ORDER CANVAS RENDERER COMPONENT
// ============================================================================

interface OrderCanvasRendererProps {
  orderId?: string;
  orderItemId?: string;
  orderItems?: OrderItem[];
  canvasWidth?: number;
  canvasHeight?: number;
  layout?: 'grid' | 'horizontal' | 'vertical';
  showItemInfo?: boolean;
}

const OrderCanvasRenderer: React.FC<OrderCanvasRendererProps> = ({
  orderId,
  orderItemId,
  orderItems: providedOrderItems,
  canvasWidth = 500,
  canvasHeight = 500,
  layout = 'grid',
  showItemInfo = true,
}) => {
  const [orderItems, setOrderItems] = useState<OrderItem[]>(providedOrderItems || []);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(!providedOrderItems);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (providedOrderItems) {
      loadProducts(providedOrderItems);
    } else if (orderId || orderItemId) {
      fetchOrderItems();
    }
  }, [orderId, orderItemId, providedOrderItems]);

  const fetchOrderItems = async () => {
    try {
      setLoading(true);
      const supabase = createSupabaseClient();

      let query = supabase.from('order_items').select('*');

      if (orderItemId) {
        query = query.eq('id', orderItemId);
      } else if (orderId) {
        query = query.eq('order_id', orderId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        throw new Error('No order items found');
      }

      setOrderItems(data as OrderItem[]);
      await loadProducts(data as OrderItem[]);
    } catch (err) {
      console.error('Error fetching order items:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch order items');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (items: OrderItem[]) => {
    try {
      const supabase = createSupabaseClient();
      const productIds = [...new Set(items.map((item) => item.product_id))];

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, title, configuration')
        .in('id', productIds);

      if (productsError) throw productsError;

      const productsMap: Record<string, Product> = {};
      (productsData || []).forEach((product) => {
        productsMap[product.id] = product as Product;
      });

      setProducts(productsMap);
    } catch (err) {
      console.error('Error loading products:', err);
      setError(err instanceof Error ? err.message : 'Failed to load products');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-gray-900"></div>
          <div className="text-sm text-gray-600">Loading order items...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="text-sm text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (orderItems.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm text-gray-600">No order items to display</div>
      </div>
    );
  }

  const getLayoutClass = () => {
    switch (layout) {
      case 'horizontal':
        return 'flex flex-row flex-wrap gap-6';
      case 'vertical':
        return 'flex flex-col gap-6';
      case 'grid':
      default:
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
    }
  };

  return (
    <div className="w-full">
      <div className={getLayoutClass()}>
        {orderItems.map((item) => {
          const product = products[item.product_id];

          if (!product || !product.configuration) {
            return (
              <div
                key={item.id}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <div className="text-sm text-gray-600">
                  Product configuration not found
                </div>
              </div>
            );
          }

          const canvasState = item.canvas_state as Record<string, string>;
          const productColor = item.item_options?.color_hex || '#FFFFFF';

          return (
            <div
              key={item.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              {showItemInfo && (
                <div className="mb-4 border-b border-gray-200 pb-4">
                  <h3 className="font-semibold text-gray-900">
                    {item.product_title}
                  </h3>
                  {item.item_options?.size_name && (
                    <div className="mt-1 text-sm text-gray-600">
                      Size: {item.item_options.size_name}
                    </div>
                  )}
                  {item.item_options?.color_name && (
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                      <span>Color: {item.item_options.color_name}</span>
                      <div
                        className="h-4 w-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: productColor }}
                      />
                    </div>
                  )}
                  <div className="mt-1 text-sm text-gray-600">
                    Quantity: {item.quantity}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4">
                {product.configuration.map((side) => {
                  const sideCanvasState = canvasState[side.id];

                  // Only render sides that have canvas state
                  if (!sideCanvasState) return null;

                  return (
                    <SingleCanvasRenderer
                      key={side.id}
                      side={side}
                      canvasState={sideCanvasState}
                      productColor={productColor}
                      width={canvasWidth}
                      height={canvasHeight}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default OrderCanvasRenderer;
export { SingleCanvasRenderer };
export type {
  OrderCanvasRendererProps,
  SingleCanvasRendererProps,
  OrderItem,
  Product,
  ProductSide,
};