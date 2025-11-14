# Phase 1 Execution Plan: Core Cost Calculation Service

## 1. Introduction

**Phase Overview:** This phase implements the core cost calculation service, configuration validation with user prompting, and integration with existing configuration loading. This establishes the foundation for cost tracking functionality.

**Critical Instruction:** If any implementation steps cannot be completed due to technical blockers, configuration issues, or test failures, execution should be aborted immediately. The status document should be updated with the specific blocking issue, and the user must be notified before proceeding.

## 2. Pre-Implementation Steps

**IMPORTANT:** These steps must be performed by the main agent, NOT sub-agents.

### Step 1: Master Plan Review
- Read the entire master plan document at `admin/cost/master_plan.md` to understand complete scope and context
- Focus on Phase 1 requirements and integration points

### Step 2: Status Assessment
- Read `admin/cost/status/phase_0_execution_status.md` to understand current state
- Verify Phase 0 was completed successfully with all tests passing
- Confirm test infrastructure is operational

### Step 3: Test Suite Validation
- Run full test suite using `pnpm test`
- Verify all 13 tests pass (current baseline)
- If tests fail and status shows they should pass: Stop and notify user
- If tests fail and status shows they were failing: Make note and continue

### Step 4: Codebase Review
- Review existing codebase structure and understand relevant files/modules
- Verify integration points identified in Phase 0 analysis
- Confirm configuration loading patterns in `src/utils/index.ts`

## 3. Sub-Agent Usage Policy

**MANDATORY SUB-AGENT USAGE FOR IMPLEMENTATION**

All implementation steps must be performed by sub-agents. The main agent should only execute pre-implementation steps and coordinate sub-agent execution.

## 4. Implementation Steps

### Step 1: Create Cost Types
**Sub-Agent Type:** File Editor
**File:** `src/types/cost.ts`

**Requirements:**
- Create comprehensive type definitions for cost tracking
- Implement interfaces from master plan:
  - `ModelPricing` with `input_cost_per_million`, `output_cost_per_million`, and optional `currency`
  - `SessionCostData` with `sessionId`, `startTime`, `totalCost`, `modelCosts`, and `currency`
  - `CostTrackingConfig` with `enabled`, `default_currency`, and `model_pricing`
- Ensure type safety and proper TypeScript conventions
- Export all interfaces for use in other modules

**Source Code Example from Master Plan:**
```typescript
interface ModelPricing {
  input_cost_per_million: number;
  output_cost_per_million: number;
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

**Testing Requirements:**
- Verify TypeScript compilation succeeds
- Ensure proper export/import functionality
- Validate type definitions match master plan specifications

### Step 2: Implement CostCalculator Service
**Sub-Agent Type:** File Editor
**File:** `src/utils/costCalculator.ts`

**Requirements:**
- Create comprehensive cost calculation service
- Implement cost calculation logic integrated with existing `sessionUsageCache` patterns
- Support calculation caching to avoid redundant computations
- Implement session cost tracking with LRU cache (100-entry capacity)
- Handle missing pricing gracefully (return 0 cost without warnings)
- Support session reset functionality

**Key Features:**
- `calculateCost()` method for cost calculation
- `updateSessionCost()` private method for session management
- `getSessionCost()` method for retrieving session data
- `resetSession()` method for session reset
- `clearCalculationCache()` method for cache management

**Source Code Example from Master Plan:**
```typescript
class CostCalculator {
  private config: CostTrackingConfig;
  private costCache: LRUCache<string, SessionCostData>;
  private calculationCache: Map<string, number>;

  constructor(config: CostTrackingConfig) {
    this.config = config;
    this.costCache = new LRUCache<string, SessionCostData>(100);
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
      return 0; // Silent zero cost for unconfigured models
    }

    // Check calculation cache first
    const cacheKey = `${sessionId}:${model}:${inputTokens}:${outputTokens}`;
    const cachedCost = this.calculationCache.get(cacheKey);
    if (cachedCost !== undefined) {
      return cachedCost;
    }

    const inputCost = (inputTokens * pricing.input_cost_per_million) / 1000000;
    const outputCost = (outputTokens * pricing.output_cost_per_million) / 1000000;
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

  // ... rest of implementation
}
```

**Testing Requirements:**
- Unit tests for all public methods
- Test cost calculation accuracy with various token counts
- Test caching behavior and performance
- Test session management and reset functionality
- Test graceful handling of missing pricing
- Test LRU cache eviction behavior

### Step 3: Implement Configuration Validation with User Prompting
**Sub-Agent Type:** File Editor
**File:** `src/config/costConfig.ts`

**Requirements:**
- Create comprehensive configuration validation system
- Implement user prompting for critical configuration issues
- Support validation of model pricing using `<provider>,<model>` format
- Extract router models from configuration for missing pricing detection
- Handle currency validation and defaults
- Implement graceful degradation on validation failures

**Key Features:**
- `CostConfigValidator` class with static validation methods
- `validateCostConfig()` method for configuration validation
- `promptUserForConfirmation()` method for user interaction
- `validateAndInitializeCostConfig()` function for integration

**Validation Rules:**
- Model names must use `<provider>,<model>` format
- Pricing values must be positive numbers
- Currency codes must be valid ISO 4217 codes
- All configuration fields are optional with sensible defaults

**User Prompting Logic:**
- **Critical errors** (invalid model format, negative pricing): User must confirm to continue
- **Missing pricing warnings**: User must confirm to continue with partial tracking
- **Non-critical warnings** (unsupported currencies): Log only, no user prompt needed
- **Blocking behavior**: Router startup waits for user input on critical issues

**Source Code Example from Master Plan:**
```typescript
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
        if (pricing.input_cost_per_million <= 0) {
          errors.push(`Invalid input pricing for ${model}: must be positive`);
        }
        if (pricing.output_cost_per_million <= 0) {
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

    return { errors, warnings, missingPricing };
  }

  // ... additional helper methods
}
```

**Testing Requirements:**
- Unit tests for all validation methods
- Test model format validation
- Test pricing value validation
- Test currency validation
- Test router model extraction
- Test missing pricing detection
- Test user prompting scenarios

### Step 4: Implement Configuration Integration
**Sub-Agent Type:** File Editor
**Files:** `src/utils/index.ts`, `src/index.ts`

**Requirements:**
- Extend existing config loading in `src/utils/index.ts`
- Integrate cost configuration validation and initialization
- Initialize cost calculator during router startup in `src/index.ts`
- Ensure graceful error handling and fallback behavior
- Maintain backward compatibility with existing configurations

**Integration Points:**
- Extend `loadConfig()` function to include cost tracking validation
- Initialize `CostCalculator` instance during router startup
- Handle configuration errors gracefully (disable cost tracking on errors)
- Ensure router continues operating normally even with cost configuration issues

**Source Code Example from Master Plan:**
```typescript
// In src/utils/index.ts - extend existing config loading
export async function loadConfig(): Promise<RouterConfig> {
  // ... existing config loading logic ...

  // Validate and initialize cost tracking configuration (async for user prompting)
  const costTrackingConfig = await validateAndInitializeCostConfig(config);

  return {
    ...config,
    CostTracking: costTrackingConfig
  };
}

// In src/index.ts - during router initialization
const config = await loadConfig();
const costTrackingConfig = config.CostTracking;

// Initialize cost calculator if enabled
let costCalculator: CostCalculator | null = null;
if (costTrackingConfig.enabled) {
  costCalculator = new CostCalculator(costTrackingConfig);
}
```

**Error Handling Integration:**
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

**Testing Requirements:**
- Integration tests for configuration loading
- Test error handling and graceful degradation
- Test backward compatibility with existing configurations
- Test initialization with various configuration states
- Test user prompting integration

### Step 5: Update and Extend Test Suite
**Sub-Agent Type:** Test Runner
**Files:** `tests/utils/costCalculator.test.ts`, `tests/config/costConfig.test.ts`

**Requirements:**
- Extend existing cost calculator tests with new functionality
- Create comprehensive tests for configuration validation
- Test all edge cases and error scenarios
- Ensure >90% test coverage for new code
- Verify backward compatibility

**Test Scenarios:**
- Cost calculation with various token counts and prices
- Missing pricing scenarios (silent zero cost)
- Configuration validation with valid/invalid inputs
- User prompting scenarios
- Error handling and graceful degradation
- Session management and reset functionality

## 5. Next Steps

### Step 1: Final Test Run
- Run full test suite using `pnpm test`
- Verify all tests pass, including new tests for Phase 1 functionality
- Run coverage report using `pnpm run test:coverage`
- Ensure >90% coverage for new code

### Step 2: Status Documentation
- Create `admin/cost/status/phase_1_execution_status.md`
- Document current phase execution steps with status:
  - Reference each step with status ("COMPLETED", "IN PROGRESS", "NOT STARTED", "NEEDS CLARIFICATION")
- Document final status of the test suite
- Include a summary of the phase execution and what was accomplished
- Note any risks or blocking issues
- End the status document with a single overarching next step

## Critical Requirements Checklist

- ✅ **TESTING REQUIREMENTS**: Include specific test requirements for all new code
- ✅ **BACKWARD COMPATIBILITY**: Explicitly address backward compatibility concerns
- ✅ **ERROR HANDLING**: Document error handling preservation requirements
- ✅ **STATUS TRACKING**: Include status document creation/update instructions
- ✅ **SUB-AGENT USAGE**: The execution plan explicitly requires the use of sub-agents for all implementation steps, and specifies which sub-agent is responsible for each step

## Risk Assessment

**Low Risk Areas:**
- Type definitions creation
- Configuration schema integration
- Basic cost calculation logic

**Medium Risk Areas:**
- User prompting implementation
- Configuration validation edge cases
- Integration with existing config loading

**High Risk Areas:**
- Complex error handling scenarios
- Asynchronous user input handling
- Graceful degradation on configuration failures

**Mitigation Strategies:**
- Comprehensive testing at each step
- Gradual integration with existing systems
- Extensive error handling and logging
- User prompting with clear instructions