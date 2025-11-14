/**
 * Demonstration script for cost configuration validation system
 *
 * This script shows how to use the CostConfigValidator class to validate
 * cost tracking configuration and handle user prompting for issues.
 */

import {
  CostConfigValidator,
  validateAndInitializeCostConfig,
  UserConfirmationOptions
} from '../src/config/costConfig';
import { CostTrackingConfig } from '../src/types/cost';

// Example router configuration
const routerConfig = {
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

// Example configurations to demonstrate validation

// Valid configuration
const validConfig: CostTrackingConfig = {
  enabled: true,
  default_currency: 'USD',
  model_pricing: {
    'openai,gpt-4': {
      input_cost_per_million: 2.50,
      output_cost_per_million: 10.00,
      currency: 'USD'
    },
    'anthropic,claude-3.5-sonnet': {
      input_cost_per_million: 3.00,
      output_cost_per_million: 15.00,
      currency: 'USD'
    },
    'anthropic,claude-3-haiku': {
      input_cost_per_million: 0.25,
      output_cost_per_million: 1.25,
      currency: 'USD'
    }
  }
};

// Configuration with errors
const configWithErrors: CostTrackingConfig = {
  enabled: true,
  default_currency: 'USD',
  model_pricing: {
    'invalid-model-format': {
      input_cost_per_million: 1.0,
      output_cost_per_million: 2.0
    },
    'openai,gpt-4': {
      input_cost_per_million: -1.0,
      output_cost_per_million: -2.0
    }
  }
};

// Configuration with warnings
const configWithWarnings: CostTrackingConfig = {
  enabled: true,
  default_currency: 'USD',
  model_pricing: {
    'openai,gpt-4': {
      input_cost_per_million: 2.50,
      output_cost_per_million: 10.00,
      currency: 'XYZ' // Unsupported currency
    }
  }
};

// Configuration with missing pricing
const configWithMissingPricing: CostTrackingConfig = {
  enabled: true,
  default_currency: 'USD',
  model_pricing: {
    'openai,gpt-4': {
      input_cost_per_million: 2.50,
      output_cost_per_million: 10.00
    }
    // Missing pricing for anthropic,claude-3-haiku and anthropic,claude-3.5-sonnet
  }
};

// User confirmation options
const strictOptions: UserConfirmationOptions = {
  continueWithErrors: false,
  continueWithMissingPricing: false,
  useDefaultCurrency: false
};

const lenientOptions: UserConfirmationOptions = {
  continueWithErrors: true,
  continueWithMissingPricing: true,
  useDefaultCurrency: true
};

async function demonstrateValidation() {
  console.log('=== Cost Configuration Validation Demo ===\n');

  // Demo 1: Valid configuration
  console.log('1. Valid Configuration:');
  const result1 = await validateAndInitializeCostConfig(validConfig, routerConfig, strictOptions);
  console.log(`   Result: ${result1.enabled ? '✅ Cost tracking enabled' : '❌ Cost tracking disabled'}`);
  console.log(`   Models configured: ${Object.keys(result1.model_pricing).length}\n`);

  // Demo 2: Configuration with errors (strict mode)
  console.log('2. Configuration with Errors (Strict Mode):');
  const result2 = await validateAndInitializeCostConfig(configWithErrors, routerConfig, strictOptions);
  console.log(`   Result: ${result2.enabled ? '✅ Cost tracking enabled' : '❌ Cost tracking disabled'}`);
  console.log(`   Models configured: ${Object.keys(result2.model_pricing).length}\n`);

  // Demo 3: Configuration with errors (lenient mode)
  console.log('3. Configuration with Errors (Lenient Mode):');
  const result3 = await validateAndInitializeCostConfig(configWithErrors, routerConfig, lenientOptions);
  console.log(`   Result: ${result3.enabled ? '✅ Cost tracking enabled' : '❌ Cost tracking disabled'}`);
  console.log(`   Models configured: ${Object.keys(result3.model_pricing).length}\n`);

  // Demo 4: Configuration with warnings
  console.log('4. Configuration with Warnings:');
  const result4 = await validateAndInitializeCostConfig(configWithWarnings, routerConfig, lenientOptions);
  console.log(`   Result: ${result4.enabled ? '✅ Cost tracking enabled' : '❌ Cost tracking disabled'}`);
  console.log(`   Models configured: ${Object.keys(result4.model_pricing).length}`);
  console.log(`   Currency fixed: ${result4.model_pricing['openai,gpt-4'].currency === 'USD' ? '✅' : '❌'}\n`);

  // Demo 5: Configuration with missing pricing
  console.log('5. Configuration with Missing Pricing:');
  const result5 = await validateAndInitializeCostConfig(configWithMissingPricing, routerConfig, lenientOptions);
  console.log(`   Result: ${result5.enabled ? '✅ Cost tracking enabled' : '❌ Cost tracking disabled'}`);
  console.log(`   Models configured: ${Object.keys(result5.model_pricing).length}\n`);

  // Demo 6: Model format validation
  console.log('6. Model Format Validation:');
  const validModels = ['openai,gpt-4', 'anthropic,claude-3.5-sonnet'];
  const invalidModels = ['invalid', 'provider,', ',model'];

  console.log('   Valid models:');
  validModels.forEach(model => {
    console.log(`     ${model}: ${CostConfigValidator.isValidModelFormat(model) ? '✅' : '❌'}`);
  });

  console.log('   Invalid models:');
  invalidModels.forEach(model => {
    console.log(`     ${model}: ${CostConfigValidator.isValidModelFormat(model) ? '✅' : '❌'}`);
  });

  console.log('\n=== Demo Complete ===');
}

// Run the demonstration
if (require.main === module) {
  demonstrateValidation().catch(console.error);
}

export { demonstrateValidation };