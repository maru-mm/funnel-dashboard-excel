export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PageType = 
  | '5_reasons_listicle' 
  | 'quiz_funnel' 
  | 'landing' 
  | 'product_page' 
  | 'safe_page' 
  | 'checkout'
  | 'advertorial'
  | 'altro';

export type SwipeStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export type PostPurchaseType = 'thank_you' | 'upsell_1' | 'upsell_2' | 'downsell' | 'order_confirmation';

export type ViewFormat = 'desktop' | 'mobile';

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          name: string;
          description: string;
          price: number;
          image_url: string | null;
          benefits: string[];
          cta_text: string;
          cta_url: string;
          brand_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          price: number;
          image_url?: string | null;
          benefits: string[];
          cta_text: string;
          cta_url: string;
          brand_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          price?: number;
          image_url?: string | null;
          benefits?: string[];
          cta_text?: string;
          cta_url?: string;
          brand_name?: string;
          updated_at?: string;
        };
      };
      swipe_templates: {
        Row: {
          id: string;
          name: string;
          source_url: string;
          page_type: PageType;
          view_format: ViewFormat;
          tags: string[];
          description: string | null;
          preview_image: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          source_url: string;
          page_type: PageType;
          view_format?: ViewFormat;
          tags?: string[];
          description?: string | null;
          preview_image?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          source_url?: string;
          page_type?: PageType;
          view_format?: ViewFormat;
          tags?: string[];
          description?: string | null;
          preview_image?: string | null;
          updated_at?: string;
        };
      };
      funnel_pages: {
        Row: {
          id: string;
          name: string;
          page_type: PageType;
          template_id: string | null;
          product_id: string;
          url_to_swipe: string;
          swipe_status: SwipeStatus;
          swipe_result: string | null;
          cloned_data: Json | null;
          swiped_data: Json | null;
          analysis_status: SwipeStatus | null;
          analysis_result: string | null;
          extracted_data: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          page_type: PageType;
          template_id?: string | null;
          product_id: string;
          url_to_swipe: string;
          swipe_status?: SwipeStatus;
          swipe_result?: string | null;
          cloned_data?: Json | null;
          swiped_data?: Json | null;
          analysis_status?: SwipeStatus | null;
          analysis_result?: string | null;
          extracted_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          page_type?: PageType;
          template_id?: string | null;
          product_id?: string;
          url_to_swipe?: string;
          swipe_status?: SwipeStatus;
          swipe_result?: string | null;
          cloned_data?: Json | null;
          swiped_data?: Json | null;
          analysis_status?: SwipeStatus | null;
          analysis_result?: string | null;
          extracted_data?: Json | null;
          updated_at?: string;
        };
      };
      post_purchase_pages: {
        Row: {
          id: string;
          name: string;
          type: PostPurchaseType;
          product_id: string;
          url_to_swipe: string;
          swipe_status: SwipeStatus;
          swipe_result: string | null;
          cloned_data: Json | null;
          swiped_data: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: PostPurchaseType;
          product_id: string;
          url_to_swipe: string;
          swipe_status?: SwipeStatus;
          swipe_result?: string | null;
          cloned_data?: Json | null;
          swiped_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: PostPurchaseType;
          product_id?: string;
          url_to_swipe?: string;
          swipe_status?: SwipeStatus;
          swipe_result?: string | null;
          cloned_data?: Json | null;
          swiped_data?: Json | null;
          updated_at?: string;
        };
      };
    };
  };
}

// Helper types for easier usage
export type Product = Database['public']['Tables']['products']['Row'];
export type ProductInsert = Database['public']['Tables']['products']['Insert'];
export type ProductUpdate = Database['public']['Tables']['products']['Update'];

export type SwipeTemplate = Database['public']['Tables']['swipe_templates']['Row'];
export type SwipeTemplateInsert = Database['public']['Tables']['swipe_templates']['Insert'];
export type SwipeTemplateUpdate = Database['public']['Tables']['swipe_templates']['Update'];

export type FunnelPage = Database['public']['Tables']['funnel_pages']['Row'];
export type FunnelPageInsert = Database['public']['Tables']['funnel_pages']['Insert'];
export type FunnelPageUpdate = Database['public']['Tables']['funnel_pages']['Update'];

export type PostPurchasePage = Database['public']['Tables']['post_purchase_pages']['Row'];
export type PostPurchasePageInsert = Database['public']['Tables']['post_purchase_pages']['Insert'];
export type PostPurchasePageUpdate = Database['public']['Tables']['post_purchase_pages']['Update'];
