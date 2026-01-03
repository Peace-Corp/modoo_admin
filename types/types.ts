export interface Product {
  id: string;
  title: string;
  base_price: number;
  configuration: ProductSide[];
  size_options: SizeOption[] | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

export type PrintMethod = 'printing' | 'embroidery';

export interface SizeOption {
  id: string;
  name: string;
  label: string;
}

export interface Order {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;

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
  assigned_factory_id: string | null;
  total_amount: number;

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
    variants?: Array<{
      size_id?: string;
      size_name?: string;
      color_id?: string;
      color_name?: string;
      color_hex?: string;
      quantity?: number;
    }>;
  };
  thumbnail_url: string | null;

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
}

export interface Profile {
  id: string;
  email: string;
  phone_number: string | null;
  role: 'customer' | 'admin' | 'factory';
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

export type CoBuyStatus = 'open' | 'closed' | 'cancelled' | 'finalized';

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
