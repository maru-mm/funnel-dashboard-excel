export type TemplateType = 
  | 'advertorial' 
  | 'checkout' 
  | 'oto_1' 
  | 'oto_2' 
  | 'upsell' 
  | 'downsell';

// Built-in page types
export type BuiltInPageType = 
  // Pre-sell / Top of Funnel
  | 'advertorial'
  | 'listicle'
  | '5_reasons_listicle'
  | 'native_ad'
  | 'vsl'
  | 'webinar'
  | 'bridge_page'
  // Landing & Opt-in
  | 'landing'
  | 'opt_in'
  | 'squeeze_page'
  | 'lead_magnet'
  // Quiz & Survey
  | 'quiz_funnel'
  | 'survey'
  | 'assessment'
  // Sales Pages
  | 'sales_letter'
  | 'product_page'
  | 'offer_page'
  | 'checkout'
  // Post-Purchase
  | 'thank_you'
  | 'upsell'
  | 'downsell'
  | 'oto'
  | 'order_confirmation'
  | 'membership'
  // Content Pages
  | 'blog'
  | 'article'
  | 'content_page'
  | 'review'
  // Compliance & Safe
  | 'safe_page'
  | 'privacy'
  | 'terms'
  | 'disclaimer'
  // Other
  | 'altro';

// PageType can be a built-in type OR a custom string
export type PageType = BuiltInPageType | string;

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

export type TemplateCategory = 'standard' | 'quiz';

export type TemplateViewFormat = 'desktop' | 'mobile';

export interface SwipeTemplate {
  id: string;
  name: string;
  sourceUrl: string;
  pageType: PageType;
  category: TemplateCategory;
  viewFormat: TemplateViewFormat;
  tags: string[];
  description?: string;
  previewImage?: string;
  createdAt: Date;
}

export const TEMPLATE_VIEW_FORMAT_OPTIONS: { value: TemplateViewFormat; label: string; icon: string }[] = [
  { value: 'desktop', label: 'Desktop', icon: '🖥️' },
  { value: 'mobile', label: 'Mobile', icon: '📱' },
];

export const TEMPLATE_CATEGORY_OPTIONS: { value: TemplateCategory; label: string; description: string }[] = [
  { value: 'standard', label: 'Template Standard', description: 'Landing page, advertorial, checkout, ecc.' },
  { value: 'quiz', label: 'Quiz Template', description: 'Quiz funnel, survey, lead magnet interattivi' },
];

export type QuizAnalysisStatus = 'pending' | 'analyzing' | 'completed' | 'failed';

export interface QuizAnalysisResult {
  totalQuestions: number;
  questionTypes: string[];
  flowStructure: string;
  resultsLogic: string;
  designPatterns: string[];
  ctaElements: string[];
  engagementTechniques: string[];
  recommendations: string[];
  rawAnalysis: string;
  analyzedAt: Date;
}

export interface QuizTemplate {
  id: string;
  name: string;
  sourceUrl: string;
  description?: string;
  tags: string[];
  analysisStatus: QuizAnalysisStatus;
  analysisResult?: QuizAnalysisResult;
  createdAt: Date;
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
  templateId?: string; // Reference to SwipeTemplate
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

// Custom page type created by user
export interface CustomPageType {
  id: string;
  value: string;
  label: string;
  category: 'custom';
  createdAt: Date;
}

// Page type option with category grouping
export interface PageTypeOption {
  value: PageType;
  label: string;
  category: 'presell' | 'landing' | 'quiz' | 'sales' | 'postpurchase' | 'content' | 'compliance' | 'other' | 'custom';
}

// Built-in page type options organized by category
export const BUILT_IN_PAGE_TYPE_OPTIONS: PageTypeOption[] = [
  // Pre-sell / Top of Funnel
  { value: 'advertorial', label: 'Advertorial', category: 'presell' },
  { value: 'listicle', label: 'Listicle', category: 'presell' },
  { value: '5_reasons_listicle', label: '5 Reasons Why Listicle', category: 'presell' },
  { value: 'native_ad', label: 'Native Ad', category: 'presell' },
  { value: 'vsl', label: 'VSL (Video Sales Letter)', category: 'presell' },
  { value: 'webinar', label: 'Webinar Page', category: 'presell' },
  { value: 'bridge_page', label: 'Bridge Page', category: 'presell' },
  // Landing & Opt-in
  { value: 'landing', label: 'Landing Page', category: 'landing' },
  { value: 'opt_in', label: 'Opt-in Page', category: 'landing' },
  { value: 'squeeze_page', label: 'Squeeze Page', category: 'landing' },
  { value: 'lead_magnet', label: 'Lead Magnet Page', category: 'landing' },
  // Quiz & Survey
  { value: 'quiz_funnel', label: 'Quiz Funnel', category: 'quiz' },
  { value: 'survey', label: 'Survey Page', category: 'quiz' },
  { value: 'assessment', label: 'Assessment', category: 'quiz' },
  // Sales Pages
  { value: 'sales_letter', label: 'Sales Letter', category: 'sales' },
  { value: 'product_page', label: 'Product Page', category: 'sales' },
  { value: 'offer_page', label: 'Offer Page', category: 'sales' },
  { value: 'checkout', label: 'Checkout', category: 'sales' },
  // Post-Purchase
  { value: 'thank_you', label: 'Thank You Page', category: 'postpurchase' },
  { value: 'upsell', label: 'Upsell Page', category: 'postpurchase' },
  { value: 'downsell', label: 'Downsell Page', category: 'postpurchase' },
  { value: 'oto', label: 'OTO (One Time Offer)', category: 'postpurchase' },
  { value: 'order_confirmation', label: 'Order Confirmation', category: 'postpurchase' },
  { value: 'membership', label: 'Membership Page', category: 'postpurchase' },
  // Content Pages
  { value: 'blog', label: 'Blog Post', category: 'content' },
  { value: 'article', label: 'Article', category: 'content' },
  { value: 'content_page', label: 'Content Page', category: 'content' },
  { value: 'review', label: 'Review Page', category: 'content' },
  // Compliance & Safe
  { value: 'safe_page', label: 'Safe Page', category: 'compliance' },
  { value: 'privacy', label: 'Privacy Policy', category: 'compliance' },
  { value: 'terms', label: 'Terms & Conditions', category: 'compliance' },
  { value: 'disclaimer', label: 'Disclaimer', category: 'compliance' },
  // Other
  { value: 'altro', label: 'Altro', category: 'other' },
];

// Category labels for grouping in UI
export const PAGE_TYPE_CATEGORIES: { value: PageTypeOption['category']; label: string; color: string }[] = [
  { value: 'presell', label: 'Pre-Sell / Top of Funnel', color: 'bg-orange-100 text-orange-800' },
  { value: 'landing', label: 'Landing & Opt-in', color: 'bg-blue-100 text-blue-800' },
  { value: 'quiz', label: 'Quiz & Survey', color: 'bg-purple-100 text-purple-800' },
  { value: 'sales', label: 'Sales Pages', color: 'bg-green-100 text-green-800' },
  { value: 'postpurchase', label: 'Post-Purchase', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'content', label: 'Content Pages', color: 'bg-gray-100 text-gray-800' },
  { value: 'compliance', label: 'Compliance & Safe', color: 'bg-red-100 text-red-800' },
  { value: 'other', label: 'Altro', color: 'bg-gray-100 text-gray-600' },
  { value: 'custom', label: 'Categorie Personalizzate', color: 'bg-indigo-100 text-indigo-800' },
];

// Legacy simple format for backward compatibility
export const PAGE_TYPE_OPTIONS: { value: PageType; label: string }[] = BUILT_IN_PAGE_TYPE_OPTIONS.map(opt => ({
  value: opt.value,
  label: opt.label,
}));

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

// =====================================================
// VISION ANALYSIS TYPES
// =====================================================

export interface VisionSection {
  section_index: number;
  section_type_hint: string;
  confidence: number;
  text_preview: string;
  has_cta: boolean;
  bounding_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface VisionImage {
  image_type: string;
  description: string;
  suggestion: string;
  src?: string;
  alt?: string;
}

export interface VisionJobSummary {
  id: string;
  source_url: string;
  screenshot_url?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_sections_detected: number;
  created_at: string;
  completed_at?: string;
  error?: string;
}

export interface VisionJobDetail extends VisionJobSummary {
  sections: VisionSection[];
  images: VisionImage[];
  page_structure?: {
    has_hero: boolean;
    has_testimonials: boolean;
    has_pricing: boolean;
    has_faq: boolean;
    has_footer: boolean;
    estimated_scroll_depth: number;
  };
  recommendations?: string[];
  raw_analysis?: string;
}

export const SECTION_TYPE_COLORS: Record<string, string> = {
  hero: 'bg-purple-100 text-purple-800 border-purple-300',
  features: 'bg-blue-100 text-blue-800 border-blue-300',
  benefits: 'bg-green-100 text-green-800 border-green-300',
  testimonials: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  pricing: 'bg-orange-100 text-orange-800 border-orange-300',
  cta: 'bg-red-100 text-red-800 border-red-300',
  faq: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  footer: 'bg-gray-100 text-gray-800 border-gray-300',
  header: 'bg-teal-100 text-teal-800 border-teal-300',
  social_proof: 'bg-pink-100 text-pink-800 border-pink-300',
  unknown: 'bg-gray-100 text-gray-600 border-gray-300',
};
