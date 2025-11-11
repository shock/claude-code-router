# Session Cost Tracking Implementation Master Plan

## Objective

**Primary Goal:** Implement real-time cost tracking for Claude Code Router sessions by calculating accumulated costs based on token usage across different models.

**Value Proposition:**
- **Real-time Cost Awareness**: Users can monitor session costs as they interact with models
- **Per-Model Cost Breakdown**: Understand which models contribute most to session costs
- **Configurable Pricing**: Support for custom model pricing using `<provider>,<model>` format
- **Status Line Integration**: Display costs in the status line with customizable formatting
- **Session-Level Tracking**: Track costs per session with automatic reset on new conversations

## Core Guiding Principles

### Preservation of Existing Behavior

**Fundamental Rule:** The cost tracking feature must integrate seamlessly without disrupting existing functionality. This ensures:

- **No Interference**: Existing token tracking and API response handling continues working normally
- **Performance Stability**: No degradation in request processing speed
- **UI Consistency**: Status line integration follows existing patterns
- **Backward Compatibility**: All existing configurations continue to work

### Backward Compatibility

- **Existing configurations must work without changes** - Cost tracking is opt-in via configuration
- **No breaking changes** to current router functionality
- **Graceful degradation** when cost tracking is disabled or misconfigured
- **Error resilience** - comprehensive error handling with fallback to disabled state

## Current Architecture Analysis

### Existing Token Tracking Architecture

The router already tracks token usage from API responses. We need to:
- Hook into existing token capture points
- Access model information from routing decisions
- Integrate with session management

### Status Line Architecture

The status line system already supports:
- Multiple module types
- Variable substitution
- Custom formatting
- Color and icon configuration

### Configuration System

The router uses a JSON configuration file with:
- Provider configurations
- Routing rules
- Status line settings
- Will need to extend with cost tracking configuration

## Proposed Architecture

### File Organization and Component Overview

**New File Structure:**
- `src/utils/costCalculator.ts` - Core cost calculation service (consistent with existing utils pattern)
- `src/utils/costStatusLineProvider.ts` - Status line variable provider for costs
- `src/types/cost.ts` - Type definitions for cost tracking
- `src/config/costConfig.ts` - Cost configuration validation and parsing
- `tests/utils/costCalculator.test.ts` - Unit tests for cost calculator
- `tests/utils/costStatusLineProvider.test.ts` - Unit tests for status line provider

**Modified Files:**
- `ui/src/types.ts` - Extend configuration schema with cost tracking
- `src/utils/sessionManager.ts` - Integrate cost tracking with session management
- `src/utils/statusline.ts` - Add cost module type
- `src/index.ts` - Initialize cost tracking service

**Core Components:**

**CostCalculator Service** - Core cost calculation:
- Located in `src/utils/costCalculator.ts` (consistent with existing utils pattern)
- Inherits from existing service patterns
- Uses separate LRU cache with same capacity as `sessionUsageCache` for consistency
- Calculates costs from token counts using model-specific pricing
- Maintains session-level cost accumulation using existing session ID patterns
- Provides cost data to status line and other consumers

**CostStatusLineProvider** - Status line integration:
- Located in `src/utils/costStatusLineProvider.ts` (consistent with existing utils pattern)
- Implements status line variable provider interface
- Provides cost variables for template substitution
- Handles formatting and display options

### Configuration Integration

**Cost Tracking Configuration:**
```json
{
  "CostTracking": {
    "enabled": true,
    "default_currency": "USD",
    "model_pricing": {
      "openai,gpt-4.1": {
        "input_tokens_per_million": 2.50,
        "output_tokens_per_million": 10.00
      }
    }
  }
}
```

**Status Line Configuration:**
```json
{
  "StatusLine": {
    "default": {
      "modules": [
        {
          "type": "cost",
          "icon": "💵",
          "text": "{{totalCost}}",
          "color": "bright_green"
        }
      ]
    }
  }
}
```

### Integration Strategy

**Token Capture Integration:**
- Hook into existing API response processing
- Extract token counts and model information
- Pass to cost calculator for cost calculation

**Session Management Integration:**
- **Follow existing token tracking patterns** - use same session ID keys as `sessionUsageCache`
- **No complex session events needed** - existing LRU cache handles lifecycle automatically
- **Session IDs extracted from metadata** - follow pattern from `src/utils/router.ts:185-190`
- **Simplified approach** - cost tracking follows exact same pattern as token usage tracking

**Status Line Integration:**
- Register cost status line provider
- Support cost module type with template variables
- Handle formatting and display options

## Implementation Steps

### Testing Strategy

**Integrated Testing Approach for Confidence at Each Step:**

1. **Pre-implementation**: Verify existing functionality baseline
2. **During each phase**: Unit tests for new methods + integration tests for completed components
3. **Post-implementation**: Comprehensive regression testing and manual validation

**Testing Framework:**
- **Unit Tests**: Individual component testing with mocked dependencies
- **Mock Tests**: Controlled testing with mocked token data and pricing
- **Integration Tests**: Testing component interactions and status line integration
- **Regression Tests**: Ensuring existing functionality remains unchanged
- **Manual QA**: Real-world testing with live router

**Phase-by-Phase Testing Requirements:**
- **Phase 0**: Baseline verification tests for existing router functionality; Configuration validation tests
- **Phase 1**: Unit tests for cost calculation logic; Configuration parsing and validation tests
- **Phase 2**: Unit tests for session cost storage; Integration tests with session management
- **Phase 3**: Unit tests for status line provider; Mock tests with status line variables
- **Phase 4**: Integration tests for token capture integration; End-to-end tests with stubbed API responses
- **Phase 5**: Status line integration tests; Manual testing with live status line
- **Phase 6**: Comprehensive unit tests for full cost tracking functionality; End-to-end integration testing
- **Phase 7**: Final regression tests running complete test suite; Documentation review

Testing is integrated throughout each phase to ensure functionality confidence at every step.

### Phase 0: Foundational Analysis and Setup

1. **Analyze Current Architecture**
   - Verify token capture points in API response processing
   - Confirm session management patterns
   - Document existing status line architecture
   - Identify integration points for cost tracking

2. **Establish Baseline Tests**
   - Ensure existing router tests pass
   - Document current status line behavior
   - Verify configuration loading patterns

3. **Configuration Schema Extension**
   - Extend configuration schema with CostTracking section
   - Add model_pricing validation using `<provider>,<model>` format
   - Support default_currency configuration
   - Implement configuration validation rules

4. **Test Infrastructure Setup**
   - **Test Framework Setup**: Initialize Jest test framework with TypeScript support
   ```bash
   npm install --save-dev jest @types/jest ts-jest
   ```
   - **Test Configuration**: Create `jest.config.js` with TypeScript support:
   ```javascript
   module.exports = {
     preset: 'ts-jest',
     testEnvironment: 'node',
     testMatch: ['**/tests/**/*.test.ts'],
     collectCoverageFrom: ['src/**/*.ts'],
     coverageDirectory: 'coverage',
     coverageReporters: ['text', 'lcov', 'html']
   };
   ```
   - **Test Directory Structure**: Create organized test structure:
   ```
   tests/
   ├── utils/
   │   ├── costCalculator.test.ts
   │   └── costStatusLineProvider.test.ts
   ├── integration/
   │   └── costTracking.test.ts
   └── fixtures/
       └── testConfig.json
   ```
   - **Test Scripts**: Add test scripts to `package.json`:
   ```json
   {
     "scripts": {
       "test": "jest",
       "test:watch": "jest --watch",
       "test:coverage": "jest --coverage"
     }
   }
   ```
   - **Baseline Verification**: Run existing tests to establish baseline performance
   - **Test Utilities**: Create test utilities and fixtures for cost tracking scenarios

### Phase 1: Core Cost Calculation Service

1. **Create Cost Types**
   - Create `src/types/cost.ts` with type definitions:
   ```typescript
   interface ModelPricing {
     input_tokens_per_million: number;
     output_tokens_per_million: number;
     currency?: string;
   }

   interface SessionCostData {
     sessionId: string;
     startTime: Date;
     totalCost: number;
     modelCosts: {
       [modelName: string]: {
         inputTokens: number;
         outputTokens: number;
         inputCost: number;
         outputCost: number;
         totalCost: number;
       };
     };
     currency: string;
   }

   interface CostTrackingConfig {
     enabled: boolean;
     default_currency: string;
     model_pricing: Record<string, ModelPricing>;
   }
   ```

2. **Implement CostCalculator Service**
   - Create `src/utils/costCalculator.ts`
   - Implement cost calculation logic integrated with existing `sessionUsageCache`:
   ```typescript
   import { sessionUsageCache } from './cache';

   class CostCalculator {
     private config: CostTrackingConfig;
     private costCache: LRUCache<string, SessionCostData>;
     private calculationCache: Map<string, number>; // Cache for cost calculations

     constructor(config: CostTrackingConfig) {
       this.config = config;
       // Use same capacity as sessionUsageCache for consistency
       this.costCache = new LRUCache<string, SessionCostData>(100);
       // Cache for cost calculations to avoid redundant calculations
       this.calculationCache = new Map<string, number>();
     }

     calculateCost(
       sessionId: string,
       model: string,
       inputTokens: number,
       outputTokens: number
     ): number {
       const pricing = this.config.model_pricing[model];
       if (!pricing) {
         // Return 0 cost for unconfigured models (no runtime warnings)
         return 0;
       }

       // Check calculation cache first
       const cacheKey = `${sessionId}:${model}:${inputTokens}:${outputTokens}`;
       const cachedCost = this.calculationCache.get(cacheKey);
       if (cachedCost !== undefined) {
         return cachedCost;
       }

       const inputCost = (inputTokens * pricing.input_tokens_per_million) / 1000000;
       const outputCost = (outputTokens * pricing.output_tokens_per_million) / 1000000;
       const totalCost = inputCost + outputCost;

       // Cache the calculation
       this.calculationCache.set(cacheKey, totalCost);

       // Limit calculation cache size to prevent memory leaks
       if (this.calculationCache.size > 1000) {
         const firstKey = this.calculationCache.keys().next().value;
         if (firstKey) {
           this.calculationCache.delete(firstKey);
         }
       }

       this.updateSessionCost(sessionId, model, inputTokens, outputTokens, totalCost);
       return totalCost;
     }

     private updateSessionCost(
       sessionId: string,
       model: string,
       inputTokens: number,
       outputTokens: number,
       cost: number
     ): void {
       // Get existing session cost or create new one
       let sessionCost = this.costCache.get(sessionId);
       if (!sessionCost) {
         sessionCost = {
           sessionId,
           startTime: new Date(),
           totalCost: 0,
           modelCosts: {},
           currency: this.config.default_currency || 'USD'
         };
       }

       // Update model-specific costs
       if (!sessionCost.modelCosts[model]) {
         sessionCost.modelCosts[model] = {
           inputTokens: 0,
           outputTokens: 0,
           inputCost: 0,
           outputCost: 0,
           totalCost: 0
         };
       }

       const modelCost = sessionCost.modelCosts[model];
       modelCost.inputTokens += inputTokens;
       modelCost.outputTokens += outputTokens;
       modelCost.inputCost += (inputTokens * this.config.model_pricing[model].input_tokens_per_million) / 1000000;
       modelCost.outputCost += (outputTokens * this.config.model_pricing[model].output_tokens_per_million) / 1000000;
       modelCost.totalCost = modelCost.inputCost + modelCost.outputCost;

       // Update total session cost
       sessionCost.totalCost += cost;

       // Store in cache using same session ID as sessionUsageCache
       this.costCache.put(sessionId, sessionCost);
     }

     getSessionCost(sessionId: string): SessionCostData | undefined {
       return this.costCache.get(sessionId);
     }

     resetSession(sessionId: string): void {
       this.costCache.put(sessionId, {
         sessionId,
         startTime: new Date(),
         totalCost: 0,
         modelCosts: {},
         currency: this.config.default_currency || 'USD'
       });
     }

     // Performance monitoring methods
     getCacheStats(): { costCacheSize: number; calculationCacheSize: number } {
       return {
         costCacheSize: this.costCache.size(),
         calculationCacheSize: this.calculationCache.size
       };
     }

     // Add size method to LRUCache for performance monitoring
     // In src/utils/cache.ts, add to LRUCache class:
     // size(): number {
     //   return this.cache.size;
     // }

     clearCalculationCache(): void {
       this.calculationCache.clear();
     }
   }
   ```

3. **Implement Configuration Validation with User Prompting**
   - Create `src/config/costConfig.ts` with comprehensive validation and user prompting:
   ```typescript
   // src/config/costConfig.ts
   interface ValidationResult {
     errors: string[];
     warnings: string[];
     missingPricing: string[];
   }

   interface CostTrackingConfig {
     enabled?: boolean;
     default_currency?: string;
     model_pricing?: Record<string, ModelPricing>;
   }

   class CostConfigValidator {
     static validateCostConfig(config: CostTrackingConfig, routerConfig: any): ValidationResult {
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

       // Validate default currency
       if (config.default_currency && !this.isValidCurrency(config.default_currency)) {
         warnings.push(`Unsupported default currency "${config.default_currency}", using USD`);
       }

       // Check for missing pricing on router-used models
       if (config.enabled && routerConfig) {
         const routerModels = this.extractRouterModels(routerConfig);
         missingPricing.push(...this.findMissingPricing(routerModels, config.model_pricing || {}));
       }

       return { errors, warnings, missingPricing };
     }

     static extractRouterModels(routerConfig: any): Set<string> {
       const routerModels = new Set<string>();
       const routerFields = ['default', 'background', 'think', 'longContext', 'webSearch'];

       routerFields.forEach(field => {
         if (routerConfig[field]) {
           routerModels.add(routerConfig[field]);
         }
       });

       return routerModels;
     }

     static findMissingPricing(routerModels: Set<string>, modelPricing: Record<string, any>): string[] {
       return Array.from(routerModels).filter(model => !modelPricing[model]);
     }

     static isValidModelFormat(model: string): boolean {
       return /^[^,]+,[^,]+$/.test(model);
     }

     static isValidCurrency(currency: string): boolean {
       const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY'];
       return validCurrencies.includes(currency.toUpperCase());
     }

     static async promptUserForConfirmation(validation: ValidationResult): Promise<boolean> {
       if (validation.errors.length > 0 || validation.missingPricing.length > 0) {
         console.warn('\n=== Cost Tracking Configuration Issues ===');

         if (validation.errors.length > 0) {
           console.error('Configuration errors:');
           validation.errors.forEach(error => console.error(`  - ${error}`));
         }

         if (validation.missingPricing.length > 0) {
           console.warn(`Missing pricing for ${validation.missingPricing.length} router models:`);
           validation.missingPricing.forEach(model => {
             console.warn(`  - ${model}: Cost will be 0`);
           });
         }

         console.warn('\nPress Enter to continue with cost tracking disabled, or Ctrl+C to exit and fix configuration...');

         try {
           const readline = require('readline');
           const rl = readline.createInterface({
             input: process.stdin,
             output: process.stdout
           });

           return new Promise((resolve) => {
             rl.question('', () => {
               rl.close();
               resolve(false); // Disable cost tracking
             });
           });
         } catch (error) {
           console.error('Error reading user input, disabling cost tracking');
           return false;
         }
       }

       return true; // No issues, enable cost tracking
     }
   }

   // Integration with existing config loading
   export async function validateAndInitializeCostConfig(config: any): Promise<CostTrackingConfig> {
     const costConfig = config.CostTracking || {};

     // Apply defaults
     const validatedConfig: CostTrackingConfig = {
       enabled: costConfig.enabled ?? false,
       default_currency: costConfig.default_currency || 'USD',
       model_pricing: costConfig.model_pricing || {}
     };

     // Only validate if cost tracking is enabled
     if (validatedConfig.enabled) {
       // Validate configuration
       const validation = CostConfigValidator.validateCostConfig(validatedConfig, config.Router);

       // Log non-critical warnings
       if (validation.warnings.length > 0) {
         console.warn('Cost tracking configuration warnings:');
         validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
       }

       // Handle critical issues with user prompting
       if (validation.errors.length > 0 || validation.missingPricing.length > 0) {
         const shouldEnable = await CostConfigValidator.promptUserForConfirmation(validation);
         validatedConfig.enabled = shouldEnable;

         if (!shouldEnable) {
           console.warn('Cost tracking disabled due to configuration issues');
         }
       }
     }

     return validatedConfig;
   }
   ```
   - **Validation Rules**:
     - Model names must use `<provider>,<model>` format
     - Pricing values must be positive numbers
     - Currency codes must be valid ISO 4217 codes
     - All configuration fields are optional with sensible defaults
   - **User Prompting Logic**:
     - **Critical errors** (invalid model format, negative pricing): User must confirm to continue
     - **Missing pricing warnings**: User must confirm to continue with partial tracking
     - **Non-critical warnings** (unsupported currencies): Log only, no user prompt needed
     - **Blocking behavior**: Router startup waits for user input on critical issues
   - **Error Handling**:
     - User must explicitly confirm to continue with configuration issues
     - Cost tracking disabled by default on critical errors unless user confirms
     - Never block router startup entirely due to cost configuration issues

4. **Implement Configuration Integration**
   - **Configuration Loading Integration**: Extend existing config loading in `src/utils/index.ts`:
   ```typescript
   // In src/utils/index.ts - extend existing config loading
   import { validateAndInitializeCostConfig } from './config/costConfig';

   export async function loadConfig(): Promise<RouterConfig> {
     // ... existing config loading logic ...

     // Validate and initialize cost tracking configuration (async for user prompting)
     const costTrackingConfig = await validateAndInitializeCostConfig(config);

     return {
       ...config,
       CostTracking: costTrackingConfig
     };
   }
   ```

   - **Router Initialization Integration**: Initialize cost calculator during router startup:
   ```typescript
   // In src/index.ts - during router initialization
   import { loadConfig } from './utils';
   import { CostCalculator } from './utils/costCalculator';
   import { CostStatusLineProvider } from './utils/costStatusLineProvider';

   // Load configuration with cost tracking (async for user prompting)
   const config = await loadConfig();
   const costTrackingConfig = config.CostTracking;

   // Initialize cost calculator if enabled
   let costCalculator: CostCalculator | null = null;
   if (costTrackingConfig.enabled) {
     costCalculator = new CostCalculator(costTrackingConfig);

     // Register status line provider
     const costStatusLineProvider = new CostStatusLineProvider(costCalculator);
     registerCostStatusLineProvider(costStatusLineProvider);
   }
   ```

   - **Configuration Schema Integration**: Extend existing configuration schema:
   ```typescript
   // In ui/src/types.ts - extend the main Config interface (line 52)
   // Current schema location: ui/src/types.ts (confirmed exists)

   interface Config {
     // ... existing configuration fields ...
     Providers: Provider[];
     Router: RouterConfig;
     transformers: Transformer[];
     StatusLine?: StatusLineConfig;
     // Add cost tracking configuration
     CostTracking?: CostTrackingConfig;
   }

   interface CostTrackingConfig {
     enabled?: boolean;
     default_currency?: string;
     model_pricing?: Record<string, ModelPricing>;
   }

   interface ModelPricing {
     input_tokens_per_million: number;
     output_tokens_per_million: number;
     currency?: string;
   }
   ```
   - **Schema Location Solution**:
     - Extend the main `Config` interface in `ui/src/types.ts` (line 52) to add `CostTracking?: CostTrackingConfig;`
     - This is the primary configuration schema used throughout the system
     - The `Config` interface already includes all top-level configuration sections (Providers, Router, transformers, StatusLine, etc.)
     - This ensures consistency with existing configuration patterns

   - **Error Handling Integration**: Ensure graceful degradation:
   ```typescript
   // In src/utils/index.ts - integrate with existing error handling
   export function loadConfig(): RouterConfig {
     try {
       // ... existing config loading ...
       const costTrackingConfig = validateAndInitializeCostConfig(config);

       return {
         ...config,
         CostTracking: costTrackingConfig
       };
     } catch (error) {
       // Log error but don't fail - router should continue with default configuration
       console.error('Error loading cost tracking configuration:', error);

       // Return config with cost tracking disabled
       return {
         ...config,
         CostTracking: {
           enabled: false,
           default_currency: 'USD',
           model_pricing: {}
         }
       };
     }
   }
   ```

### Phase 2: Session Cost Storage and Management

1. **Extend Session Management**
   - Integrate cost calculator with existing session management
   - Associate costs with session IDs using existing `sessionUsageCache` patterns
   - Implement session reset behavior
   - Add session cost persistence leveraging existing LRU cache infrastructure

2. **Implement Session Cost Storage**
   - **Leverage existing `sessionUsageCache` infrastructure** instead of creating new storage
   - Extend the existing cache to store cost data alongside token usage
   - Store per-model cost breakdowns using the same session ID keys
   - Support session duration tracking using existing session management patterns
   - Implement cost aggregation logic integrated with existing cache operations

### Phase 3: Status Line Provider Implementation

1. **Create Enhanced CostStatusLineProvider with Dynamic Model Variables**
   - Create `src/utils/costStatusLineProvider.ts` with comprehensive variable generation
   - Implement status line variable provider interface with enhanced dynamic model-specific variables:
   ```typescript
   class CostStatusLineProvider {
     private costCalculator: CostCalculator;

     constructor(costCalculator: CostCalculator) {
       this.costCalculator = costCalculator;
     }

     getCostVariables(sessionId: string): Record<string, string> {
       const sessionCost = this.costCalculator.getSessionCost(sessionId);

       if (!this.costCalculator.config.enabled) {
         return this.getDisabledVariables('Cost tracking disabled');
       }

       if (!sessionCost) {
         return this.getDisabledVariables('No usage yet');
       }

       // Always show actual costs, even if some models have zero cost due to missing pricing
       const baseVariables = this.getActiveVariables(sessionCost);
       const modelVariables = this.getModelSpecificVariables(sessionId);

       return { ...baseVariables, ...modelVariables };
     }

     private getModelSpecificVariables(sessionId: string): Record<string, string> {
       const sessionCost = this.costCalculator.getSessionCost(sessionId);
       const modelVariables: Record<string, string> = {};

       if (sessionCost && sessionCost.modelCosts) {
         // Generate variables for each model in format: cost.<provider>,<model>
         for (const [modelName, modelCost] of Object.entries(sessionCost.modelCosts)) {
           const variableName = `cost.${modelName.replace(/[^a-zA-Z0-9,]/g, '_')}`;
           modelVariables[variableName] = this.formatCurrency(modelCost.totalCost, sessionCost.currency);
         }
       }

       // Add variables for configured models (even if not used yet)
       const configuredModels = Object.keys(this.costCalculator.config.model_pricing || {});
       for (const modelName of configuredModels) {
         const variableName = `cost.${modelName.replace(/[^a-zA-Z0-9,]/g, '_')}`;
         if (!modelVariables[variableName]) {
           modelVariables[variableName] = '--';
         }
       }

       return modelVariables;
     }


     private getActiveVariables(sessionCost: SessionCostData): Record<string, string> {
       const topModel = this.getTopModel(sessionCost.modelCosts);
       const topModelCost = this.getTopModelCost(sessionCost.modelCosts);

       return {
         totalCost: this.formatCurrency(sessionCost.totalCost, sessionCost.currency),
         totalCostRaw: sessionCost.totalCost.toFixed(4),
         sessionDuration: this.formatDuration(sessionCost.startTime),
         modelCosts: JSON.stringify(sessionCost.modelCosts),
         topModel: topModel || '--',
         topModelCost: topModelCost ? this.formatCurrency(topModelCost, sessionCost.currency) : '--',
         trackingStatus: 'Active',
         statusMessage: 'Cost tracking active',
         statusColor: 'green'
       };
     }

     private getDisabledVariables(message: string): Record<string, string> {
       return {
         totalCost: message,
         totalCostRaw: '0',
         sessionDuration: '--',
         modelCosts: '{}',
         topModel: '--',
         topModelCost: '--',
         trackingStatus: 'Disabled',
         statusMessage: message,
         statusColor: 'red'
       };
     }

     private formatCurrency(amount: number, currency: string): string {
       // Implementation for currency formatting
       return new Intl.NumberFormat('en-US', {
         style: 'currency',
         currency: currency || 'USD',
         minimumFractionDigits: 4,
         maximumFractionDigits: 4
       }).format(amount);
     }

     private formatDuration(startTime: Date): string {
       // Implementation for duration formatting
       const duration = Date.now() - startTime.getTime();
       const hours = Math.floor(duration / (1000 * 60 * 60));
       const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

       if (hours > 0) {
         return `${hours}h ${minutes}m`;
       }
       return `${minutes}m`;
     }

     private getTopModel(modelCosts: Record<string, any>): string {
       let topModel = '';
       let maxCost = 0;

       for (const [modelName, costData] of Object.entries(modelCosts)) {
         if (costData.totalCost > maxCost) {
           maxCost = costData.totalCost;
           topModel = modelName;
         }
       }

       return topModel;
     }

     private getTopModelCost(modelCosts: Record<string, any>): number {
       let maxCost = 0;

       for (const costData of Object.values(modelCosts)) {
         if (costData.totalCost > maxCost) {
           maxCost = costData.totalCost;
         }
       }

       return maxCost;
     }
   }
   ```

2. **Extend Status Line System with Cost Provider Registration**
   - **Global Provider Registration**: Add global cost provider registration to `src/utils/statusline.ts`
   ```typescript
   // Global cost provider instance
   let costStatusLineProvider: CostStatusLineProvider | null = null;

   // Function to register cost provider (called during router initialization)
   export function registerCostStatusLineProvider(provider: CostStatusLineProvider): void {
     costStatusLineProvider = provider;
   }

   // Extended parseStatusLineData function with cost variable support
   export async function parseStatusLineData(input: StatusLineInput): Promise<string> {
     try {
       // ... existing status line parsing logic ...

       // Define variable replacement mapping
       const variables = {
         workDirName,
         gitBranch,
         model,
         inputTokens: formattedInputTokens,
         outputTokens: formattedOutputTokens
       };

       // Add cost variables if cost tracking is available
       if (costStatusLineProvider) {
         const costVariables = costStatusLineProvider.getCostVariables(input.session_id);
         Object.assign(variables, costVariables);
       }

       // ... rest of existing logic ...
     } catch (error) {
       return "";
     }
   }
   ```

3. **Router Initialization Integration**
   - **Provider Registration**: Register cost provider during router initialization in `src/index.ts`
   ```typescript
   // In src/index.ts - during router initialization
   if (costCalculator && costTrackingConfig.enabled) {
     const costStatusLineProvider = new CostStatusLineProvider(costCalculator);
     registerCostStatusLineProvider(costStatusLineProvider);
   }
   ```

4. **Comprehensive Error Handling and Status Display**
   - **Color-Coded Status**: Green for active, Yellow for partial, Red for disabled/error states
   - **Clear Status Messages**: "Active", "Partial (2 models unconfigured)", "Disabled", "Error"
   - **Dynamic Model Variables**: Support for `{{cost.<provider>,<model>}}` pattern with fallback values
   - **Configuration Guidance**: Include help text and examples in error messages
   - **Progressive Disclosure**: Show detailed status messages on hover or in expanded view

5. **Enhanced Variable Substitution Support**
   - The existing `replaceVariables` function in `src/utils/statusline.ts` already supports the `{{variable}}` pattern, so cost variables will automatically work with the current system. The cost provider extends the variable mapping with:
   - `{{totalCost}}` - Formatted total session cost
   - `{{totalCostRaw}}` - Raw numeric total cost
   - `{{sessionDuration}}` - Session duration
   - `{{modelCosts}}` - JSON string of per-model costs
   - `{{topModel}}` - Most expensive model used
   - `{{topModelCost}}` - Cost of most expensive model
   - `{{cost.<provider>,<model>}}` - Cost for specific model (e.g., `{{cost.openai,gpt-4}}`)
   - `{{trackingStatus}}` - Current tracking state (Active/Partial/Disabled)
   - `{{statusMessage}}` - Detailed status message
   - `{{statusColor}}` - Color indicator for status

6. **Status Line Configuration Examples**
   - **Default Configuration**: Simple cost display
   ```json
   {
     "StatusLine": {
       "default": {
         "modules": [
           {
             "type": "cost",
             "icon": "💵",
             "text": "{{totalCost}}",
             "color": "bright_green"
           },
           {
             "type": "cost",
             "icon": "📊",
             "text": "{{topModel}}: {{topModelCost}}",
             "color": "bright_yellow"
           }
         ]
       },
       "detailed": {
         "modules": [
           {
             "type": "cost",
             "icon": "💰",
             "text": "{{totalCost}} ({{trackingStatus}})",
             "color": "{{statusColor}}"
           },
           {
             "type": "cost",
             "icon": "🤖",
             "text": "{{cost.openai,gpt-4}}",
             "color": "bright_cyan"
           }
         ]
       }
     }
   }
   ```

### Phase 4: Token Capture Integration

1. **Integrate with API Response Processing**
   - Hook into existing API response handling in the `onSend` hook
   - Extract token counts from provider responses via `payload.usage`
   - Capture model information from routing decisions via `req.body.model`
   - Associate with session IDs via `req.sessionId`
   - Pass data to cost calculator asynchronously

2. **Implement Token Capture Points**
   - **Primary Integration Point**: Extend the existing `onSend` hook in `src/index.ts` (lines 374-377)
   - **Token Data Source**: `payload.usage` object containing `input_tokens` and `output_tokens`
   - **Model Information Source**: `req.body.model` set by router at line 224 in `src/utils/router.ts`
   - **Session ID Source**: `req.sessionId` extracted from `metadata.user_id` at lines 185-190 in `src/utils/router.ts`
   - **Asynchronous Processing Strategy:**
     ```typescript
     // In the onSend hook (src/index.ts line 374-377)
     server.addHook("onSend", async (req, reply, payload) => {
       event.emit('onSend', req, reply, payload);

       // Asynchronous cost calculation - don't await to avoid blocking
       if (costCalculator && req.sessionId && req.body?.model && payload?.usage) {
         process.nextTick(() => {
           try {
             const { input_tokens, output_tokens } = payload.usage;
             costCalculator.calculateCost(
               req.sessionId,
               req.body.model,
               input_tokens || 0,
               output_tokens || 0
             );
           } catch (error) {
             // Log error but don't fail the request
             console.error('Cost calculation error:', error);
           }
         });
       }

       return payload;
     })
     ```
   - **Integration with Existing Patterns**: Follow same session ID keys as `sessionUsageCache` for consistency

3. **Add Session Context**
   - Associate API responses with session IDs using existing `req.sessionId` patterns
   - Maintain session context across requests using existing session management infrastructure
   - **No explicit session reset needed** - LRU cache handles session lifecycle automatically
   - **Session boundaries** are managed implicitly through cache eviction and server restarts

### Phase 5: Status Line Integration

1. **Extend Status Line System**
   - Add "cost" module type to status line configuration
   - Register cost status line provider
   - Support cost-specific formatting options
   - Handle disabled state display

2. **Implement Cost Module**
   - Create cost module handler in status line system
   - Support template variables from cost provider
   - Handle formatting options (currency, decimal, scientific, compact)
   - Support precision configuration

3. **Update Status Line Configuration**
   - Add cost module properties to configuration schema
   - Support icon, color, text template configuration
   - Handle show_breakdown option
   - Validate cost module configuration

### Phase 6: Comprehensive Testing and Validation

1. **Create Unit Test Suite**
   - Create `tests/utils/costCalculator.test.ts`
   - Test all calculation scenarios and edge cases:
     - **Basic cost calculation**: Test with various token counts and prices
     - **Missing pricing**: Test behavior when model pricing is not configured
     - **Zero tokens**: Test calculation with zero input/output tokens
     - **Large token counts**: Test calculation with very large token counts
     - **Multiple models**: Test cost accumulation across multiple models
     - **Session management**: Test session reset and persistence
     - **Currency handling**: Test different currency configurations
     - **Error scenarios**: Test error handling and graceful degradation
   - Mock dependencies for controlled testing
   - Attempt >90% test coverage

2. **Create Status Line Provider Tests**
   - Create `tests/utils/costStatusLineProvider.test.ts`
   - Test variable generation for different scenarios:
     - **Enabled state**: Test variable generation with active session
     - **Disabled state**: Test variable generation when cost tracking is disabled
     - **Formatting**: Test currency and duration formatting
     - **Model-specific variables**: Test dynamic model cost variables
     - **Error handling**: Test variable generation during errors
   - Mock cost calculator for controlled testing

3. **Extend Integration Tests**
   - Update existing router integration tests
   - Test cost tracking integration with API responses
   - Verify status line variable substitution
   - Test configuration validation and error handling

4. **Performance Testing and Benchmarking**
   - **Performance Profiling Tests:**
     ```typescript
     // Performance test for cost calculation overhead
     describe('CostCalculator Performance', () => {
       it('should handle high-volume cost calculations efficiently', async () => {
         const calculator = new CostCalculator(config);
         const startTime = performance.now();

         // Simulate 1000 cost calculations
         for (let i = 0; i < 1000; i++) {
           calculator.calculateCost(
             `session-${i % 10}`, // 10 different sessions
             'openai,gpt-4',
             Math.floor(Math.random() * 1000),
             Math.floor(Math.random() * 1000)
           );
         }

         const endTime = performance.now();
         const totalTime = endTime - startTime;
         const avgTimePerCall = totalTime / 1000;

         // Performance requirement: < 1ms per cost calculation
         expect(avgTimePerCall).toBeLessThan(1);
       });

       it('should integrate with existing logging/monitoring systems', () => {
         const calculator = new CostCalculator(config);

         // Test performance metrics collection
         const metrics = {
           cacheHitRate: 0,
           calculationTime: 0,
           memoryUsage: 0
         };

         // Simulate cost calculations and track metrics
         for (let i = 0; i < 100; i++) {
           const startTime = performance.now();
           calculator.calculateCost('test-session', 'openai,gpt-4', 100, 200);
           const endTime = performance.now();

           metrics.calculationTime += (endTime - startTime);
         }

         // Verify metrics are collected
         const cacheStats = calculator.getCacheStats();
         expect(cacheStats.costCacheSize).toBeGreaterThan(0);
         expect(metrics.calculationTime).toBeLessThan(50); // < 0.5ms avg
       });
     });
     ```
   - **Performance Monitoring Integration:**
     - **Metrics Collection**: Track cache hit rates, calculation times, memory usage
     - **Integration Points**: Hook into existing router logging system
     - **Performance Baselines**: Establish baseline measurements before and after implementation
     - **Real-time Monitoring**: Monitor cost calculation overhead during live usage
     - **Alerting**: Set up performance degradation alerts if cost calculation exceeds thresholds

       it('should maintain cache efficiency under load', () => {
         const calculator = new CostCalculator(config);

         // Test cache hit rates
         const cacheHits = [];
         for (let i = 0; i < 100; i++) {
           const sessionId = 'test-session';
           const model = 'openai,gpt-4';
           const inputTokens = 100;
           const outputTokens = 200;

           // First call - should miss cache
           calculator.calculateCost(sessionId, model, inputTokens, outputTokens);

           // Second call with same params - should hit cache
           const startTime = performance.now();
           calculator.calculateCost(sessionId, model, inputTokens, outputTokens);
           const endTime = performance.now();

           cacheHits.push(endTime - startTime);
         }

         const avgCacheHitTime = cacheHits.reduce((a, b) => a + b, 0) / cacheHits.length;
         // Cache hits should be significantly faster
         expect(avgCacheHitTime).toBeLessThan(0.1);
       });
     });
     ```
   - **Memory Usage Monitoring:**
     - Test memory consumption with large numbers of sessions
     - Verify cache eviction works correctly
     - Monitor for memory leaks during long-running operations

5. **Manual Testing and Validation**
   - Test with live router and real API responses
   - Verify cost calculation accuracy
   - Test status line display with various configurations
   - Validate session reset behavior
   - Test error scenarios and graceful degradation
   - **Performance Validation:**
     - Measure request processing time with cost tracking enabled vs disabled
     - Verify no significant performance degradation in real-world usage
     - Test with high-throughput scenarios to identify bottlenecks

### Phase 7: Final Polish and Documentation

1. **Code Quality and Optimization**
   - Code review and optimization
   - Performance profiling and optimization
   - Memory usage optimization
   - Error handling refinement

2. **Documentation Updates**
   - Update configuration reference with cost tracking fields
   - Add cost module documentation to status line guide
   - Create usage examples and best practices
   - Update CLI help text for new features
   - Add troubleshooting guide for common issues

3. **Configuration Examples**
   - Create comprehensive configuration examples
   - Document all available status line variables
   - Provide best practices for pricing configuration
   - Include examples for different use cases

4. **Migration Examples**
   - **Upgrade Path for Existing Users**:
     ```json
     // Before: No cost tracking
     {
       "providers": {
         "openai": {
           "api_key": "sk-..."
         }
       }
     }

     // After: Add cost tracking configuration
     {
       "providers": {
         "openai": {
           "api_key": "sk-..."
         }
       },
       "CostTracking": {
         "enabled": true,
         "default_currency": "USD",
         "model_pricing": {
           "openai,gpt-4": {
             "input_tokens_per_million": 2.50,
             "output_tokens_per_million": 10.00
           },
           "anthropic,claude-3.5-sonnet": {
             "input_tokens_per_million": 3.00,
             "output_tokens_per_million": 15.00
           }
         }
       },
       "StatusLine": {
         "default": {
           "modules": [
             {
               "type": "cost",
               "icon": "💵",
               "text": "{{totalCost}}",
               "color": "bright_green"
             }
           ]
         }
       }
     }
     ```
   - **Progressive Migration**: Start with minimal configuration and add models as needed
   - **Backward Compatibility**: Existing configurations continue working without changes
   - **Error Recovery**: If cost configuration has errors, router continues operating normally
   - **Configuration Validation**: Use the validation output to fix configuration issues

## Key Design Decisions

### Cost Calculation Strategy

**Calculation Formula:**
```
cost = (input_tokens * input_price_per_million / 1,000,000) +
       (output_tokens * output_price_per_million / 1,000,000)
```

**Model Identification:**
- Use `<provider>,<model>` format for model identification
- Match router configuration format for consistency
- Support both provider-prefixed and unprefixed model names

### Session Management Strategy

**Storage Approach:**
- **Leverage existing LRU cache infrastructure** - use separate cost cache with same patterns as `sessionUsageCache`
- Use existing session management infrastructure and session ID patterns
- **No session events needed** - existing token tracking pattern handles lifecycle automatically
- **Session IDs extracted from metadata** - follow existing pattern from `src/utils/router.ts:185-190`
- **Session lifecycle**: Sessions exist as long as Claude Code uses the same session ID and data hasn't been evicted from LRU cache
- Automatic cleanup on session end via LRU eviction (100-entry capacity)
- **Simplified approach** - cost tracking follows exact same pattern as token usage tracking

**Performance Considerations:**
- Minimal impact on request processing
- Efficient cost calculation algorithms
- Optimized session cost storage
- **Performance Optimization Strategies:**
  - **Caching**: Cache cost calculations per session-model combination to avoid redundant calculations
  - **Efficient Data Structures**: Use Map-based LRU cache with O(1) operations for session cost storage
  - **Asynchronous Processing**: Defer cost calculation to avoid blocking request processing
  - **Batch Processing**: Aggregate cost updates for high-volume scenarios
  - **Performance Profiling**: Implement benchmarking and monitoring for cost calculation overhead
  - **Batch Processing Strategy:**
    ```typescript
    // For high-throughput scenarios, batch cost updates
    class BatchCostProcessor {
      private batchQueue: Array<{
        sessionId: string;
        model: string;
        inputTokens: number;
        outputTokens: number;
      }> = [];
      private batchSize = 10;
      private batchTimeout = 100; // ms

      constructor(private costCalculator: CostCalculator) {}

      queueCostUpdate(
        sessionId: string,
        model: string,
        inputTokens: number,
        outputTokens: number
      ): void {
        this.batchQueue.push({ sessionId, model, inputTokens, outputTokens });

        if (this.batchQueue.length >= this.batchSize) {
          this.processBatch();
        } else if (this.batchQueue.length === 1) {
          // Start timeout for first item
          setTimeout(() => this.processBatch(), this.batchTimeout);
        }
      }

      private processBatch(): void {
        if (this.batchQueue.length === 0) return;

        const batch = [...this.batchQueue];
        this.batchQueue = [];

        // Aggregate costs by session and model
        const aggregated = batch.reduce((acc, item) => {
          const key = `${item.sessionId}:${item.model}`;
          if (!acc[key]) {
            acc[key] = { ...item, inputTokens: 0, outputTokens: 0 };
          }
          acc[key].inputTokens += item.inputTokens;
          acc[key].outputTokens += item.outputTokens;
          return acc;
        }, {} as Record<string, any>);

        // Process aggregated costs
        Object.values(aggregated).forEach(item => {
          this.costCalculator.calculateCost(
            item.sessionId,
            item.model,
            item.inputTokens,
            item.outputTokens
          );
        });
      }
    }
    ```

### Status Line Integration Strategy

**Variable Substitution:**
- Support template variables in status line text
- Provide both formatted and raw cost values
- Support model-specific cost variables
- Handle disabled and error states gracefully

**Formatting Options:**
- Currency formatting with locale support
- Decimal, scientific, and compact formats
- Configurable precision
- Customizable display options

### Error Handling Strategy

**Comprehensive Error Handling with Clear Specifications:**

**Startup Validation Strategy:**
- **Consolidated Validation**: All configuration validation happens during Phase 1 initialization
- **Router Model Extraction**: Extract all models from Router configuration during initialization
- **Pricing Validation**: Check which router-used models have pricing configured
- **Mandatory User Prompt**: If any critical issues exist (invalid format, negative pricing, missing pricing), display warning and require user confirmation
- **Block Startup**: Router startup waits for user input on critical configuration issues

**Runtime Validation Strategy:**
- **Silent Zero Cost**: For unconfigured models, return cost of 0 without logging warnings
- **Calculate Configured Models**: Track costs normally for models with pricing
- **No Runtime Tracking**: Remove runtime missing model tracking and warnings
- **Status Line Display**: Show actual calculated costs, not "Partial" status indicators

**User Experience Design for Configuration Issues:**
- **Proactive Awareness**: Users know about configuration issues before using the router
- **Mandatory Confirmation**: Ensures users explicitly accept configuration issues
- **Clean Status Line**: Shows actual costs without confusing status messages
- **Accurate Tracking**: Reflects true spending (0 for unconfigured models is correct)

**Implementation Specifications:**

**Validation Approach:**
- All configuration validation consolidated in Phase 1 implementation
- User prompting for critical configuration issues during startup
- Runtime behavior returns 0 cost for unconfigured models without warnings

**Status Line Behavior:**
- Shows actual calculated costs, not "Partial" status indicators
- Graceful degradation for disabled or error states
- Clean display of actual dollar amounts being spent

**Error Message Examples:**
- **Startup Error**: "Invalid cost configuration: Model 'gpt-4' must use format 'openai,gpt-4'. Update config to use provider,model format."
- **Startup Warning**: "Cost tracking: Missing pricing for 2 router models: anthropic,claude-3.5-sonnet, openai,gpt-4. Costs will be 0 for these models. Add missing pricing to config or press Enter to continue..."

**Graceful Degradation Strategies:**
- **Proactive Awareness**: Users know about missing pricing before using the router
- **Mandatory Confirmation**: Users must explicitly accept partial tracking
- **Performance First**: Never block API requests due to cost calculation errors
- **Clean Status Line**: Show actual costs without confusing status messages

## Key Insights from Session Scope Analysis

Based on the session scope analysis (`admin/session_scope.md`), several important findings simplify the cost tracking implementation:

### Session Lifecycle Simplification
- **Session events are unnecessary** for cost tracking - existing token usage tracking pattern provides everything needed
- **Session IDs are extracted from metadata** - not generated by the router (from `metadata.user_id` at `src/utils/router.ts:185-190`)
- **LRU cache handles session lifecycle automatically** - no explicit session start/end events needed
- **Existing patterns are sufficient** - cost tracking can follow the exact same patterns as token usage tracking

### Implementation Benefits
- **No complex event system** needed - existing infrastructure handles session management
- **Proven pattern** already working for token tracking
- **Automatic cleanup** via LRU cache eviction
- **Consistent architecture** with existing codebase

### Recommended Approach
- **Use existing LRU cache patterns** for cost storage
- **Follow token usage tracking approach** - session ID as primary key
- **No session events needed** - existing pattern handles lifecycle
- **Automatic initialization** when session ID first appears

## Technical Implementation Details

### Configuration Schema Extension

**Required Schema Updates:**
```typescript
// Add to ui/src/types.ts Config interface (line 52)
interface Config {
  // ... existing fields ...
  CostTracking?: CostTrackingConfig;
}

interface CostTrackingConfig {
  enabled?: boolean;
  default_currency?: string;
  model_pricing?: Record<string, ModelPricing>;
}

interface ModelPricing {
  input_tokens_per_million: number;
  output_tokens_per_million: number;
  currency?: string;
}
```

**Validation Rules:**
- Pricing values must be positive numbers
- Currency codes must be valid ISO 4217 codes
- Model names must use `<provider>,<model>` format
- All configuration fields are optional

### Status Line Module Properties

**Cost Module Configuration:**
```typescript
interface CostModuleConfig {
  type: 'cost';
  icon?: string;
  text?: string;
  color?: string;
  format?: 'currency' | 'decimal' | 'scientific' | 'compact';
  precision?: number;
  show_breakdown?: boolean;
}
```

**Available Variables:**
- `{{totalCost}}` - Total session cost (formatted)
- `{{totalCostRaw}}` - Total session cost (raw number)
- `{{sessionDuration}}` - Session duration
- `{{modelCosts}}` - JSON string of per-model costs
- `{{topModel}}` - Most expensive model used
- `{{topModelCost}}` - Cost of most expensive model
- `{{cost.<provider>,<model>}}` - Cost for specific model

### Integration Points

**Token Capture Integration:**
- **Primary Hook**: Extend existing `onSend` hook in `src/index.ts` (lines 374-377)
- **Token Data**: Extract from `payload.usage` containing `input_tokens` and `output_tokens`
- **Model Information**: Extract from `req.body.model` set by router at line 224 in `src/utils/router.ts`
- **Session Association**: Use existing `req.sessionId` extracted from `metadata.user_id` at lines 185-190 in `src/utils/router.ts`
- **Asynchronous Processing**: Use `process.nextTick()` to avoid blocking request processing

**Session Management Integration:**
- Use existing session ID system (same keys as `sessionUsageCache`)
- **No session events needed** - existing token tracking pattern handles lifecycle automatically
- **Session IDs extracted from metadata** - follow pattern from `src/utils/router.ts:185-190`
- Maintain session cost persistence using separate LRU cache with same capacity and patterns
- **Simplified approach** - cost tracking follows exact same pattern as token usage tracking

## Benefits of New Architecture

1. **Real-time Cost Awareness**
   - Users can monitor costs as they use the router
   - Per-model cost breakdown provides insights
   - Session-level tracking helps with budget management

2. **Seamless Integration**
   - Non-disruptive addition to existing router
   - No conflicts with existing functionality
   - Maintains existing configuration patterns

3. **Performance Optimized**
   - Minimal impact on request processing
   - Efficient cost calculation algorithms
   - Optimized session storage

4. **Extensible Design**
   - Easy to add new cost tracking features
   - Support for future enhancements
   - Clean separation of concerns

## Risk Assessment

**Low Risk Areas:**
- Configuration schema extension
- Status line module integration
- Cost calculation logic

**Medium Risk Areas:**
- Token capture integration points
- Session management integration
- Performance impact assessment

**High Risk Areas:**
- Complex error handling scenarios
- Configuration validation edge cases
- Status line variable substitution

**Mitigation Strategies:**
- Comprehensive testing at each phase
- Gradual integration with existing systems
- Extensive error handling and logging
- Performance profiling and optimization

## Success Criteria

- [ ] Cost calculation works correctly for all configured models
- [ ] Session cost accumulation tracks costs accurately
- [ ] Status line displays costs with proper formatting
- [ ] Configuration validation catches invalid pricing
- [ ] Error handling provides graceful degradation
- [ ] All existing tests pass
- [ ] Manual testing confirms expected behavior
- [ ] Performance impact is minimal
- [ ] Documentation is comprehensive and accurate

## Migration Considerations

- **No breaking changes** to existing functionality
- **Gradual enhancement** - cost tracking is opt-in via configuration
- **Backward compatibility** - existing configurations continue to work
- **Error resilience** - cost tracking fails gracefully without disrupting router

## Technical Implementation Notes

*Note: Comprehensive error handling is detailed in the Error Handling section above.*

---

## Revision Notes

### 2025-11-11: Consolidated Configuration Validation with User Prompting

**Key Changes:**

1. **Consolidated Validation Architecture**
   - **Moved all validation to Phase 1**: Configuration validation now happens during initial config loading
   - **Integrated user prompting**: Critical configuration issues now require user confirmation during startup
   - **Single validation approach**: Combined basic validation and router model validation into one cohesive system

2. **Enhanced User Prompting Logic**
   - **Critical errors** (invalid model format, negative pricing): User must confirm to continue
   - **Missing pricing warnings**: User must confirm to continue with partial tracking
   - **Non-critical warnings** (unsupported currencies): Log only, no user prompt needed
   - **Blocking behavior**: Router startup waits for user input on critical issues

3. **Runtime Behavior Updates**
   - **Silent zero cost**: For unconfigured models, return cost of 0 without logging
   - **Calculate configured models**: Track costs normally for models with pricing
   - **No runtime warnings**: Remove runtime missing model tracking and warnings

4. **Status Line Provider Updates**
   - **Show actual costs**: Display calculated total cost amount, not "Partial" status
   - **Include zero costs**: Unconfigured models contribute 0 to total, which is accurate
   - **Focus on amount**: Users see actual dollar amount being spent

**Benefits of Consolidated Approach:**
- **Early detection**: Configuration issues caught during router startup
- **User awareness**: Users must explicitly accept configuration issues before proceeding
- **Clean separation**: Validation logic consolidated in Phase 1 where it belongs
- **Graceful degradation**: Router continues with cost tracking disabled if user chooses


