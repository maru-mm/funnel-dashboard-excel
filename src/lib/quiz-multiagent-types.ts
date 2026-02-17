/**
 * Multi-Agent Quiz Analysis Types
 *
 * The system uses 4 specialized Gemini agents running in parallel,
 * followed by a synthesis step that produces a MasterSpec.
 * Claude then uses the MasterSpec + cloned HTML to transform the quiz.
 */

// =====================================================
// AGENT 1: Visual Design Architect — Pixel-perfect CSS specs
// =====================================================

export interface PixelColorUsage {
  hex: string;
  usage: string;
}

export interface PixelTypography {
  font_family: string;
  font_size: string;
  font_weight: string;
  line_height: string;
  letter_spacing: string;
  color: string;
  text_transform?: string;
}

export interface PixelBorder {
  width: string;
  style: string;
  color: string;
  radius: string;
}

export interface VisualDesignSpec {
  colors: {
    primary: PixelColorUsage;
    secondary: PixelColorUsage;
    accent: PixelColorUsage;
    background_page: string;
    background_card: string;
    text_heading: string;
    text_body: string;
    text_muted: string;
    button_primary_bg: string;
    button_primary_text: string;
    button_primary_hover_bg: string;
    border_default: string;
    border_selected: string;
    progress_fill: string;
    progress_track: string;
    shadow_color: string;
    success: string;
    error: string;
  };
  gradients: Array<{ css: string; usage: string }>;
  typography: {
    heading_h1: PixelTypography;
    heading_h2: PixelTypography;
    heading_h3: PixelTypography;
    body: PixelTypography;
    small: PixelTypography;
    button_text: PixelTypography;
    option_text: PixelTypography;
    label: PixelTypography;
  };
  spacing: {
    page_padding_x: string;
    page_padding_y: string;
    section_gap: string;
    card_padding: string;
    card_padding_mobile: string;
    between_options: string;
    button_padding: string;
    heading_to_subheading: string;
    subheading_to_body: string;
    body_to_cta: string;
    progress_bar_margin: string;
  };
  dimensions: {
    container_max_width: string;
    card_min_height: string;
    button_height: string;
    button_min_width: string;
    progress_bar_height: string;
    icon_size: string;
    option_icon_size: string;
    logo_height: string;
  };
  borders: {
    card_default: PixelBorder;
    card_selected: PixelBorder;
    card_hover: PixelBorder;
    button_primary: PixelBorder;
    button_secondary: PixelBorder;
    progress_bar: { radius: string };
    input_field: PixelBorder;
  };
  shadows: {
    card_default: string;
    card_hover: string;
    card_selected: string;
    button_default: string;
    button_hover: string;
    container: string;
    modal: string;
  };
  animations: {
    step_enter: { type: string; duration: string; easing: string; translate_y?: string; translate_x?: string };
    step_exit: { type: string; duration: string; easing?: string };
    option_hover: { transform: string; duration: string; shadow_change?: string };
    option_select: { type: string; duration: string; scale?: string };
    progress_fill: { duration: string; easing: string };
    result_reveal: { type: string; duration: string; delay?: string };
    loading_spinner: { type: string; duration: string };
  };
  background_patterns: {
    page_has_pattern: boolean;
    pattern_description: string;
    page_background_css: string;
  };
}

// =====================================================
// AGENT 2: UX Flow & Micro-interactions Analyst
// =====================================================

export interface ScreenDefinition {
  index: number;
  type: 'intro_splash' | 'quiz_question' | 'info_screen' | 'social_proof_interstitial' |
        'loading_screen' | 'lead_capture' | 'result_screen' | 'offer_screen' | 'checkout_redirect' | 'other';
  question_type?: 'single_choice' | 'single_choice_with_images' | 'multi_choice' | 'slider' |
                  'text_input' | 'email_input' | 'number_input' | 'date_input' | 'rating' | 'none';
  options_count?: number;
  options_layout?: 'vertical_list' | 'grid_2col' | 'grid_3col' | 'grid_4col' |
                   'horizontal_scroll' | 'single_row' | 'custom';
  has_progress_bar: boolean;
  progress_format?: string;
  auto_advance_on_select: boolean;
  delay_before_advance_ms?: number;
  has_back_button: boolean;
  has_skip_button: boolean;
  cta_required: boolean;
  cta_text?: string;
  estimated_content_height: string;
  special_elements: string[];
}

export interface UXFlowSpec {
  flow_structure: {
    total_screens: number;
    screen_sequence: ScreenDefinition[];
  };
  transitions: {
    between_questions: { exit_animation: string; enter_animation: string; duration_ms: number; direction?: string };
    to_info_screen: { exit_animation: string; enter_animation: string; duration_ms: number };
    to_result: { exit_animation: string; enter_animation: string; duration_ms: number };
    loading_to_result?: { type: string; duration_ms: number; animation_description: string };
  };
  progress_indicator: {
    type: 'continuous_bar' | 'segmented_bar' | 'step_dots' | 'fraction_text' | 'percentage' | 'none';
    position: 'fixed_top' | 'below_header' | 'inline' | 'bottom' | 'none';
    shows_step_count: boolean;
    label_format: string;
    fill_animation: string;
    color_changes_per_step: boolean;
  };
  interaction_patterns: {
    option_select_behavior: string;
    option_deselect_allowed: boolean;
    multi_select_min?: number;
    multi_select_max?: number;
    back_button: { visible: boolean; position: string; style: string };
    keyboard_navigation: boolean;
    swipe_navigation: boolean;
  };
  responsive_behavior: {
    breakpoint_mobile: string;
    breakpoint_tablet: string;
    mobile_layout_changes: string[];
    touch_optimizations: string[];
  };
  loading_states: {
    has_loading_screen: boolean;
    loading_position: string;
    loading_type: string;
    loading_duration_ms: number;
    loading_messages: string[];
  };
}

// =====================================================
// AGENT 3: CRO & Copy Strategist
// =====================================================

export interface CopyElement {
  text: string;
  technique: string;
  emotional_tone: string;
  word_count: number;
  purpose: string;
}

export interface ScreenCopyAnalysis {
  screen_index: number;
  screen_type: string;
  headline: CopyElement | null;
  subheadline: CopyElement | null;
  body_copy: CopyElement | null;
  cta_elements: Array<{
    text: string;
    technique: string;
    position: string;
    is_primary: boolean;
    color_contrast: string;
  }>;
  social_proof_elements: Array<{
    text: string;
    type: 'user_count' | 'rating' | 'testimonial' | 'expert_endorsement' | 'media_mention' | 'statistic' | 'before_after';
    position: string;
    has_icon: boolean;
  }>;
  urgency_elements: Array<{
    text: string;
    type: 'countdown' | 'limited_stock' | 'limited_time' | 'spots_remaining' | 'price_increase' | 'seasonal';
    is_real_or_fake: string;
  }>;
  trust_signals: Array<{
    text: string;
    type: 'guarantee' | 'authority' | 'certification' | 'secure_payment' | 'free_shipping' | 'reviews_count';
    has_icon: boolean;
  }>;
  option_copy?: Array<{
    label: string;
    subtitle?: string;
    emoji_or_icon?: string;
    persuasion_angle: string;
  }>;
  micro_copy: string[];
}

export interface CROSpec {
  copy_architecture: {
    per_screen: ScreenCopyAnalysis[];
  };
  persuasion_flow: {
    stages: Array<{
      stage_name: string;
      screen_indices: number[];
      goal: string;
      techniques: string[];
    }>;
  };
  psychological_techniques_map: Record<string, string[]>;
  overall_copy_style: {
    formality: 'very_formal' | 'formal' | 'conversational' | 'casual' | 'playful';
    person: 'first_person' | 'second_person' | 'third_person';
    sentence_length: 'short' | 'medium' | 'long';
    power_words_frequency: 'low' | 'medium' | 'high';
    emoji_usage: 'none' | 'minimal' | 'moderate' | 'heavy';
    language: string;
  };
  conversion_elements: {
    primary_value_proposition: string;
    main_objection_handled: string;
    key_emotional_trigger: string;
    scarcity_mechanism: string;
    social_proof_strategy: string;
    risk_reversal: string;
  };
}

// =====================================================
// AGENT 4: Quiz Logic Engineer
// =====================================================

export interface QuizQuestion {
  index: number;
  screen_index: number;
  question_text: string;
  question_type: string;
  options: Array<{
    label: string;
    value: string;
    subtitle?: string;
    icon_description?: string;
    maps_to_categories: string[];
    weight?: number;
  }>;
  auto_advance: boolean;
  required: boolean;
  conditional_display?: {
    depends_on_question: number;
    show_if_answer: string[];
  };
}

export interface QuizResultProfile {
  id: string;
  label: string;
  headline: string;
  description: string;
  product_recommendation: string;
  cta_text: string;
  cta_url_pattern: string;
  image_description?: string;
  urgency_element?: string;
  social_proof?: string;
}

export interface QuizLogicSpec {
  quiz_mechanics: {
    scoring_system: 'categorical' | 'weighted_score' | 'branching' | 'simple_count' | 'matrix';
    categories: Array<{
      id: string;
      label: string;
      description: string;
    }>;
    result_determination: string;
    tiebreaker_rule: string;
    scoring_matrix?: Record<string, Record<string, string[]>>;
  };
  questions: QuizQuestion[];
  result_profiles: QuizResultProfile[];
  lead_capture: {
    position: 'before_result' | 'after_result' | 'during_quiz' | 'none';
    required: boolean;
    fields: string[];
    incentive_text: string;
    skip_option: boolean;
    privacy_text: string;
  };
  loading_screen: {
    exists: boolean;
    messages: string[];
    duration_ms: number;
    fake_progress: boolean;
    analysis_labels: string[];
  };
  data_tracking: {
    tracks_answers: boolean;
    sends_to_external: boolean;
    external_service_hints: string[];
    utm_passthrough: boolean;
  };
}

// =====================================================
// MASTER SPEC — Unified output from synthesis agent
// =====================================================

export interface MasterSpec {
  visual: VisualDesignSpec;
  ux_flow: UXFlowSpec;
  cro: CROSpec;
  quiz_logic: QuizLogicSpec;
  synthesis_notes: {
    conflicts_resolved: string[];
    confidence_score: number;
    warnings: string[];
    critical_elements_to_preserve: string[];
  };
  metadata: {
    original_url: string;
    funnel_name: string;
    total_steps: number;
    analyzed_at: string;
    agents_used: string[];
  };
}

// =====================================================
// CLONE-TRANSFORM mode types
// =====================================================

export interface ClonedQuizData {
  html: string;
  title: string;
  cssCount: number;
  imgCount: number;
  renderedSize: number;
}

export interface TextNode {
  index: number;
  originalText: string;
  tagName: string;
  fullTag: string;
  classes: string;
  parentClasses: string;
  position: number;
  isHeadline: boolean;
  isCta: boolean;
  isOption: boolean;
  isSocialProof: boolean;
  isUrgency: boolean;
  context: string;
}

export interface TransformPayload {
  clonedHtml: string;
  textNodes: TextNode[];
  masterSpec: MasterSpec;
  branding: import('@/types').GeneratedBranding;
  product: {
    name: string;
    description: string;
    price: number;
    benefits: string[];
    ctaText: string;
    ctaUrl: string;
    brandName: string;
  };
  extraInstructions?: string;
}

// =====================================================
// Pipeline state for the frontend
// =====================================================

export type MultiAgentPhase =
  | 'idle'
  | 'cloning_html'
  | 'capturing_components'
  | 'agent_visual'
  | 'agent_ux_flow'
  | 'agent_cro'
  | 'agent_quiz_logic'
  | 'synthesizing'
  | 'generating_branding'
  | 'transforming_html'
  | 'done'
  | 'error';

export const MULTI_AGENT_PHASE_LABELS: Record<MultiAgentPhase, string> = {
  idle: '',
  cloning_html: 'Clonazione HTML originale con Playwright...',
  capturing_components: 'Cattura screenshot per-componente...',
  agent_visual: 'Agent 1: Analisi Visual Design pixel-perfect...',
  agent_ux_flow: 'Agent 2: Analisi UX Flow & Interazioni...',
  agent_cro: 'Agent 3: Analisi CRO & Copy Strategy...',
  agent_quiz_logic: 'Agent 4: Reverse-engineering logica quiz...',
  synthesizing: 'Agent 5: Sintesi Master Spec unificata...',
  generating_branding: 'Generazione branding per il tuo prodotto...',
  transforming_html: 'Claude: Trasformazione chirurgica dell\'HTML...',
  done: 'Completato!',
  error: 'Errore',
};
