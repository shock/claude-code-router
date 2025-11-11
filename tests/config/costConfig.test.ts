/**
 * Unit tests for cost configuration validation system
 */

import {
  CostConfigValidator,
  validateCostConfig,
  validateAndInitializeCostConfig,
  ValidationResult,
  UserConfirmationOptions
} from '../../src/config/costConfig';
import { CostTrackingConfig } from '../../src/types/cost';

describe('CostConfigValidator', () => {
  const mockRouterConfig = {
    Router: {
      default: 'openai,gpt-4',
      background: 'anthropic,claude-3-haiku',
      think: 'anthropic,claude-3.5-sonnet',
      longContext: 'openai,gpt-4',
      webSearch: 'anthropic,claude-3-haiku'
    },
    Providers: [
      {
        name: 'openai',
        models: ['gpt-4', 'gpt-3.5-turbo']
      },
      {
        name: 'anthropic',
        models: ['claude-3.5-sonnet', 'claude-3-haiku', 'claude-3-opus']
      }
    ]
  };

  const validConfig: CostTrackingConfig = {
    enabled: true,
    default_currency: 'USD',
    model_pricing: {
      'openai,gpt-4': {
        input_tokens_per_million: 2.50,
        output_tokens_per_million: 10.00,
        currency: 'USD'
      },
      'anthropic,claude-3.5-sonnet': {
        input_tokens_per_million: 3.00,
        output_tokens_per_million: 15.00,
        currency: 'USD'
      },
      'anthropic,claude-3-haiku': {
        input_tokens_per_million: 0.25,
        output_tokens_per_million: 1.25,
        currency: 'USD'
      }
    }
  };

  describe('validateCostConfig', () => {
    test('should validate correct configuration', () => {
      const result = CostConfigValidator.validateCostConfig(validConfig, mockRouterConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      // Note: missingPricing may contain models from Providers that aren't in Router
      // This is expected behavior as the validation checks all models that could be used
    });

    test('should detect invalid model format', () => {
      const invalidConfig: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          ...validConfig.model_pricing,
          'invalid-model-format': {
            input_tokens_per_million: 1.0,
            output_tokens_per_million: 2.0
          }
        }
      };

      const result = CostConfigValidator.validateCostConfig(invalidConfig, mockRouterConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid model format: "invalid-model-format". Expected format: "<provider>,<model>"');
    });

    test('should detect negative pricing', () => {
      const invalidConfig: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          ...validConfig.model_pricing,
          'openai,gpt-4': {
            input_tokens_per_million: -1.0,
            output_tokens_per_million: -2.0
          }
        }
      };

      const result = CostConfigValidator.validateCostConfig(invalidConfig, mockRouterConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid input pricing for openai,gpt-4: must be positive');
      expect(result.errors).toContain('Invalid output pricing for openai,gpt-4: must be positive');
    });

    test('should detect unsupported currency', () => {
      const invalidConfig: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          ...validConfig.model_pricing,
          'openai,gpt-4': {
            input_tokens_per_million: 2.50,
            output_tokens_per_million: 10.00,
            currency: 'XYZ'
          }
        }
      };

      const result = CostConfigValidator.validateCostConfig(invalidConfig, mockRouterConfig);

      expect(result.isValid).toBe(true); // Currency issues are warnings, not errors
      expect(result.warnings).toContain('Unsupported currency "XYZ" for openai,gpt-4, using default USD');
    });

    test('should detect missing pricing for router models', () => {
      const partialConfig: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          'openai,gpt-4': {
            input_tokens_per_million: 2.50,
            output_tokens_per_million: 10.00
          }
          // Missing pricing for anthropic,claude-3-haiku and anthropic,claude-3.5-sonnet
        }
      };

      const result = CostConfigValidator.validateCostConfig(partialConfig, mockRouterConfig);

      expect(result.isValid).toBe(true); // Missing pricing doesn't make config invalid
      expect(result.missingPricing).toContain('anthropic,claude-3-haiku');
      expect(result.missingPricing).toContain('anthropic,claude-3.5-sonnet');
    });

    test('should handle disabled cost tracking gracefully', () => {
      const disabledConfig: CostTrackingConfig = {
        enabled: false,
        default_currency: 'USD',
        model_pricing: {}
      };

      const result = CostConfigValidator.validateCostConfig(disabledConfig, mockRouterConfig);

      expect(result.isValid).toBe(true);
      expect(result.missingPricing).toHaveLength(0); // No missing pricing check when disabled
    });
  });

  describe('isValidModelFormat', () => {
    test('should validate correct model format', () => {
      expect(CostConfigValidator.isValidModelFormat('openai,gpt-4')).toBe(true);
      expect(CostConfigValidator.isValidModelFormat('anthropic,claude-3.5-sonnet')).toBe(true);
      expect(CostConfigValidator.isValidModelFormat('provider,model-name')).toBe(true);
    });

    test('should reject invalid model format', () => {
      expect(CostConfigValidator.isValidModelFormat('invalid')).toBe(false);
      expect(CostConfigValidator.isValidModelFormat('provider,')).toBe(false);
      expect(CostConfigValidator.isValidModelFormat(',model')).toBe(false);
      expect(CostConfigValidator.isValidModelFormat('')).toBe(false);
    });
  });

  describe('isValidCurrency', () => {
    test('should validate supported currencies', () => {
      expect(CostConfigValidator.isValidCurrency('USD')).toBe(true);
      expect(CostConfigValidator.isValidCurrency('EUR')).toBe(true);
      expect(CostConfigValidator.isValidCurrency('CNY')).toBe(true);
      expect(CostConfigValidator.isValidCurrency('JPY')).toBe(true);
    });

    test('should reject unsupported currencies', () => {
      expect(CostConfigValidator.isValidCurrency('XYZ')).toBe(false);
      expect(CostConfigValidator.isValidCurrency('ABC')).toBe(false);
      expect(CostConfigValidator.isValidCurrency('')).toBe(false);
    });

    test('should be case insensitive', () => {
      expect(CostConfigValidator.isValidCurrency('usd')).toBe(true);
      expect(CostConfigValidator.isValidCurrency('Eur')).toBe(true);
    });
  });

  describe('extractRouterModels', () => {
    test('should extract models from router configuration', () => {
      const models = CostConfigValidator.extractRouterModels(mockRouterConfig);

      expect(models).toContain('openai,gpt-4');
      expect(models).toContain('anthropic,claude-3-haiku');
      expect(models).toContain('anthropic,claude-3.5-sonnet');
      expect(models).toContain('openai,gpt-3.5-turbo');
      expect(models).toContain('anthropic,claude-3-opus');
    });

    test('should handle missing router configuration', () => {
      const models = CostConfigValidator.extractRouterModels({});
      expect(models.size).toBe(0);
    });

    test('should handle partial router configuration', () => {
      const partialConfig = {
        Router: {
          default: 'openai,gpt-4'
        }
      };

      const models = CostConfigValidator.extractRouterModels(partialConfig);
      expect(models).toContain('openai,gpt-4');
    });
  });

  describe('findMissingPricing', () => {
    test('should find models missing pricing', () => {
      const routerModels = new Set(['openai,gpt-4', 'anthropic,claude-3.5-sonnet', 'anthropic,claude-3-haiku']);
      const modelPricing = {
        'openai,gpt-4': {
          input_tokens_per_million: 2.50,
          output_tokens_per_million: 10.00
        }
      };

      const missing = CostConfigValidator.findMissingPricing(routerModels, modelPricing);

      expect(missing).toContain('anthropic,claude-3.5-sonnet');
      expect(missing).toContain('anthropic,claude-3-haiku');
      expect(missing).not.toContain('openai,gpt-4');
    });

    test('should return empty array when all models have pricing', () => {
      const routerModels = new Set(['openai,gpt-4']);
      const modelPricing = {
        'openai,gpt-4': {
          input_tokens_per_million: 2.50,
          output_tokens_per_million: 10.00
        }
      };

      const missing = CostConfigValidator.findMissingPricing(routerModels, modelPricing);
      expect(missing).toHaveLength(0);
    });
  });

  describe('mergeWithDefaults', () => {
    test('should merge user config with defaults', () => {
      const userConfig = {
        enabled: true,
        model_pricing: {
          'openai,gpt-4': {
            input_tokens_per_million: 2.50,
            output_tokens_per_million: 10.00
          }
        }
      };

      const merged = CostConfigValidator.mergeWithDefaults(userConfig);

      expect(merged.enabled).toBe(true);
      expect(merged.default_currency).toBe('USD');
      expect(merged.model_pricing).toEqual(userConfig.model_pricing);
    });

    test('should use defaults for missing properties', () => {
      const userConfig = {};

      const merged = CostConfigValidator.mergeWithDefaults(userConfig);

      expect(merged.enabled).toBe(false);
      expect(merged.default_currency).toBe('USD');
      expect(merged.model_pricing).toEqual({});
    });
  });

  describe('promptUserForConfirmation', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    test('should return true for valid configuration', async () => {
      const validationResult: ValidationResult = {
        errors: [],
        warnings: [],
        missingPricing: [],
        isValid: true
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: false,
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.promptUserForConfirmation(validationResult, options);
      expect(result).toBe(true);
    });

    test('should return false for critical errors when not continuing', async () => {
      const validationResult: ValidationResult = {
        errors: ['Critical error'],
        warnings: [],
        missingPricing: [],
        isValid: false
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: false,
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.promptUserForConfirmation(validationResult, options);
      expect(result).toBe(false);
    });

    test('should return true for critical errors when continuing', async () => {
      const validationResult: ValidationResult = {
        errors: ['Critical error'],
        warnings: [],
        missingPricing: [],
        isValid: false
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: true,
        continueWithMissingPricing: false,
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.promptUserForConfirmation(validationResult, options);
      expect(result).toBe(true);
    });

    test('should handle missing pricing appropriately', async () => {
      const validationResult: ValidationResult = {
        errors: [],
        warnings: [],
        missingPricing: ['anthropic,claude-3.5-sonnet'],
        isValid: true
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: true,
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.promptUserForConfirmation(validationResult, options);
      expect(result).toBe(true);
    });
  });

  describe('validateAndInitializeCostConfig', () => {
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    test('should return original config when validation passes', async () => {
      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: false,
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.validateAndInitializeCostConfig(
        validConfig,
        mockRouterConfig,
        options
      );

      expect(result).toEqual(validConfig);
    });

    test('should fix currency issues', async () => {
      const configWithInvalidCurrency: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          ...validConfig.model_pricing,
          'openai,gpt-4': {
            input_tokens_per_million: 2.50,
            output_tokens_per_million: 10.00,
            currency: 'XYZ'
          }
        }
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: false,
        useDefaultCurrency: true
      };

      const result = await CostConfigValidator.validateAndInitializeCostConfig(
        configWithInvalidCurrency,
        mockRouterConfig,
        options
      );

      expect(result.model_pricing['openai,gpt-4'].currency).toBe('USD');
    });
  });

  describe('convenience functions', () => {
    test('validateCostConfig should work as convenience function', () => {
      const result = validateCostConfig(validConfig, mockRouterConfig);
      expect(result.isValid).toBe(true);
    });

    test('validateAndInitializeCostConfig should work as convenience function', async () => {
      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: false,
        useDefaultCurrency: false
      };

      const result = await validateAndInitializeCostConfig(validConfig, mockRouterConfig, options);
      expect(result).toEqual(validConfig);
    });
  });

  describe('comprehensive configuration validation', () => {
    test('should validate empty configuration', () => {
      const emptyConfig: CostTrackingConfig = {
        enabled: false,
        default_currency: 'USD',
        model_pricing: {}
      };

      const result = CostConfigValidator.validateCostConfig(emptyConfig, mockRouterConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.missingPricing).toHaveLength(0);
    });

    test('should validate configuration with only default currency', () => {
      const minimalConfig: CostTrackingConfig = {
        enabled: true,
        default_currency: 'EUR',
        model_pricing: {}
      };

      const result = CostConfigValidator.validateCostConfig(minimalConfig, mockRouterConfig);
      expect(result.isValid).toBe(true);
      expect(result.missingPricing.length).toBeGreaterThan(0); // Should detect missing pricing
    });

    test('should handle object key overwriting (not duplicate detection)', () => {
      const overwrittenConfig: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          ...validConfig.model_pricing,
          'openai,gpt-4': {
            input_tokens_per_million: 3.00, // Overwrites the original value
            output_tokens_per_million: 12.00
          }
        }
      };

      const result = CostConfigValidator.validateCostConfig(overwrittenConfig, mockRouterConfig);
      // JavaScript/TypeScript objects allow key overwriting, last value wins
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate configuration with mixed currencies', () => {
      const mixedCurrencyConfig: CostTrackingConfig = {
        enabled: true,
        default_currency: 'USD',
        model_pricing: {
          'openai,gpt-4': {
            input_tokens_per_million: 2.50,
            output_tokens_per_million: 10.00,
            currency: 'EUR'
          },
          'anthropic,claude-3.5-sonnet': {
            input_tokens_per_million: 3.00,
            output_tokens_per_million: 15.00,
            currency: 'JPY'
          }
        }
      };

      const result = CostConfigValidator.validateCostConfig(mixedCurrencyConfig, mockRouterConfig);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0); // All currencies are valid
    });

    test('should detect invalid pricing structure', () => {
      const invalidPricingConfig: CostTrackingConfig = {
        enabled: true,
        default_currency: 'USD',
        model_pricing: {
          'openai,gpt-4': {
            input_tokens_per_million: -1.0, // Invalid negative value
            output_tokens_per_million: -2.0 // Invalid negative value
          }
        }
      };

      const result = CostConfigValidator.validateCostConfig(invalidPricingConfig, mockRouterConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid input pricing for openai,gpt-4: must be positive');
      expect(result.errors).toContain('Invalid output pricing for openai,gpt-4: must be positive');
    });

    test('should handle null router configuration', () => {
      const result = CostConfigValidator.validateCostConfig(validConfig, null as any);
      expect(result.isValid).toBe(true);
      expect(result.missingPricing).toHaveLength(0); // No router config means no missing pricing check
    });

    test('should handle undefined router configuration', () => {
      const result = CostConfigValidator.validateCostConfig(validConfig, undefined as any);
      expect(result.isValid).toBe(true);
      expect(result.missingPricing).toHaveLength(0);
    });

    test('should validate configuration with partial router models', () => {
      const partialRouterConfig = {
        Router: {
          default: 'openai,gpt-4'
        },
        Providers: [
          {
            name: 'openai',
            models: ['gpt-4', 'gpt-3.5-turbo']
          }
        ]
      };

      const result = CostConfigValidator.validateCostConfig(validConfig, partialRouterConfig);
      expect(result.isValid).toBe(true);
      // Should only check models from the partial router config
    });

    test('should detect pricing with zero values', () => {
      const zeroPricingConfig: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          'openai,gpt-4': {
            input_tokens_per_million: 0,
            output_tokens_per_million: 0
          }
        }
      };

      const result = CostConfigValidator.validateCostConfig(zeroPricingConfig, mockRouterConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid input pricing for openai,gpt-4: must be positive');
      expect(result.errors).toContain('Invalid output pricing for openai,gpt-4: must be positive');
    });

    test('should validate configuration with very small pricing values', () => {
      const smallPricingConfig: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          'openai,gpt-4': {
            input_tokens_per_million: 0.0001,
            output_tokens_per_million: 0.0005
          }
        }
      };

      const result = CostConfigValidator.validateCostConfig(smallPricingConfig, mockRouterConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate configuration with very large pricing values', () => {
      const largePricingConfig: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          'openai,gpt-4': {
            input_tokens_per_million: 1000000,
            output_tokens_per_million: 5000000
          }
        }
      };

      const result = CostConfigValidator.validateCostConfig(largePricingConfig, mockRouterConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('currency validation edge cases', () => {
    test('should validate all supported currencies', () => {
      const supportedCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD', 'CHF', 'HKD', 'SGD'];

      supportedCurrencies.forEach(currency => {
        expect(CostConfigValidator.isValidCurrency(currency)).toBe(true);
      });
    });

    test('should reject invalid currency codes', () => {
      const invalidCurrencies = ['ABC', '123', 'USD1', 'US', '$$$', ''];

      invalidCurrencies.forEach(currency => {
        expect(CostConfigValidator.isValidCurrency(currency)).toBe(false);
      });
    });

    test('should handle currency case sensitivity', () => {
      expect(CostConfigValidator.isValidCurrency('usd')).toBe(true);
      expect(CostConfigValidator.isValidCurrency('UsD')).toBe(true);
      expect(CostConfigValidator.isValidCurrency('EUR')).toBe(true);
      expect(CostConfigValidator.isValidCurrency('eur')).toBe(true);
    });
  });

  describe('model format validation edge cases', () => {
    test('should validate various model formats', () => {
      const validModels = [
        'provider,model',
        'openai,gpt-4',
        'anthropic,claude-3.5-sonnet',
        'google,gemini-pro',
        'azure,gpt-35-turbo',
        'aws,claude-v2'
      ];

      validModels.forEach(model => {
        expect(CostConfigValidator.isValidModelFormat(model)).toBe(true);
      });
    });

    test('should reject invalid model formats', () => {
      const invalidModels = [
        '',
        'provider',
        'provider,',
        ',model',
        'provider,model,extra',
        ' , ',
        'provider, ',
        ' ,model'
      ];

      invalidModels.forEach(model => {
        expect(CostConfigValidator.isValidModelFormat(model)).toBe(false);
      });
    });

    test('should handle model names with special characters', () => {
      const specialModels = [
        'provider,model-name',
        'provider,model_name',
        'provider,model.name',
        'provider,model@version',
        'provider,model+plus'
      ];

      specialModels.forEach(model => {
        expect(CostConfigValidator.isValidModelFormat(model)).toBe(true);
      });
    });
  });

  describe('default configuration tests', () => {
    test('should provide sensible default configuration', () => {
      const defaultConfig = CostConfigValidator.getDefaultConfig();

      expect(defaultConfig.enabled).toBe(false);
      expect(defaultConfig.default_currency).toBe('USD');
      expect(defaultConfig.model_pricing).toEqual({});
    });

    test('should merge user config with defaults correctly', () => {
      const userConfig = {
        enabled: true,
        model_pricing: {
          'openai,gpt-4': {
            input_tokens_per_million: 2.50,
            output_tokens_per_million: 10.00
          }
        }
      };

      const merged = CostConfigValidator.mergeWithDefaults(userConfig);

      expect(merged.enabled).toBe(true);
      expect(merged.default_currency).toBe('USD');
      expect(merged.model_pricing).toEqual(userConfig.model_pricing);
    });

    test('should handle partial user configuration', () => {
      const partialConfig = {
        enabled: true
      };

      const merged = CostConfigValidator.mergeWithDefaults(partialConfig);

      expect(merged.enabled).toBe(true);
      expect(merged.default_currency).toBe('USD');
      expect(merged.model_pricing).toEqual({});
    });

    test('should handle empty user configuration', () => {
      const emptyConfig = {};

      const merged = CostConfigValidator.mergeWithDefaults(emptyConfig);

      expect(merged.enabled).toBe(false);
      expect(merged.default_currency).toBe('USD');
      expect(merged.model_pricing).toEqual({});
    });
  });

  describe('user prompting scenarios', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    test('should prompt user for critical errors', async () => {
      const validationResult: ValidationResult = {
        errors: ['Critical configuration error'],
        warnings: [],
        missingPricing: [],
        isValid: false
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: false,
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.promptUserForConfirmation(validationResult, options);
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ Critical configuration errors found:');
      expect(consoleErrorSpy).toHaveBeenCalledWith('  • Critical configuration error');
    });

    test('should prompt user for missing pricing', async () => {
      const validationResult: ValidationResult = {
        errors: [],
        warnings: [],
        missingPricing: ['anthropic,claude-3.5-sonnet', 'openai,gpt-4'],
        isValid: true
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: false,
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.promptUserForConfirmation(validationResult, options);
      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('\n⚠️  Missing pricing for router-used models:');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  • anthropic,claude-3.5-sonnet');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  • openai,gpt-4');
    });

    test('should allow continuation with errors when configured', async () => {
      const validationResult: ValidationResult = {
        errors: ['Critical configuration error'],
        warnings: [],
        missingPricing: [],
        isValid: false
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: true,
        continueWithMissingPricing: false,
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.promptUserForConfirmation(validationResult, options);
      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith('\n⚠️  Continuing with cost tracking despite critical errors.');
    });

    test('should allow continuation with missing pricing when configured', async () => {
      const validationResult: ValidationResult = {
        errors: [],
        warnings: [],
        missingPricing: ['anthropic,claude-3.5-sonnet'],
        isValid: true
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: true,
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.promptUserForConfirmation(validationResult, options);
      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith('\n⚠️  Continuing with partial cost tracking (missing models will show $0 cost).');
    });

    test('should display warnings when present with other issues', async () => {
      const validationResult: ValidationResult = {
        errors: [],
        warnings: ['Currency warning', 'Configuration warning'],
        missingPricing: ['anthropic,claude-3.5-sonnet'], // Need missing pricing to trigger warning display
        isValid: true
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: true, // Allow continuation with missing pricing
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.promptUserForConfirmation(validationResult, options);
      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith('\nℹ️  Configuration warnings:');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  • Currency warning');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  • Configuration warning');
    });

    test('should handle multiple validation issues together', async () => {
      const validationResult: ValidationResult = {
        errors: ['Critical error 1', 'Critical error 2'],
        warnings: ['Warning 1', 'Warning 2'],
        missingPricing: ['model1', 'model2'],
        isValid: false
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: true,
        continueWithMissingPricing: true,
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.promptUserForConfirmation(validationResult, options);
      expect(result).toBe(true);

      // Should display all issues
      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ Critical configuration errors found:');
      expect(consoleErrorSpy).toHaveBeenCalledWith('  • Critical error 1');
      expect(consoleErrorSpy).toHaveBeenCalledWith('  • Critical error 2');
      expect(consoleWarnSpy).toHaveBeenCalledWith('\n⚠️  Missing pricing for router-used models:');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  • model1');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  • model2');
      expect(consoleWarnSpy).toHaveBeenCalledWith('\nℹ️  Configuration warnings:');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  • Warning 1');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  • Warning 2');
    });

    test('should return true for clean validation result', async () => {
      const validationResult: ValidationResult = {
        errors: [],
        warnings: [],
        missingPricing: [],
        isValid: true
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: false,
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.promptUserForConfirmation(validationResult, options);
      expect(result).toBe(true);

      // Should not display any messages for clean validation
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    test('should handle empty validation result arrays', async () => {
      const validationResult: ValidationResult = {
        errors: [],
        warnings: [],
        missingPricing: [],
        isValid: true
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: false,
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.promptUserForConfirmation(validationResult, options);
      expect(result).toBe(true);
    });

    test('should handle validation with only warnings and missing pricing', async () => {
      const validationResult: ValidationResult = {
        errors: [],
        warnings: ['Just a warning'],
        missingPricing: ['anthropic,claude-3.5-sonnet'], // Need missing pricing to trigger warning display
        isValid: true
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: true, // Allow continuation with missing pricing
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.promptUserForConfirmation(validationResult, options);
      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith('\nℹ️  Configuration warnings:');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  • Just a warning');
    });
  });

  describe('validation and initialization integration', () => {
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    test('should disable cost tracking when user rejects configuration', async () => {
      const invalidConfig: CostTrackingConfig = {
        enabled: true,
        default_currency: 'USD',
        model_pricing: {
          'openai,gpt-4': {
            input_tokens_per_million: -1.0,
            output_tokens_per_million: -2.0
          }
        }
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: false,
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.validateAndInitializeCostConfig(
        invalidConfig,
        mockRouterConfig,
        options
      );

      expect(result.enabled).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Cost tracking disabled due to configuration issues.');
    });

    test('should fix currency issues when useDefaultCurrency is true', async () => {
      const configWithInvalidCurrency: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          ...validConfig.model_pricing,
          'openai,gpt-4': {
            input_tokens_per_million: 2.50,
            output_tokens_per_million: 10.00,
            currency: 'INVALID'
          }
        }
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: false,
        useDefaultCurrency: true
      };

      const result = await CostConfigValidator.validateAndInitializeCostConfig(
        configWithInvalidCurrency,
        mockRouterConfig,
        options
      );

      expect(result.model_pricing['openai,gpt-4'].currency).toBe('USD');
    });

    test('should preserve original configuration when validation passes', async () => {
      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: false,
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.validateAndInitializeCostConfig(
        validConfig,
        mockRouterConfig,
        options
      );

      expect(result).toEqual(validConfig);
    });

    test('should handle configuration with only warnings', async () => {
      const configWithWarnings: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          ...validConfig.model_pricing,
          'openai,gpt-4': {
            input_tokens_per_million: 2.50,
            output_tokens_per_million: 10.00,
            currency: 'XYZ' // Invalid currency
          }
        }
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: false,
        useDefaultCurrency: false
      };

      const result = await CostConfigValidator.validateAndInitializeCostConfig(
        configWithWarnings,
        mockRouterConfig,
        options
      );

      expect(result.enabled).toBe(true); // Should remain enabled with warnings
      // Currency should be fixed to USD even when useDefaultCurrency is false (current implementation behavior)
      expect(result.model_pricing['openai,gpt-4'].currency).toBe('USD');
    });
  });
});