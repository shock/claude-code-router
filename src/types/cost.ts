/**
 * Cost tracking type definitions for Claude Code Router
 *
 * This module provides comprehensive type definitions for tracking
 * and calculating costs associated with LLM API usage.
 */

/**
 * Pricing information for a specific model
 */
export interface ModelPricing {
  /** Cost per million input tokens */
  input_tokens_per_million: number;
  /** Cost per million output tokens */
  output_tokens_per_million: number;
  /** Currency code (e.g., 'USD', 'EUR'). Defaults to USD if not specified */
  currency?: string;
}

/**
 * Detailed cost breakdown for a specific model usage within a session
 */
export interface ModelCostBreakdown {
  /** Number of input tokens used */
  inputTokens: number;
  /** Number of output tokens used */
  outputTokens: number;
  /** Cost for input tokens */
  inputCost: number;
  /** Cost for output tokens */
  outputCost: number;
  /** Total cost for this model (inputCost + outputCost) */
  totalCost: number;
}

/**
 * Complete cost data for a single session
 */
export interface SessionCostData {
  /** Unique identifier for the session */
  sessionId: string;
  /** When the session started */
  startTime: Date;
  /** Total cost for the session across all models */
  totalCost: number;
  /** Cost breakdown by model */
  modelCosts: {
    [modelName: string]: ModelCostBreakdown;
  };
  /** Currency used for cost calculations */
  currency: string;
}

/**
 * Configuration for cost tracking functionality
 */
export interface CostTrackingConfig {
  /** Whether cost tracking is enabled */
  enabled: boolean;
  /** Default currency for cost calculations */
  default_currency: string;
  /** Pricing information for supported models */
  model_pricing: Record<string, ModelPricing>;
}

/**
 * Token usage information from LLM API responses
 */
export interface TokenUsage {
  /** Number of input tokens used */
  inputTokens?: number;
  /** Number of output tokens used */
  outputTokens?: number;
  /** Total tokens used (input + output) */
  totalTokens?: number;
}

/**
 * Cost calculation result for a single API call
 */
export interface CostCalculation {
  /** Model used for the API call */
  model: string;
  /** Token usage information */
  tokenUsage: TokenUsage;
  /** Calculated cost */
  cost: number;
  /** Currency used for calculation */
  currency: string;
  /** Timestamp of the calculation */
  timestamp: Date;
}

/**
 * Aggregated cost statistics over a time period
 */
export interface CostStatistics {
  /** Start of the time period */
  periodStart: Date;
  /** End of the time period */
  periodEnd: Date;
  /** Total cost during the period */
  totalCost: number;
  /** Number of sessions during the period */
  sessionCount: number;
  /** Average cost per session */
  averageCostPerSession: number;
  /** Cost breakdown by model */
  modelBreakdown: Record<string, number>;
  /** Currency used for calculations */
  currency: string;
}

/**
 * Options for cost calculation functions
 */
export interface CostCalculationOptions {
  /** Override currency for this calculation */
  currency?: string;
  /** Whether to include detailed breakdown */
  includeBreakdown?: boolean;
  /** Custom pricing to use instead of config */
  customPricing?: ModelPricing;
}