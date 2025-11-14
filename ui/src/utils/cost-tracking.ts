import type { CostTrackingConfig, ModelPricing } from "@/types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates the model key format
 * @param key The model key
 * @returns true if valid format
 */
export function isValidModelKey(key: string): boolean {
  return typeof key === 'string' && key.trim() !== '';
}

/**
 * Validates model pricing configuration
 * @param pricing The model pricing configuration
 * @returns Validation result
 */
export function validateModelPricing(pricing: ModelPricing): ValidationResult {
  const errors: string[] = [];

  if (pricing.input_cost_per_million <= 0) {
    errors.push("input_cost_per_million must be a positive number");
  }

  if (pricing.output_cost_per_million <= 0) {
    errors.push("output_cost_per_million must be a positive number");
  }

  if (pricing.currency && !/^[A-Z]{3}$/.test(pricing.currency)) {
    errors.push("currency must be a valid 3-letter currency code (e.g., USD, EUR, CNY)");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates cost tracking configuration
 * @param config The cost tracking configuration
 * @returns Validation result
 */
export function validateCostTrackingConfig(config: CostTrackingConfig): ValidationResult {
  const errors: string[] = [];

  // Validate default currency if provided
  if (config.default_currency && !/^[A-Z]{3}$/.test(config.default_currency)) {
    errors.push("default_currency must be a valid 3-letter currency code (e.g., USD, EUR, CNY)");
  }

  // Validate model pricing if provided
  if (config.model_pricing) {
    for (const [modelKey, pricing] of Object.entries(config.model_pricing)) {
      // Validate model key format
      if (!isValidModelKey(modelKey)) {
        errors.push(`Invalid model key format: "${modelKey}". Model name must be a non-empty string.`);
      }

      // Validate pricing configuration
      const pricingValidation = validateModelPricing(pricing);
      if (!pricingValidation.isValid) {
        errors.push(...pricingValidation.errors.map(error => `Model "${modelKey}": ${error}`));
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Gets the currency for a specific model, falling back to default currency
 * @param config Cost tracking configuration
 * @param modelKey The model key
 * @returns The currency to use
 */
export function getModelCurrency(config: CostTrackingConfig, modelKey: string): string {
  const modelPricing = config.model_pricing?.[modelKey];
  return modelPricing?.currency || config.default_currency || 'USD';
}

/**
 * Calculates cost for a given token usage
 * @param config Cost tracking configuration
 * @param modelKey The model key
 * @param inputTokens Number of input tokens
 * @param outputTokens Number of output tokens
 * @returns The calculated cost
 */
export function calculateCost(
  config: CostTrackingConfig,
  modelKey: string,
  inputTokens: number,
  outputTokens: number
): number {
  const modelPricing = config.model_pricing?.[modelKey];
  if (!modelPricing) {
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * modelPricing.input_cost_per_million;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output_cost_per_million;

  return inputCost + outputCost;
}