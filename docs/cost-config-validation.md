# Cost Configuration Validation System

## Overview

The Cost Configuration Validation System provides comprehensive validation and user prompting for cost tracking configuration in Claude Code Router. It ensures proper model pricing setup and graceful degradation on validation failures.

## Features

- **Model Format Validation**: Ensures model names follow the `<provider>,<model>` format
- **Pricing Value Validation**: Validates that pricing values are positive numbers
- **Currency Validation**: Supports 30+ ISO 4217 currency codes with automatic fallback to USD
- **Router Model Extraction**: Automatically extracts models from router configuration for missing pricing detection
- **User Prompting**: Interactive user confirmation for critical configuration issues
- **Graceful Degradation**: Disables cost tracking gracefully when validation fails

## Usage

### Basic Validation

```typescript
import { CostConfigValidator } from '../src/config/costConfig';
import { CostTrackingConfig } from '../src/types/cost';

const config: CostTrackingConfig = {
  enabled: true,
  default_currency: 'USD',
  model_pricing: {
    'openai,gpt-4': {
      input_tokens_per_million: 2.50,
      output_tokens_per_million: 10.00,
      currency: 'USD'
    }
  }
};

const routerConfig = {
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

const validationResult = CostConfigValidator.validateCostConfig(config, routerConfig);

if (validationResult.isValid) {
  console.log('Configuration is valid!');
} else {
  console.log('Configuration has errors:', validationResult.errors);
}
```

### User Prompting and Initialization

```typescript
import { validateAndInitializeCostConfig } from '../src/config/costConfig';

const options = {
  continueWithErrors: false,
  continueWithMissingPricing: false,
  useDefaultCurrency: true
};

const validatedConfig = await validateAndInitializeCostConfig(config, routerConfig, options);
```

## Validation Rules

### Critical Errors (Blocking)

- **Invalid model format**: Model names must follow `<provider>,<model>` format
- **Negative pricing**: Input and output token pricing must be positive numbers

### Warnings (Non-blocking)

- **Unsupported currency**: Currency codes not in the supported list will trigger warnings
- **Missing pricing**: Models used in router but missing pricing configuration

### User Confirmation Logic

- **Critical errors**: User must confirm to continue or cost tracking is disabled
- **Missing pricing warnings**: User must confirm to continue with partial tracking
- **Non-critical warnings**: Logged only, no user prompt needed

## Supported Currencies

The system supports the following ISO 4217 currency codes:

- **Major currencies**: USD, EUR, GBP, JPY, CNY, CAD, AUD, CHF
- **Asian currencies**: HKD, SGD, KRW, IDR, THB, MYR, PHP, VND
- **European currencies**: SEK, NOK, DKK, PLN, CZK, HUF, RON, BGN
- **Other currencies**: TRY, RUB, BRL, MXN, INR, ZAR

## API Reference

### CostConfigValidator Class

#### Static Methods

- `validateCostConfig(config: CostTrackingConfig, routerConfig: any): ValidationResult`
  - Validates cost configuration against router configuration
  - Returns validation result with errors, warnings, and missing pricing

- `validateAndInitializeCostConfig(config: CostTrackingConfig, routerConfig: any, options: UserConfirmationOptions): Promise<CostTrackingConfig>`
  - Validates and initializes cost configuration with user interaction
  - Returns validated and potentially modified configuration

- `promptUserForConfirmation(validationResult: ValidationResult, options: UserConfirmationOptions): Promise<boolean>`
  - Prompts user for confirmation on validation issues
  - Returns whether user confirmed to continue

- `isValidModelFormat(model: string): boolean`
  - Checks if model name follows correct format

- `isValidCurrency(currency: string): boolean`
  - Checks if currency code is supported

- `extractRouterModels(routerConfig: any): Set<string>`
  - Extracts all models used in router configuration

- `findMissingPricing(routerModels: Set<string>, modelPricing: Record<string, ModelPricing>): string[]`
  - Finds models that are used in router but missing pricing

- `mergeWithDefaults(userConfig: Partial<CostTrackingConfig>): CostTrackingConfig`
  - Merges user configuration with defaults

### Convenience Functions

- `validateCostConfig(config: CostTrackingConfig, routerConfig: any): ValidationResult`
- `validateAndInitializeCostConfig(config: CostTrackingConfig, routerConfig: any, options: UserConfirmationOptions): Promise<CostTrackingConfig>`

## Types

### ValidationResult

```typescript
interface ValidationResult {
  errors: string[];           // Critical errors
  warnings: string[];         // Non-critical warnings
  missingPricing: string[];   // Models missing pricing
  isValid: boolean;           // Whether validation passed
}
```

### UserConfirmationOptions

```typescript
interface UserConfirmationOptions {
  continueWithErrors: boolean;           // Continue despite critical errors
  continueWithMissingPricing: boolean;   // Continue with missing pricing
  useDefaultCurrency: boolean;           // Use default currency for unsupported currencies
}
```

## Examples

### Example Configuration

```json
{
  "CostTracking": {
    "enabled": true,
    "default_currency": "USD",
    "model_pricing": {
      "openai,gpt-4": {
        "input_tokens_per_million": 2.5,
        "output_tokens_per_million": 10.0,
        "currency": "USD"
      },
      "anthropic,claude-3.5-sonnet": {
        "input_tokens_per_million": 3.0,
        "output_tokens_per_million": 15.0,
        "currency": "USD"
      }
    }
  }
}
```

### Integration with Router Startup

```typescript
import { validateAndInitializeCostConfig } from '../src/config/costConfig';

async function initializeRouter() {
  const routerConfig = await loadRouterConfig();
  const costConfig = await loadCostConfig();

  const options = {
    continueWithErrors: false,
    continueWithMissingPricing: true,
    useDefaultCurrency: true
  };

  const validatedCostConfig = await validateAndInitializeCostConfig(
    costConfig,
    routerConfig,
    options
  );

  if (validatedCostConfig.enabled) {
    const costCalculator = new CostCalculator(validatedCostConfig);
    // Initialize router with cost tracking
  } else {
    // Initialize router without cost tracking
  }
}
```

## Testing

The validation system includes comprehensive unit tests covering:

- Model format validation
- Pricing value validation
- Currency validation
- Router model extraction
- Missing pricing detection
- User prompting scenarios

Run tests with:

```bash
pnpm test tests/config/costConfig.test.ts
```

## Best Practices

1. **Always validate configuration** before initializing cost tracking
2. **Use user prompting** in interactive environments
3. **Handle validation failures gracefully** by disabling cost tracking
4. **Provide clear error messages** to help users fix configuration issues
5. **Test with your specific router configuration** to ensure all models are covered