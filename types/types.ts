export interface Product {
  id: string;
  title: string;
  base_price: number;
  configuration: ProductSide[];
  size_options: SizeOption[] | null;
  category: string | null;
  thumbnail_image_link?: string | null;
  description_image?: string | null;
  sizing_chart_image?: string | null;
  product_code?: string | null;
  discount_rates?: Array<{ min_quantity: number; discount_rate: number }> | null;
  manufacturer_id?: string | null;
  manufacturers?: { id: string; name: string } | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ManufacturerColor {
  id: string;
  manufacturer_id: string;
  name: string;
  hex: string;
  color_code: string;
  label: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProductColor {
  id: string;
  product_id: string;
  manufacturer_color_id: string;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
  manufacturer_colors?: ManufacturerColor;
}

export interface ProductConfig {
  id?: string;
  title?: string;
  base_price?: number;
  sides: ProductSide[];
}

export interface ProductSide {
  id: string;
  name: string;
  imageUrl: string;
  printArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  layers?: ProductLayer[];
  realLifeDimensions?: {
    printAreaWidthMm: number;
    printAreaHeightMm: number;
    productWidthMm: number;
  };
  zoomScale?: number;
}

export interface ProductLayer {
  id: string;
  name: string;
  imageUrl: string;
  colorOptions: Array<{
    hex: string;
    colorCode: string;
  }>;
  zIndex: number;
}

// Print method types - includes transfer methods and bulk methods
export type PrintMethod = 'dtf' | 'dtg' | 'screen_printing' | 'embroidery' | 'applique';

// Size categories for printing
export type PrintSize = '10x10' | 'A4' | 'A3';

// Pricing configuration for transfer methods (DTF, DTG)
export interface TransferPricing {
  method: 'dtf' | 'dtg';
  sizes: {
    '10x10': number;
    A4: number;
    A3: number;
  };
}

// Pricing configuration for bulk methods (screen printing, embroidery, applique)
export interface BulkPricing {
  method: 'screen_printing' | 'embroidery' | 'applique';
  sizes: {
    '10x10': {
      basePrice: number;
      baseQuantity: number;
      additionalPricePerPiece: number;
    };
    A4: {
      basePrice: number;
      baseQuantity: number;
      additionalPricePerPiece: number;
    };
    A3: {
      basePrice: number;
      baseQuantity: number;
      additionalPricePerPiece: number;
    };
  };
}

// Full print pricing configuration
export interface PrintPricingConfig {
  dtf: TransferPricing;
  dtg: TransferPricing;
  screen_printing: BulkPricing;
  embroidery: BulkPricing;
  applique: BulkPricing;
}

export interface CustomFont {
  fontFamily: string;
  fileName: string;
  url: string;
  path?: string;
  uploadedAt?: string;
  format?: string;
}

// Size option is now just a simple string (e.g., "S", "M", "L", "XL")
export type SizeOption = string;

export interface Order {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;

  order_category?: 'cobuy' | 'regular' | null;
  cobuy_session_id?: string | null;

  shipping_method: 'domestic' | 'international' | 'pickup';
  country_code: string | null;
  state: string | null;
  city: string | null;
  postal_code: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  delivery_fee: number;

  payment_method: 'toss' | 'paypal' | 'card';
  payment_key: string | null;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';

  order_status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  assigned_manufacturer_id: string | null;
  total_amount: number;

  // Factory-specific fields (set by admin)
  deadline: string | null;
  factory_amount: number | null;
  factory_payment_date: string | null;
  factory_payment_status: 'pending' | 'completed' | 'cancelled' | null;

  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  design_id: string | null;
  product_title: string;
  quantity: number;
  price_per_item: number;

  canvas_state: Record<string, CanvasState>;
  color_selections: Record<string, any>;
  item_options: {
    size_id?: string;
    size_name?: string;
    color_id?: string;
    color_name?: string;
    color_hex?: string;
    color_code?: string;
    variants?: Array<{
      size_id?: string;
      size_name?: string;
      color_id?: string;
      color_name?: string;
      color_hex?: string;
      color_code?: string;
      quantity?: number;
    }>;
  };
  thumbnail_url: string | null;

  // Order file downloads (JSONB)
  image_urls?: Record<string, Array<{ url: string; path?: string; uploadedAt?: string }>> | string | null;
  text_svg_exports?: Record<string, unknown> | string | null;

  // Custom fonts used in the design
  custom_fonts?: CustomFont[] | string | null;

  // Joined from products table
  products?: { product_code: string | null } | null;

  created_at: string;
  updated_at: string;
}

export interface CanvasState {
  version?: string;
  objects: CanvasObject[];
  background?: string;
  backgroundImage?: any;
  productColor?: string;
  layerColors?: Record<string, unknown>;
}

export interface CanvasObject {
  type: string;
  left: number;
  top: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;

  // Text specific
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;

  // Image specific
  src?: string;

  // Additional properties
  [key: string]: any;
}

export interface ExtractedColor {
  hex: string;
  name?: string;
  count?: number;
}

export interface ObjectDimensions {
  objectId?: string;
  sideId?: string;
  rawType?: string;
  objectType: string;
  widthMm: number;
  heightMm: number;
  fill?: string;
  text?: string;
  colors?: string[];
  preview?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontStyle?: string;
  textAlign?: string;
  lineHeight?: number;
  // CurvedText specific
  curveIntensity?: number;
}

export interface Profile {
  id: string;
  email: string;
  phone_number: string | null;
  role: 'customer' | 'admin' | 'factory';
  manufacturer_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Factory {
  id: string;
  name: string;
  email: string | null;
  phone_number: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  user_id: string | null;
  rating: number;
  title: string;
  content: string;
  author_name: string;
  is_verified_purchase: boolean | null;
  helpful_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionExample {
  id: string;
  product_id: string;
  title: string;
  description: string;
  image_url: string;
  sort_order: number;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Inquiry {
  id: string;
  user_id: string | null;
  title: string;
  content: string;
  status: 'pending' | 'ongoing' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface InquiryProduct {
  id: string;
  inquiry_id: string;
  product_id: string;
  created_at: string;
}

export interface InquiryReply {
  id: string;
  inquiry_id: string;
  admin_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export type CoBuyStatus = 'open' | 'closed' | 'cancelled' | 'finalized' | 'gathering' | 'gather_complete' | 'order_complete' | 'manufacturing' | 'manufacture_complete' | 'delivering' | 'delivery_complete';

// Pricing tier for quantity-based discounts
export interface CoBuyPricingTier {
  minQuantity: number;
  pricePerItem: number;
}

// Delivery settings for cobuy sessions
export interface CoBuyDeliverySettings {
  deliveryAddress?: {
    address: string;
    addressDetail?: string;
    postalCode?: string;
  };
  pickupAddress?: {
    address: string;
    addressDetail?: string;
    postalCode?: string;
  };
  enableIndividualDelivery?: boolean;
  deliveryFee?: number;
}

export interface CoBuyCustomField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'dropdown';
  label: string;
  required: boolean;
  fixed?: boolean;
  options?: string[];
}

export interface CoBuySession {
  id: string;
  user_id: string;
  saved_design_id: string;
  title: string;
  description: string | null;
  status: CoBuyStatus;
  share_token: string;
  start_date: string;
  end_date: string;
  max_participants: number | null;
  current_participant_count: number;
  custom_fields: CoBuyCustomField[];
  bulk_order_id: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    email: string | null;
    phone_number?: string | null;
  } | null;
  cancellation_requested_at?: string | null;
}

export interface CoBuyParticipant {
  id: string;
  cobuy_session_id: string;
  name: string;
  email: string;
  phone: string | null;
  field_responses: Record<string, string>;
  selected_size: string;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_key: string | null;
  payment_amount: number | null;
  paid_at: string | null;
  joined_at: string;
}

export interface DesignTemplate {
  id: string;
  product_id: string;
  title: string;
  description: string | null;
  canvas_state: Record<string, CanvasState | string>;
  preview_url: string | null;
  layer_colors: Record<string, string> | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface SavedDesign {
  id: string;
  user_id: string;
  product_id: string;
  title: string | null;
  color_selections: Record<string, Record<string, string>>;
  canvas_state: Record<string, CanvasState | string>;
  preview_url: string | null;
  price_per_item: number;
  image_urls: Record<string, Array<{ url: string; path?: string; uploadedAt?: string }>> | null;
  text_svg_exports: Record<string, string> | null;
  custom_fonts: CustomFont[] | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  user?: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  product?: {
    id: string;
    title: string;
    thumbnail_image_link: string | null;
  } | null;
}
