/**
 * Configuration validation system for Claude Code Router cost tracking
 *
 * This module provides comprehensive validation and user prompting for
 * cost tracking configuration, ensuring proper model pricing setup
 * and graceful degradation on validation failures.
 */

import { CostTrackingConfig, ModelPricing } from '../types/cost';

/**
 * Validation result containing errors, warnings, and missing pricing information
 */
export interface ValidationResult {
  /** Critical errors that prevent cost tracking from working properly */
  errors: string[];
  /** Non-critical warnings that don't prevent operation */
  warnings: string[];
  /** Models used in router configuration that are missing pricing */
  missingPricing: string[];
  /** Whether validation passed (no critical errors) */
  isValid: boolean;
}

/**
 * User confirmation options for validation issues
 */
export interface UserConfirmationOptions {
  /** Whether to continue despite critical errors */
  continueWithErrors: boolean;
  /** Whether to continue with missing pricing */
  continueWithMissingPricing: boolean;
  /** Whether to use default currency for unsupported currencies */
  useDefaultCurrency: boolean;
}

/**
 * Comprehensive cost configuration validator with user prompting
 */
export class CostConfigValidator {
  private static readonly SUPPORTED_CURRENCIES = new Set([
    'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD', 'CHF', 'HKD', 'SGD',
    'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'TRY', 'RUB',
    'BRL', 'MXN', 'INR', 'KRW', 'IDR', 'THB', 'MYR', 'PHP', 'VND', 'ZAR'
  ]);

  private static readonly DEFAULT_CURRENCY = 'USD';

  /**
   * Validates cost tracking configuration against router configuration
   * @param config Cost tracking configuration to validate
   * @param routerConfig Router configuration to extract models from
   * @returns Validation result with errors, warnings, and missing pricing
   */
  static validateCostConfig(
    config: CostTrackingConfig,
    routerConfig: any
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingPricing: string[] = [];

    // Validate pricing values
    if (config.model_pricing) {
      for (const [model, pricing] of Object.entries(config.model_pricing)) {
        if (!this.isValidModelFormat(model)) {
          errors.push(`Invalid model format: "${model}". Expected format: "<provider>,<model>"`);
        }
        if (pricing.input_tokens_per_million <= 0) {
          errors.push(`Invalid input pricing for ${model}: must be positive`);
        }
        if (pricing.output_tokens_per_million <= 0) {
          errors.push(`Invalid output pricing for ${model}: must be positive`);
        }
        if (pricing.currency && !this.isValidCurrency(pricing.currency)) {
          warnings.push(`Unsupported currency "${pricing.currency}" for ${model}, using default USD`);
        }
      }
    }

    // Check for missing pricing on router-used models
    if (config.enabled && routerConfig) {
      const routerModels = this.extractRouterModels(routerConfig);
      missingPricing.push(...this.findMissingPricing(routerModels, config.model_pricing || {}));
    }

    return {
      errors,
      warnings,
      missingPricing,
      isValid: errors.length === 0
    };
  }

  /**
   * Prompts user for confirmation on validation issues
   * @param validationResult Validation result containing issues to confirm
   * @param options User confirmation options
   * @returns Promise resolving to whether user confirmed to continue
   */
  static async promptUserForConfirmation(
    validationResult: ValidationResult,
    options: UserConfirmationOptions
  ): Promise<boolean> {
    const { errors, warnings, missingPricing } = validationResult;

    // If no critical issues, no need for user confirmation
    if (errors.length === 0 && missingPricing.length === 0) {
      return true;
    }

    // Display critical errors
    if (errors.length > 0) {
      console.error('\n❌ Critical configuration errors found:');
      errors.forEach(error => console.error(`  • ${error}`));

      if (!options.continueWithErrors) {
        console.error('\nCost tracking cannot be enabled with these errors.');
        return false;
      }

      console.warn('\n⚠️  Continuing with cost tracking despite critical errors.');
    }

    // Display missing pricing warnings
    if (missingPricing.length > 0) {
      console.warn('\n⚠️  Missing pricing for router-used models:');
      missingPricing.forEach(model => console.warn(`  • ${model}`));

      if (!options.continueWithMissingPricing) {
        console.error('\nCost tracking cannot be enabled with missing pricing.');
        return false;
      }

      console.warn('\n⚠️  Continuing with partial cost tracking (missing models will show $0 cost).');
    }

    // Display non-critical warnings
    if (warnings.length > 0) {
      console.warn('\nℹ️  Configuration warnings:');
      warnings.forEach(warning => console.warn(`  • ${warning}`));
    }

    return true;
  }

  /**
   * Validates and initializes cost configuration with user interaction
   * @param config Cost tracking configuration to validate and initialize
   * @param routerConfig Router configuration to extract models from
   * @param options User confirmation options
   * @returns Promise resolving to validated and initialized configuration
   */
  static async validateAndInitializeCostConfig(
    config: CostTrackingConfig,
    routerConfig: any,
    options: UserConfirmationOptions
  ): Promise<CostTrackingConfig> {
    const validationResult = this.validateCostConfig(config, routerConfig);

    // If validation fails and user doesn't confirm, disable cost tracking
    if (!validationResult.isValid) {
      const userConfirmed = await this.promptUserForConfirmation(validationResult, options);
      if (!userConfirmed) {
        console.warn('Cost tracking disabled due to configuration issues.');
        return {
          ...config,
          enabled: false
        };
      }
    }

    // Apply currency fixes for unsupported currencies
    const fixedConfig = this.fixCurrencyIssues(config);

    return fixedConfig;
  }

  /**
   * Checks if model name follows the correct format
   * @param model Model name to validate
   * @returns Whether model format is valid
   */
  static isValidModelFormat(model: string): boolean {
    const parts = model.split(',');
    return parts.length === 2 && parts[0].trim() !== '' && parts[1].trim() !== '';
  }

  /**
   * Checks if currency code is supported
   * @param currency Currency code to validate
   * @returns Whether currency is supported
   */
  static isValidCurrency(currency: string): boolean {
    return this.SUPPORTED_CURRENCIES.has(currency.toUpperCase());
  }

  /**
   * Extracts all models used in router configuration
   * @param routerConfig Router configuration object
   * @returns Set of model names in format "<provider>,<model>"
   */
  static extractRouterModels(routerConfig: any): Set<string> {
    const models = new Set<string>();

    // Extract from Router section
    if (routerConfig.Router) {
      const router = routerConfig.Router;
      if (router.default) models.add(router.default);
      if (router.background) models.add(router.background);
      if (router.think) models.add(router.think);
      if (router.longContext) models.add(router.longContext);
      if (router.webSearch) models.add(router.webSearch);
    }

    // Extract from Providers section
    if (Array.isArray(routerConfig.Providers)) {
      for (const provider of routerConfig.Providers) {
        if (provider.name && Array.isArray(provider.models)) {
          for (const model of provider.models) {
            models.add(`${provider.name},${model}`);
          }
        }
      }
    }

    return models;
  }

  /**
   * Finds models that are used in router but missing pricing
   * @param routerModels Set of models used in router
   * @param modelPricing Current model pricing configuration
   * @returns Array of models missing pricing
   */
  static findMissingPricing(
    routerModels: Set<string>,
    modelPricing: Record<string, ModelPricing>
  ): string[] {
    const missing: string[] = [];

    for (const model of routerModels) {
      if (!modelPricing[model]) {
        missing.push(model);
      }
    }

    return missing;
  }

  /**
   * Fixes currency issues in configuration
   * @param config Configuration to fix
   * @returns Configuration with currency issues resolved
   */
  private static fixCurrencyIssues(config: CostTrackingConfig): CostTrackingConfig {
    if (!config.model_pricing) {
      return config;
    }

    const fixedPricing = { ...config.model_pricing };

    for (const [model, pricing] of Object.entries(fixedPricing)) {
      if (pricing.currency && !this.isValidCurrency(pricing.currency)) {
        fixedPricing[model] = {
          ...pricing,
          currency: this.DEFAULT_CURRENCY
        };
      }
    }

    return {
      ...config,
      model_pricing: fixedPricing
    };
  }

  /**
   * Gets default cost tracking configuration
   * @returns Default configuration with sensible defaults
   */
  static getDefaultConfig(): CostTrackingConfig {
    return {
      enabled: false,
      default_currency: this.DEFAULT_CURRENCY,
      model_pricing: {}
    };
  }

  /**
   * Merges user configuration with defaults
   * @param userConfig User-provided configuration
   * @returns Merged configuration with defaults
   */
  static mergeWithDefaults(userConfig: Partial<CostTrackingConfig>): CostTrackingConfig {
    const defaults = this.getDefaultConfig();

    return {
      enabled: userConfig.enabled ?? defaults.enabled,
      default_currency: userConfig.default_currency ?? defaults.default_currency,
      model_pricing: userConfig.model_pricing ?? defaults.model_pricing
    };
  }
}

/**
 * Convenience function to validate and initialize cost configuration
 * @param config Cost tracking configuration
 * @param routerConfig Router configuration
 * @param options User confirmation options
 * @returns Promise resolving to validated configuration
 */
export async function validateAndInitializeCostConfig(
  config: CostTrackingConfig,
  routerConfig: any,
  options: UserConfirmationOptions
): Promise<CostTrackingConfig> {
  return CostConfigValidator.validateAndInitializeCostConfig(config, routerConfig, options);
}

/**
 * Convenience function to validate cost configuration
 * @param config Cost tracking configuration
 * @param routerConfig Router configuration
 * @returns Validation result
 */
export function validateCostConfig(
  config: CostTrackingConfig,
  routerConfig: any
): ValidationResult {
  return CostConfigValidator.validateCostConfig(config, routerConfig);
}