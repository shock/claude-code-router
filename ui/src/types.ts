export interface ProviderTransformer {
  use: (string | (string | Record<string, unknown> | { max_tokens: number })[])[];
  [key: string]: any; // Allow for model-specific transformers
}

export interface Provider {
  name: string;
  api_base_url: string;
  api_key: string;
  models: string[];
  transformer?: ProviderTransformer;
}

export interface RouterConfig {
    default: string;
    background: string;
    think: string;
    longContext: string;
    longContextThreshold: number;
    webSearch: string;
    image: string;
    custom?: any;
}

export interface Transformer {
    name?: string;
    path: string;
    options?: Record<string, any>;
}

// Status line module types
export type StatusLineModuleType = "workDir" | "gitBranch" | "model" | "usage" | "script" | "cost";

export interface StatusLineModuleConfig {
  type: StatusLineModuleType;
  icon?: string;
  text: string;
  color?: string;
  background?: string;
  scriptPath?: string; // 用于script类型的模块，指定要执行的Node.js脚本文件路径
}

// Cost-specific module configuration
export interface CostModule extends StatusLineModuleConfig {
  type: "cost";
  show_breakdown?: boolean;
  precision?: number;
  format?: "currency" | "decimal" | "scientific" | "compact";
}

export interface StatusLineThemeConfig {
  modules: StatusLineModuleConfig[];
}

export interface StatusLineConfig {
  enabled: boolean;
  currentStyle: string;
  default: StatusLineThemeConfig;
  powerline: StatusLineThemeConfig;
  fontFamily?: string;
}

export interface ModelPricing {
  input_cost_per_million: number;
  output_cost_per_million: number;
  currency?: string;
}

export interface CostTrackingConfig {
  enabled?: boolean;
  default_currency?: string;
  model_pricing?: Record<string, ModelPricing>;
}

export interface Config {
  Providers: Provider[];
  Router: RouterConfig;
  transformers: Transformer[];
  StatusLine?: StatusLineConfig;
  forceUseImageAgent?: boolean;
  CostTracking?: CostTrackingConfig;
  // Top-level settings
  LOG: boolean;
  LOG_LEVEL: string;
  CLAUDE_PATH: string;
  HOST: string;
  PORT: number;
  APIKEY: string;
  API_TIMEOUT_MS: string;
  PROXY_URL: string;
  CUSTOM_ROUTER_PATH?: string;
}

export type AccessLevel = 'restricted' | 'full';
