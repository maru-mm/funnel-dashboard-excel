import { supabase } from './supabase';
import type {
  Product,
  ProductInsert,
  ProductUpdate,
  SwipeTemplate,
  SwipeTemplateInsert,
  SwipeTemplateUpdate,
  FunnelPage,
  FunnelPageInsert,
  FunnelPageUpdate,
  PostPurchasePage,
  PostPurchasePageInsert,
  PostPurchasePageUpdate,
  FunnelCrawlStepRow,
  FunnelCrawlStepInsert,
} from '@/types/database';

// =====================================================
// PRODUCTS OPERATIONS
// =====================================================

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
  return data || [];
}

export async function createProduct(product: ProductInsert): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating product:', error);
    throw error;
  }
  return data;
}

export async function updateProduct(id: string, updates: ProductUpdate): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating product:', error);
    throw error;
  }
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}

// =====================================================
// SWIPE TEMPLATES OPERATIONS
// =====================================================

export async function fetchTemplates(): Promise<SwipeTemplate[]> {
  const { data, error } = await supabase
    .from('swipe_templates')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching templates:', error);
    throw error;
  }
  return data || [];
}

export async function createTemplate(template: SwipeTemplateInsert): Promise<SwipeTemplate> {
  const { data, error } = await supabase
    .from('swipe_templates')
    .insert(template)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating template:', error);
    throw error;
  }
  return data;
}

export async function updateTemplate(id: string, updates: SwipeTemplateUpdate): Promise<SwipeTemplate> {
  const { data, error } = await supabase
    .from('swipe_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating template:', error);
    throw error;
  }
  return data;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('swipe_templates')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
}

// =====================================================
// FUNNEL PAGES OPERATIONS
// =====================================================

export async function fetchFunnelPages(): Promise<FunnelPage[]> {
  const { data, error } = await supabase
    .from('funnel_pages')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching funnel pages:', error);
    throw error;
  }
  return data || [];
}

export async function createFunnelPage(page: FunnelPageInsert): Promise<FunnelPage> {
  const { data, error } = await supabase
    .from('funnel_pages')
    .insert(page)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating funnel page:', error);
    throw error;
  }
  return data;
}

export async function updateFunnelPage(id: string, updates: FunnelPageUpdate): Promise<FunnelPage> {
  const { data, error } = await supabase
    .from('funnel_pages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating funnel page:', error);
    throw error;
  }
  return data;
}

export async function deleteFunnelPage(id: string): Promise<void> {
  const { error } = await supabase
    .from('funnel_pages')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting funnel page:', error);
    throw error;
  }
}

// =====================================================
// POST PURCHASE PAGES OPERATIONS
// =====================================================

export async function fetchPostPurchasePages(): Promise<PostPurchasePage[]> {
  const { data, error } = await supabase
    .from('post_purchase_pages')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching post purchase pages:', error);
    throw error;
  }
  return data || [];
}

export async function createPostPurchasePage(page: PostPurchasePageInsert): Promise<PostPurchasePage> {
  const { data, error } = await supabase
    .from('post_purchase_pages')
    .insert(page)
    .select()
    .single();
  
  if (error) {
    console.error('Error creating post purchase page:', error);
    throw error;
  }
  return data;
}

export async function updatePostPurchasePage(id: string, updates: PostPurchasePageUpdate): Promise<PostPurchasePage> {
  const { data, error } = await supabase
    .from('post_purchase_pages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating post purchase page:', error);
    throw error;
  }
  return data;
}

export async function deletePostPurchasePage(id: string): Promise<void> {
  const { error } = await supabase
    .from('post_purchase_pages')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting post purchase page:', error);
    throw error;
  }
}

// =====================================================
// FUNNEL CRAWL STEPS (Funnel Analyzer - salvataggio step)
// =====================================================

export async function createFunnelCrawlSteps(
  entryUrl: string,
  funnelName: string,
  funnelTag: string | null,
  steps: Array<{
    stepIndex: number;
    url: string;
    title: string;
    links: unknown;
    ctaButtons: unknown;
    forms: unknown;
    networkRequests: unknown;
    cookies: unknown;
    domLength: number;
    redirectFrom?: string;
    timestamp: string;
    screenshotBase64?: string;
  }>
): Promise<{ count: number; ids: string[] }> {
  const rows: FunnelCrawlStepInsert[] = steps.map((s) => ({
    funnel_name: funnelName.trim() || 'Senza nome',
    funnel_tag: funnelTag?.trim() || null,
    entry_url: entryUrl,
    step_index: s.stepIndex,
    url: s.url,
    title: s.title || '',
    step_data: {
      links: s.links,
      ctaButtons: s.ctaButtons,
      forms: s.forms,
      networkRequests: s.networkRequests,
      cookies: s.cookies,
      domLength: s.domLength,
      redirectFrom: s.redirectFrom,
      timestamp: s.timestamp,
    },
    screenshot_base64: s.screenshotBase64 ?? null,
  }));

  const { data, error } = await supabase
    .from('funnel_crawl_steps')
    .insert(rows)
    .select('id');

  if (error) {
    console.error('Error creating funnel crawl steps:', error);
    throw error;
  }
  return { count: data?.length ?? 0, ids: (data ?? []).map((r) => r.id) };
}

export async function fetchFunnelCrawlSteps(): Promise<FunnelCrawlStepRow[]> {
  const { data, error } = await supabase
    .from('funnel_crawl_steps')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching funnel crawl steps:', error);
    throw error;
  }
  return data ?? [];
}

export async function fetchFunnelCrawlStepsByFunnel(
  entryUrl: string,
  funnelName: string
): Promise<FunnelCrawlStepRow[]> {
  const { data, error } = await supabase
    .from('funnel_crawl_steps')
    .select('*')
    .eq('entry_url', entryUrl)
    .eq('funnel_name', funnelName)
    .order('step_index', { ascending: true });
  if (error) {
    console.error('Error fetching funnel crawl steps by funnel:', error);
    throw error;
  }
  return data ?? [];
}

export async function deleteFunnelCrawlStepsByFunnel(entryUrl: string, funnelName: string): Promise<void> {
  const { error } = await supabase
    .from('funnel_crawl_steps')
    .delete()
    .eq('entry_url', entryUrl)
    .eq('funnel_name', funnelName);
  if (error) {
    console.error('Error deleting funnel crawl steps:', error);
    throw error;
  }
}
