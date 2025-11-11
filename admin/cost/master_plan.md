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
- `src/services/costCalculator.ts` - Core cost calculation service
- `src/services/costStatusLineProvider.ts` - Status line variable provider for costs
- `src/types/cost.ts` - Type definitions for cost tracking
- `src/config/costConfig.ts` - Cost configuration validation and parsing
- `tests/services/costCalculator.test.ts` - Unit tests for cost calculator
- `tests/services/costStatusLineProvider.test.ts` - Unit tests for status line provider

**Modified Files:**
- `src/config/schema.ts` - Extend configuration schema with cost tracking
- `src/services/sessionManager.ts` - Integrate cost tracking with session management
- `src/services/statusLine.ts` - Add cost module type
- `src/index.ts` - Initialize cost tracking service

**Core Components:**

**CostCalculator Service** - Core cost calculation:
- Inherits from existing service patterns
- Calculates costs from token counts using model-specific pricing
- Maintains session-level cost accumulation
- Provides cost data to status line and other consumers

**CostStatusLineProvider** - Status line integration:
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
- Associate costs with session IDs
- Reset costs when sessions end or new conversations start
- Provide session-level cost aggregation

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
   - Create `src/services/costCalculator.ts`
   - Implement cost calculation logic:
   ```typescript
   class CostCalculator {
     private config: CostTrackingConfig;
     private sessionCosts: Map<string, SessionCostData> = new Map();

     constructor(config: CostTrackingConfig) {
       this.config = config;
     }

     calculateCost(
       sessionId: string,
       model: string,
       inputTokens: number,
       outputTokens: number
     ): number {
       const pricing = this.config.model_pricing[model];
       if (!pricing) {
         // Log warning for missing pricing (only when model is actually used)
         return 0;
       }

       const inputCost = (inputTokens * pricing.input_tokens_per_million) / 1000000;
       const outputCost = (outputTokens * pricing.output_tokens_per_million) / 1000000;
       const totalCost = inputCost + outputCost;

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
       // Implementation for session cost tracking
     }

     getSessionCost(sessionId: string): SessionCostData | undefined {
       return this.sessionCosts.get(sessionId);
     }

     resetSession(sessionId: string): void {
       this.sessionCosts.delete(sessionId);
     }
   }
   ```

3. **Implement Configuration Validation**
   - Create `src/config/costConfig.ts`
   - Validate pricing configuration on startup
   - Check for positive pricing values
   - Validate currency codes
   - Handle missing model pricing gracefully

### Phase 2: Session Cost Storage and Management

1. **Extend Session Management**
   - Integrate cost calculator with existing session management
   - Associate costs with session IDs
   - Implement session reset behavior
   - Add session cost persistence (in-memory)

2. **Implement Session Cost Storage**
   - Use existing session cache or create new LRU cache
   - Store per-model cost breakdowns
   - Support session duration tracking
   - Implement cost aggregation logic

3. **Add Error Handling**
   - Handle missing pricing configurations
   - Log warnings **only when unconfigured models are actually used**
   - Implement graceful degradation
   - Support disabled state fallback

### Phase 3: Status Line Provider Implementation

1. **Create CostStatusLineProvider**
   - Create `src/services/costStatusLineProvider.ts`
   - Implement status line variable provider interface:
   ```typescript
   class CostStatusLineProvider {
     private costCalculator: CostCalculator;

     constructor(costCalculator: CostCalculator) {
       this.costCalculator = costCalculator;
     }

     getCostVariables(sessionId: string): Record<string, string> {
       const sessionCost = this.costCalculator.getSessionCost(sessionId);
       if (!sessionCost) {
         return this.getDisabledVariables();
       }

       return {
         totalCost: this.formatCurrency(sessionCost.totalCost, sessionCost.currency),
         totalCostRaw: sessionCost.totalCost.toFixed(4),
         sessionDuration: this.formatDuration(sessionCost.startTime),
         modelCosts: JSON.stringify(sessionCost.modelCosts),
         topModel: this.getTopModel(sessionCost.modelCosts),
         topModelCost: this.formatCurrency(this.getTopModelCost(sessionCost.modelCosts), sessionCost.currency)
       };
     }

     private formatCurrency(amount: number, currency: string): string {
       // Implementation for currency formatting
     }

     private formatDuration(startTime: Date): string {
       // Implementation for duration formatting
     }

     private getDisabledVariables(): Record<string, string> {
       return {
         totalCost: "Disabled",
         totalCostRaw: "Disabled",
         sessionDuration: "Disabled",
         modelCosts: "{}",
         topModel: "Disabled",
         topModelCost: "Disabled"
       };
     }
   }
   ```

2. **Support Model-Specific Variables**
   - Generate variables for each configured model
   - Handle dynamic model cost variables
   - Support template substitution for model costs

### Phase 4: Token Capture Integration

1. **Integrate with API Response Processing**
   - Hook into existing API response handling
   - Extract token counts from provider responses
   - Capture model information from routing decisions
   - Pass data to cost calculator

2. **Implement Token Capture Points**
   - Identify where token data is available
   - Add cost calculation calls
   - Handle asynchronous cost updates
   - Ensure performance impact is minimal

3. **Add Session Context**
   - Associate API responses with session IDs
   - Maintain session context across requests
   - Handle session boundaries and resets

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
   - Create `tests/services/costCalculator.test.ts`
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
   - Create `tests/services/costStatusLineProvider.test.ts`
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

4. **Manual Testing and Validation**
   - Test with live router and real API responses
   - Verify cost calculation accuracy
   - Test status line display with various configurations
   - Validate session reset behavior
   - Test error scenarios and graceful degradation

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
- In-memory storage for session costs
- Use existing session management infrastructure
- Automatic cleanup on session end
- Support for session reset on new conversations

**Performance Considerations:**
- Minimal impact on request processing
- Efficient cost calculation algorithms
- Optimized session cost storage

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

**Comprehensive Error Handling:**

**Configuration Errors:**
- Validate pricing configuration on startup
- Provide clear error messages for invalid configurations
- Require user confirmation for problematic configurations
- Fallback to disabled state for invalid configurations

**Runtime Errors:**
- Catch exceptions during cost calculation
- Log detailed error information for debugging
- Show "Error" in status line during failures
- Maintain existing functionality during cost tracking failures

**Missing Pricing:**
- Log warnings **only when unconfigured models are actually used** by the router
- Set cost to 0 for missing pricing
- Allow user to continue with partial cost tracking
- Provide clear guidance on configuration
- **No startup warnings** for models that aren't being used

**Graceful Degradation:**
- Cost tracking disabled by default
- Clear indication when cost tracking is disabled
- No disruption to core router functionality
- Easy enable/disable via configuration

## Technical Implementation Details

### Configuration Schema Extension

**Required Schema Updates:**
```typescript
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
- Hook into API response processing
- Extract token usage data
- Capture model information from routing context
- Associate with session ID

**Session Management Integration:**
- Use existing session ID system
- Integrate with session start/end events
- Support session reset functionality
- Maintain session cost persistence

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

## PLAN REVIEW RESULTS

### Redundancies Found:

**Session Storage Redundancy:**
- **Issue**: The master plan proposes creating new session storage mechanisms for cost tracking but doesn't leverage the existing `sessionUsageCache` LRU cache infrastructure that already tracks token usage per session ID.
- **Analysis**: The codebase already has a well-established `sessionUsageCache` (in `src/utils/cache.ts`) that stores token usage per session ID. This infrastructure already handles session management, LRU eviction, and token tracking. Creating a separate session storage system for costs would be redundant and inefficient.
- **Recommendation**: Update the master plan to leverage the existing `sessionUsageCache` infrastructure for cost storage instead of creating new session storage mechanisms. Extend the existing cache to store cost data alongside token usage, or create a separate cost cache that follows the same patterns.

### Inconsistencies Found:

**File Organization Inconsistency:**
- **Issue**: The master plan proposes placing new files in `src/services/` directory, but the existing codebase consistently uses `src/utils/` pattern for utility and service files
- **Analysis**: Current codebase has files like `src/utils/statusline.ts`, `src/utils/cache.ts`, `src/utils/router.ts`, etc. No `src/services/` directory exists. Placing cost-related files in `src/services/` would break the established pattern and create confusion about where to find different types of functionality
- **Recommendation**: Update the file organization in the master plan to place all new cost-related files in `src/utils/` directory instead of `src/services/` to maintain consistency with existing patterns

### Missing Critical Details:

**Performance Impact Analysis:**
- **Issue**: The master plan doesn't adequately address the potential performance impact of real-time cost calculation on every API response, particularly in high-throughput scenarios.
- **Analysis**: The cost calculation will be triggered on every API response (in the existing `onSend` hook), which could impact request processing speed. The plan mentions "minimal impact" but doesn't provide specific strategies for performance optimization or measurement.
- **Recommendation**: Add specific performance optimization strategies to the master plan, such as:
  - Caching cost calculations to avoid recalculation
  - Using efficient data structures for session cost storage
  - Performance profiling and benchmarking requirements
  - Asynchronous cost calculation where possible
  - Batch processing strategies for high-volume scenarios

**Error Handling Specification Gaps:**
- **Issue**: The master plan mentions error handling but lacks specific details about startup validation, runtime validation, and user experience during configuration issues, particularly for missing model pricing.
- **Analysis**: The plan states to log warnings "only when unconfigured models are actually used" but doesn't specify:
  - When exactly to log warnings (at startup vs runtime)
  - How to handle partial cost tracking when some models are configured and others aren't
  - User experience during configuration issues
  - Clear error messages with configuration guidance
- **Recommendation**: Add detailed error handling specifications to the master plan, including:
  - Startup validation for pricing configuration with clear error messages
  - Runtime validation strategy for missing model pricing with specific logging timing
  - User experience design for configuration issues with graceful degradation
  - Clear error messages with specific configuration guidance and examples
  - Graceful degradation strategies for partial cost tracking when only some models are configured

**Token Capture Integration Details:**
- **Issue**: The master plan mentions integrating with token capture but lacks specific details about the exact integration point and how to extract model information from routing decisions.
- **Analysis**: The existing codebase captures token usage in the `onSend` hook (lines 329-373 in index.ts) and stores it in `sessionUsageCache`. The master plan doesn't specify:
  - The exact hook or location for cost calculation integration
  - How to extract model information that's used for routing decisions
  - How to associate API responses with specific session IDs
  - How to handle the asynchronous nature of cost calculation
- **Recommendation**: Add specific integration details to the master plan, including:
  - Exact hook location for cost calculation (likely in the existing `onSend` hook at line 374-377 in index.ts)
  - Method for extracting model information from routing context (the router sets `req.body.model` at line 224 in router.ts)
  - Session ID association strategy (session IDs are already extracted from metadata.user_id at lines 185-190 in router.ts)
  - Asynchronous cost calculation approach to avoid blocking request processing
  - Integration with existing `sessionUsageCache` patterns for consistency

**Status Line Variable Provider Integration:**
- **Issue**: The master plan mentions status line integration but lacks specific details about how the cost status line provider integrates with the existing status line variable system and how it handles dynamic model-specific variables.
- **Analysis**: The existing status line system (in `src/utils/statusline.ts`) supports variable substitution through the `replaceVariables` function and script execution. The master plan doesn't specify:
  - How the cost provider integrates with the existing status line architecture
  - How to handle dynamic model-specific variables like `{{cost.openai,gpt-4}}`
  - How the cost module type is registered and configured
  - How to handle disabled states and error conditions in the status line
- **Recommendation**: Add specific status line integration details to the master plan, including:
  - Integration pattern for cost status line provider with existing variable system
  - Strategy for dynamic model-specific variable generation
  - Registration and configuration of cost module type
  - Error handling and disabled state display in status line
  - Template variable substitution implementation details