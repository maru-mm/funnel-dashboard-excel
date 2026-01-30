export type TemplateType = 
  | 'advertorial' 
  | 'checkout' 
  | 'oto_1' 
  | 'oto_2' 
  | 'upsell' 
  | 'downsell';

export type PageType = 
  | '5_reasons_listicle' 
  | 'quiz_funnel' 
  | 'landing' 
  | 'product_page' 
  | 'safe_page' 
  | 'checkout';

export type SwipeStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'completed' 
  | 'failed';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  benefits: string[];
  ctaText: string;
  ctaUrl: string;
  brandName: string;
  createdAt: Date;
}

export interface SwipeApiResponse {
  success: boolean;
  original_url: string;
  original_title: string;
  new_title: string;
  html: string;
  changes_made: string[];
  original_length: number;
  new_length: number;
  processing_time_seconds: number;
  method_used: string;
  error: string | null;
  warnings: string[];
}

export interface SwipedPageData {
  html: string;
  originalTitle: string;
  newTitle: string;
  originalLength: number;
  newLength: number;
  processingTime: number;
  methodUsed: string;
  changesMade: string[];
  swipedAt: Date;
}

export interface FunnelAnalysis {
  headline: string;
  subheadline: string;
  cta: string[];
  price: string | null;
  benefits: string[];
}

export interface ClonedPageData {
  html: string;
  title: string;
  method_used: string;
  content_length: number;
  duration_seconds: number;
  cloned_at: Date;
}

export interface FunnelPage {
  id: string;
  name: string;
  pageType: PageType;
  template: TemplateType;
  productId: string;
  urlToSwipe: string;
  swipeStatus: SwipeStatus;
  swipeResult?: string;
  clonedData?: ClonedPageData;
  swipedData?: SwipedPageData;
  analysisStatus?: SwipeStatus;
  analysisResult?: string;
  extractedData?: FunnelAnalysis;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostPurchasePage {
  id: string;
  name: string;
  type: 'thank_you' | 'upsell_1' | 'upsell_2' | 'downsell' | 'order_confirmation';
  productId: string;
  urlToSwipe: string;
  swipeStatus: SwipeStatus;
  swipeResult?: string;
  clonedData?: ClonedPageData;
  swipedData?: SwipedPageData;
  createdAt: Date;
  updatedAt: Date;
}

export const TEMPLATE_OPTIONS: { value: TemplateType; label: string }[] = [
  { value: 'advertorial', label: 'Advertorial' },
  { value: 'checkout', label: 'Checkout' },
  { value: 'oto_1', label: 'OTO 1' },
  { value: 'oto_2', label: 'OTO 2' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'downsell', label: 'Downsell' },
];

export const PAGE_TYPE_OPTIONS: { value: PageType; label: string }[] = [
  { value: '5_reasons_listicle', label: '5 Reasons Why Listicle' },
  { value: 'quiz_funnel', label: 'Quiz Funnel' },
  { value: 'landing', label: 'Landing Page' },
  { value: 'product_page', label: 'Product Page' },
  { value: 'safe_page', label: 'Safe Page' },
  { value: 'checkout', label: 'Checkout' },
];

export const POST_PURCHASE_TYPE_OPTIONS: { value: PostPurchasePage['type']; label: string }[] = [
  { value: 'thank_you', label: 'Thank You Page' },
  { value: 'upsell_1', label: 'Upsell 1' },
  { value: 'upsell_2', label: 'Upsell 2' },
  { value: 'downsell', label: 'Downsell' },
  { value: 'order_confirmation', label: 'Order Confirmation' },
];

export const STATUS_OPTIONS: { value: SwipeStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-200 text-gray-800' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-200 text-yellow-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-200 text-green-800' },
  { value: 'failed', label: 'Failed', color: 'bg-red-200 text-red-800' },
];
