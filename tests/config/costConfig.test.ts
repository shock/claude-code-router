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
      default: 'gpt-4',
      background: 'claude-3-haiku',
      think: 'claude-3.5-sonnet',
      longContext: 'gpt-4',
      webSearch: 'claude-3-haiku'
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
      'gpt-4': {
        input_cost_per_million: 2.50,
        output_cost_per_million: 10.00,
        currency: 'USD'
      },
      'claude-3.5-sonnet': {
        input_cost_per_million: 3.00,
        output_cost_per_million: 15.00,
        currency: 'USD'
      },
      'claude-3-haiku': {
        input_cost_per_million: 0.25,
        output_cost_per_million: 1.25,
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
          '*invalid-model-format': {
            input_cost_per_million: 1.0,
            output_cost_per_million: 2.0
          }
        }
      };

      const result = CostConfigValidator.validateCostConfig(invalidConfig, mockRouterConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid model format: "*invalid-model-format". Model name must be a non-empty string with only alphanumeric characters and @,/-_.');
    });

    test('should detect negative pricing', () => {
      const invalidConfig: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          ...validConfig.model_pricing,
          'gpt-4': {
            input_cost_per_million: -1.0,
            output_cost_per_million: -2.0
          }
        }
      };

      const result = CostConfigValidator.validateCostConfig(invalidConfig, mockRouterConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid input pricing for gpt-4: can\'t be negative');
      expect(result.errors).toContain('Invalid output pricing for gpt-4: can\'t be negative');
    });

    test('should detect unsupported currency', () => {
      const invalidConfig: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          ...validConfig.model_pricing,
          'gpt-4': {
            input_cost_per_million: 2.50,
            output_cost_per_million: 10.00,
            currency: 'XYZ'
          }
        }
      };

      const result = CostConfigValidator.validateCostConfig(invalidConfig, mockRouterConfig);

      expect(result.isValid).toBe(true); // Currency issues are warnings, not errors
      expect(result.warnings).toContain('Unsupported currency "XYZ" for gpt-4, using default USD');
    });

    test('should detect missing pricing for router models', () => {
      const partialConfig: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          'gpt-4': {
            input_cost_per_million: 2.50,
            output_cost_per_million: 10.00
          }
          // Missing pricing for claude-3-haiku and claude-3.5-sonnet
        }
      };

      const result = CostConfigValidator.validateCostConfig(partialConfig, mockRouterConfig);

      expect(result.isValid).toBe(true); // Missing pricing doesn't make config invalid
      expect(result.missingPricing).toContain('claude-3-haiku');
      expect(result.missingPricing).toContain('claude-3.5-sonnet');
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
      expect(CostConfigValidator.isValidModelFormat('gpt-4')).toBe(true);
      expect(CostConfigValidator.isValidModelFormat('claude-3.5-sonnet')).toBe(true);
      expect(CostConfigValidator.isValidModelFormat('model-name')).toBe(true);
    });

    test('should reject invalid model format', () => {
      expect(CostConfigValidator.isValidModelFormat('')).toBe(false);
      expect(CostConfigValidator.isValidModelFormat('   ')).toBe(false);
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

      expect(models).toContain('gpt-4');
      expect(models).toContain('claude-3-haiku');
      expect(models).toContain('claude-3.5-sonnet');
      // Note: Models from Providers section are no longer extracted
    });

    test('should handle missing router configuration', () => {
      const models = CostConfigValidator.extractRouterModels({});
      expect(models.size).toBe(0);
    });

    test('should handle partial router configuration', () => {
      const partialConfig = {
        Router: {
          default: 'gpt-4'
        }
      };

      const models = CostConfigValidator.extractRouterModels(partialConfig);
      expect(models).toContain('gpt-4');
    });
  });

  describe('findMissingPricing', () => {
    test('should find models missing pricing', () => {
      const routerModels = new Set(['gpt-4', 'claude-3.5-sonnet', 'claude-3-haiku']);
      const modelPricing = {
        'gpt-4': {
          input_cost_per_million: 2.50,
          output_cost_per_million: 10.00
        }
      };

      const missing = CostConfigValidator.findMissingPricing(routerModels, modelPricing);

      expect(missing).toContain('claude-3.5-sonnet');
      expect(missing).toContain('claude-3-haiku');
      expect(missing).not.toContain('gpt-4');
    });

    test('should return empty array when all models have pricing', () => {
      const routerModels = new Set(['gpt-4']);
      const modelPricing = {
        'gpt-4': {
          input_cost_per_million: 2.50,
          output_cost_per_million: 10.00
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
          'gpt-4': {
            input_cost_per_million: 2.50,
            output_cost_per_million: 10.00
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
          'gpt-4': {
            input_cost_per_million: 2.50,
            output_cost_per_million: 10.00,
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

      expect(result.model_pricing['gpt-4'].currency).toBe('USD');
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
          'gpt-4': {
            input_cost_per_million: 3.00, // Overwrites the original value
            output_cost_per_million: 12.00
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
          'gpt-4': {
            input_cost_per_million: 2.50,
            output_cost_per_million: 10.00,
            currency: 'EUR'
          },
          'claude-3.5-sonnet': {
            input_cost_per_million: 3.00,
            output_cost_per_million: 15.00,
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
          'gpt-4': {
            input_cost_per_million: -1.0, // Invalid negative value
            output_cost_per_million: -2.0 // Invalid negative value
          }
        }
      };

      const result = CostConfigValidator.validateCostConfig(invalidPricingConfig, mockRouterConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid input pricing for gpt-4: can\'t be negative');
      expect(result.errors).toContain('Invalid output pricing for gpt-4: can\'t be negative');
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
          default: 'gpt-4'
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
          'gpt-4': {
            input_cost_per_million: 0,
            output_cost_per_million: 0
          }
        }
      };

      const result = CostConfigValidator.validateCostConfig(zeroPricingConfig, mockRouterConfig);
      expect(result.isValid).toBe(true); // Zero values are now allowed
    });

    test('should validate configuration with very small pricing values', () => {
      const smallPricingConfig: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          'gpt-4': {
            input_cost_per_million: 0.0001,
            output_cost_per_million: 0.0005
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
          'gpt-4': {
            input_cost_per_million: 1000000,
            output_cost_per_million: 5000000
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
        'gpt-4',
        'claude-3.5-sonnet',
        'gemini-pro',
        'gpt-35-turbo',
        'claude-v2',
        '@model-name',
        'model_name',
        'model.name'
      ];

      validModels.forEach(model => {
        expect(CostConfigValidator.isValidModelFormat(model)).toBe(true);
      });
    });

    test('should reject invalid model formats', () => {
      const invalidModels = [
        '',
        '   ',
        'model with spaces',
        'model*invalid'
      ];

      invalidModels.forEach(model => {
        expect(CostConfigValidator.isValidModelFormat(model)).toBe(false);
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
            input_cost_per_million: 2.50,
            output_cost_per_million: 10.00
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
        missingPricing: ['claude-3.5-sonnet', 'gpt-4'],
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
      expect(consoleWarnSpy).toHaveBeenCalledWith('  • claude-3.5-sonnet');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  • gpt-4');
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
          'gpt-4': {
            input_cost_per_million: -1.0,
            output_cost_per_million: -2.0
          }
        }
      };

      const options: UserConfirmationOptions = {
        continueWithErrors: false,
        continueWithMissingPricing: false,
        useDefaultCurrency: false
      };

      // Mock stdin to provide ENTER input when prompted
      const stdinMock = jest.spyOn(process.stdin, 'once').mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          // Simulate ENTER key press (empty string)
          setTimeout(() => callback('\n'), 0);
        }
        return process.stdin;
      });

      try {
        const result = await CostConfigValidator.validateAndInitializeCostConfig(
          invalidConfig,
          mockRouterConfig,
          options
        );

        expect(result.enabled).toBe(false);
        expect(consoleWarnSpy).toHaveBeenCalledWith('Cost tracking disabled due to configuration issues.');
      } finally {
        stdinMock.mockRestore();
      }
    });

    test('should fix currency issues when useDefaultCurrency is true', async () => {
      const configWithInvalidCurrency: CostTrackingConfig = {
        ...validConfig,
        model_pricing: {
          ...validConfig.model_pricing,
          'gpt-4': {
            input_cost_per_million: 2.50,
            output_cost_per_million: 10.00,
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

      expect(result.model_pricing['gpt-4'].currency).toBe('USD');
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
          'gpt-4': {
            input_cost_per_million: 2.50,
            output_cost_per_million: 10.00,
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
      expect(result.model_pricing['gpt-4'].currency).toBe('USD');
    });
  });
});