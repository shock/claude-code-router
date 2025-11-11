# Session Cost Tracking Implementation Master Plan

## Objective

**Primary Goal:** Implement comprehensive session cost tracking for Claude Code Router that provides real-time cost calculation, display, and management for LLM usage across all providers and models.

**Value Proposition:**
- **Cost Visibility**: Real-time awareness of session costs with per-model breakdowns
- **Budget Management**: Configurable alerts and thresholds for cost control
- **Provider Integration**: Automatic cost calculation across all configured LLM providers
- **Status Line Integration**: Rich cost display with multiple formatting options
- **Historical Tracking**: Session cost accumulation and optional persistence
- **API Access**: Programmatic access to cost data for external tools

## Core Guiding Principles

### Preservation of Existing Behavior

**Fundamental Rule:** The cost tracking feature must integrate seamlessly without disrupting existing functionality. This ensures:

- **No Interference**: Existing token tracking and status line functionality continues unchanged
- **Performance Stability**: Asynchronous cost calculation to avoid blocking responses
- **Configuration Compatibility**: Existing configurations continue to work without modification
- **Error Resilience**: Cost calculation failures don't affect core routing functionality

### Backward Compatibility

- **Existing configurations must work without changes** - All cost features are opt-in and disabled by default
- **No breaking changes** to current API, status line, or caching systems
- **Graceful degradation** when cost data is unavailable or calculation fails
- **Error resilience** - comprehensive error handling maintains system stability

## Current Architecture Analysis

### Existing Token Usage Tracking (src/utils/cache.ts)

The system currently implements:
- **`LRUCache` class** for session management with `Usage` interface
- **`input_tokens` and `output_tokens` tracking** per session
- **In-memory storage** with configurable session limits
- **Session lifecycle management** with automatic cleanup

**Key Integration Point:** The `Usage` interface can be extended to include cost data while maintaining existing token functionality.

### Status Line System (src/utils/statusline.ts)

The status line system provides:
- **Modular architecture** with `StatusLineModuleConfig` interface
- **Variable replacement system** with `{{variable}}` syntax
- **Multiple module types** (text, provider, model, tokens)
- **Theme support** with color coding and formatting
- **Real-time updates** through the message processing pipeline

**Key Integration Point:** New "cost" module type can be added to existing module system for seamless cost display.

### Configuration System (JSON5-based)

The configuration system supports:
- **JSON schema validation** for structured configurations
- **Provider-level and global settings** with inheritance
- **Runtime configuration updates** through API endpoints
- **Migration utilities** for configuration schema evolution

**Key Integration Point:** Cost tracking configuration can be added as optional section with proper validation and migration support.

### Message Processing Pipeline

The message flow includes:
- **Request/Response processing** through Fastify hooks
- **Token usage extraction** from LLM responses
- **Session management** through cache operations
- **Status line updates** via message events

**Key Integration Point:** Cost calculation can be integrated into existing `onSend` hook for token usage extraction.

## Proposed Architecture

### File Organization and Component Overview

**New File Structure:**
- `src/utils/cost-calculator.ts` - Cost calculation service with model pricing and formatting
- `src/utils/cost-formatter.ts` - Currency formatting and display utilities
- `src/types/cost.ts` - TypeScript interfaces for cost tracking types
- `src/api/cost-endpoints.ts` - API endpoints for cost data access and management
- `tests/unit/cost-calculator.test.ts` - Unit tests for cost calculation logic
- `tests/unit/cost-formatter.test.ts` - Unit tests for formatting utilities
- `tests/integration/cost-tracking.test.ts` - Integration tests for complete cost tracking

**Modified Files:**
- `src/utils/cache.ts` - Extend Usage interface and LRUCache for cost data
- `src/utils/statusline.ts` - Add cost module type and variable support
- `src/index.ts` - Integrate cost calculation into response processing
- `src/server.ts` - Add cost API endpoints
- `config.schema.json` - Extend schema for cost tracking configuration

**Core Components:**

**CostCalculator** - Core cost calculation logic:
- Calculates costs based on token counts and model pricing
- Handles missing pricing data and error scenarios
- Supports currency conversion and multiple pricing models
- Key methods: `calculateSessionCost(usage, pricing)`, `getModelPricing(model, provider)`

**CostFormatter** - Display formatting utilities:
- Multiple display formats (currency, decimal, scientific, compact)
- Currency symbol and precision handling
- Localized formatting support
- Key methods: `formatCost(amount, format, currency)`, `formatModelCosts(costs)`

**CostModuleConfig** - Status line integration:
- Extends `StatusLineModuleConfig` for cost-specific settings
- Variable replacement for cost-related data
- Format selection and display options
- Variables: `{{totalCost}}`, `{{modelCosts}}`, `{{currency}}`, `{{sessionCount}}`

## Implementation Steps

### Testing Strategy

**Integrated Testing Approach for Confidence at Each Step:**

1. **Pre-implementation**: Verify existing functionality baseline for token tracking and status line
2. **During each phase**: Unit tests for new components + integration tests with existing systems
3. **Post-implementation**: Comprehensive regression testing and performance validation

**Testing Framework:**
- **Unit Tests**: Individual component testing with mocked dependencies
- **Integration Tests**: End-to-end cost tracking with real LLM responses
- **Performance Tests**: Cost calculation performance under various loads
- **Regression Tests**: Ensuring existing functionality remains unchanged
- **Manual QA**: Real-world testing with actual provider responses

**Phase-by-Phase Testing Requirements:**
- **Phase 1**: Unit tests for CostCalculator and CostFormatter; Cache extension tests; Configuration validation tests
- **Phase 2**: Status line integration tests; Variable replacement tests; Display format tests
- **Phase 3**: API endpoint tests; Cost aggregation tests; Advanced feature validation
- **Phase 4**: Complete integration tests; Performance benchmarks; Documentation accuracy tests

Testing is integrated throughout each phase to ensure functionality confidence at every step.

### Phase 1: Core Cost Calculation Infrastructure

1. **Create Cost Types Interface** (`src/types/cost.ts`)
   ```typescript
   export interface ModelPricing {
     inputTokenPrice: number;
     outputTokenPrice: number;
     currency?: string;
   }

   export interface ProviderPricing {
     [modelName: string]: ModelPricing;
   }

   export interface CostTrackingConfig {
     enabled: boolean;
     defaultCurrency: string;
     defaultPricing: ModelPricing;
     providerPricing: { [providerName: string]: ProviderPricing };
   }

   export interface SessionCost {
     totalCost: number;
     modelCosts: { [modelName: string]: number };
     currency: string;
     lastUpdated: Date;
   }

   export interface UsageWithCost extends Usage {
     cost?: SessionCost;
   }
   ```

2. **Implement Cost Calculator** (`src/utils/cost-calculator.ts`)
   - Create `CostCalculator` class with pricing configuration and calculation logic
   - Implement `calculateSessionCost(usage, config)` method with model-based pricing lookup
   - Add `getModelPricing(model, provider, config)` with fallback to default pricing
   - Include comprehensive error handling for missing pricing data and calculation errors
   - Add currency conversion support preparation (for future multi-currency)
   - Performance optimization for batch cost calculations
   - **Implementation Details:**
     ```typescript
     export class CostCalculator {
       constructor(private config: CostTrackingConfig) {}

       calculateSessionCost(usage: Usage): SessionCost {
         const modelCosts: { [modelName: string]: number } = {};
         let totalCost = 0;

         for (const [modelId, tokenUsage] of Object.entries(usage.modelUsage)) {
           const pricing = this.getModelPricing(modelId, tokenUsage.provider);
           const modelCost = (tokenUsage.input_tokens * pricing.inputTokenPrice) +
                           (tokenUsage.output_tokens * pricing.outputTokenPrice);
           modelCosts[modelId] = modelCost;
           totalCost += modelCost;
         }

         return {
           totalCost,
           modelCosts,
           currency: this.config.defaultCurrency,
           lastUpdated: new Date()
         };
       }
     }
     ```

3. **Create Cost Formatter** (`src/utils/cost-formatter.ts`)
   - Implement `CostFormatter` class with multiple display formats
   - Support formats: currency ($0.00), decimal (0.0000), scientific (1.23e-6), compact (K/M/B suffixes)
   - Add currency symbol handling and precision control
   - Include localized formatting preparation for future internationalization
   - **Implementation Details:**
     ```typescript
     export type CostDisplayFormat = 'currency' | 'decimal' | 'scientific' | 'compact';

     export class CostFormatter {
       constructor(private defaultCurrency: string = 'USD') {}

       formatCost(amount: number, format: CostDisplayFormat, currency?: string): string {
         switch (format) {
           case 'currency':
             return new Intl.NumberFormat('en-US', {
               style: 'currency',
               currency: currency || this.defaultCurrency
             }).format(amount);
           // ... other format implementations
         }
       }
     }
     ```

4. **Extend Cache System** (`src/utils/cache.ts`)
   - Modify `Usage` interface to include optional `cost?: SessionCost` field
   - Extend `LRUCache.set()` method to calculate and store cost when cost tracking is enabled
   - Add `updateSessionCost(sessionId)` method for cost updates
   - Implement cost aggregation methods for session summaries
   - Ensure backward compatibility with existing cache operations
   - **Cache Integration Details:**
     - Cost calculation occurs asynchronously to avoid blocking cache operations
     - Existing `sessionUsageCache.get()` calls remain unchanged for backward compatibility
     - New `sessionUsageCache.getWithCost(sessionId)` method for cost-aware access

5. **Configuration Schema Extension**
   - Extend `config.schema.json` to include optional `costTracking` section
   - Add validation for pricing configuration structures
   - Include migration utilities for configuration updates
   - Ensure backward compatibility with existing configurations
   - **Configuration Structure:**
     ```json
     {
       "costTracking": {
         "enabled": false,
         "defaultCurrency": "USD",
         "defaultPricing": {
           "inputTokenPrice": 0.000001,
           "outputTokenPrice": 0.000002
         },
         "providerPricing": {
           "openai": {
             "gpt-4": {
               "inputTokenPrice": 0.00003,
               "outputTokenPrice": 0.00006
             }
           }
         }
       }
     }
     ```

6. **Integration with Message Processing** (`src/index.ts`)
   - Add cost calculation to existing `onSend` hook
   - Integrate with current token usage extraction logic
   - Ensure cost tracking doesn't block response processing
   - Add error handling for cost calculation failures
   - **Integration Details:**
     - Use existing token usage extraction points
     - Calculate costs asynchronously after token processing
     - Store cost data in extended cache without affecting existing operations

### Phase 2: Status Line Integration

1. **Add Cost Module Type** (`src/utils/statusline.ts`)
   - Extend `StatusLineModuleType` union to include `'cost'`
   - Create `CostModuleConfig` interface extending `StatusLineModuleConfig`
   - Add cost-specific configuration options: format, currency, display options
   - Implement cost variable support in variable replacement system
   - **Module Configuration:**
     ```typescript
     interface CostModuleConfig extends StatusLineModuleConfig {
       type: 'cost';
       format?: CostDisplayFormat;
       currency?: string;
       showModelBreakdown?: boolean;
       compactThreshold?: number;
     }
     ```

2. **Cost Variable Implementation**
   - Add cost-related variables to variable extraction logic:
     - `{{totalCost}}` - Total session cost
     - `{{modelCosts}}` - Per-model cost breakdown
     - `{{currency}}` - Currency symbol
     - `{{sessionCount}}` - Number of sessions with costs
   - Implement variable replacement with CostFormatter for proper display
   - Add error handling for missing cost data in variables
   - **Variable Implementation Details:**
     - Variables are populated from session cost data in cache
     - Fallback values provided when cost data is unavailable
     - Format-aware variable replacement (currency vs decimal formats)

3. **Cost Data Integration**
   - Modify status line update logic to include cost data extraction
   - Add cost aggregation across multiple sessions when configured
   - Implement cost-based color coding and thresholds in status line themes
   - Support multiple cost modules in a single status line configuration
   - **Display Features:**
     - Real-time cost updates as tokens are consumed
     - Model-specific cost highlighting in breakdowns
     - Threshold-based color changes for cost awareness
     - Compact display modes for space-constrained environments

4. **Status Line Module Examples**
   - Create example configurations for common use cases:
     - Simple cost display: `Cost: {{totalCost}}`
     - Model breakdown: `{{modelCosts}}`
     - Compact mode: `¢{{totalCost}}` for small amounts
     - Multi-format support for different user preferences
   - Add documentation examples and best practices

5. **Testing Status Line Integration**
   - Unit tests for cost variable extraction and replacement
   - Integration tests with existing status line rendering
   - Theme testing for cost-based color coding
   - Performance tests for real-time cost updates

### Phase 3: API and Advanced Features

1. **Create Cost API Endpoints** (`src/api/cost-endpoints.ts`)
   - Implement `/api/cost/session` endpoint for current session cost data
   - Add `/api/cost/history` endpoint for cost history (if persistence is enabled)
   - Create `/api/cost/reset` endpoint for session cost management
   - Include `/api/cost/config` endpoint for cost configuration management
   - Follow existing Fastify patterns and error handling
   - **API Endpoint Structure:**
     ```typescript
     // GET /api/cost/session
     interface SessionCostResponse {
       sessionId: string;
       totalCost: number;
       modelCosts: { [modelId: string]: number };
       currency: string;
       lastUpdated: string;
     }

     // POST /api/cost/config
     interface CostConfigRequest {
       enabled: boolean;
       pricing?: CostTrackingConfig;
     }
     ```

2. **Advanced Cost Features**
   - **Cost Alerts**: Implement configurable cost thresholds with notification system
   - **Cost History**: Optional persistence of cost data across application restarts
   - **Multi-Currency Support**: Currency conversion using exchange rates (preparation)
   - **Cost Export**: CSV/JSON export functionality for cost analysis
   - **Budget Management**: Per-session or daily spending limits with enforcement
   - **Advanced Features Implementation:**
     - Alerts use existing notification system
     - History integrates with existing configuration persistence
     - Export follows existing data export patterns
     - Budget management provides soft limits with warnings

3. **Cost Analytics Dashboard (Optional)**
   - Basic HTML dashboard for cost visualization
   - Integration with existing configuration management interface
   - Charts and graphs for cost trends and model usage analysis
   - Export functionality for external cost management tools
   - **Dashboard Features:**
     - Real-time cost monitoring
     - Historical cost trends
     - Model-specific cost analysis
     - Provider cost comparison

4. **Performance Optimization**
   - Implement cost calculation caching for repeated operations
   - Add lazy loading for cost history data
   - Optimize database queries for cost analytics
   - Ensure cost tracking doesn't impact response times
   - **Optimization Strategies:**
     - Cache calculated costs to avoid recalculation
     - Batch cost calculations for multiple sessions
     - Asynchronous cost updates to prevent blocking
     - Memory-efficient cost data storage

5. **API Documentation and Testing**
   - Complete OpenAPI documentation for all cost endpoints
   - Integration tests for all cost API functionality
   - Error handling validation for edge cases
   - Performance testing for cost analytics endpoints

### Phase 4: Testing, Documentation and Final Integration

1. **Comprehensive Unit Testing**
   - **CostCalculator Tests** (`tests/unit/cost-calculator.test.ts`):
     - Test cost calculation accuracy with various pricing models
     - Validate fallback behavior for missing pricing data
     - Test error handling for invalid inputs and configurations
     - Performance tests for large token counts and multiple models
   - **CostFormatter Tests** (`tests/unit/cost-formatter.test.ts`):
     - Test all display formats with different amounts and currencies
     - Validate precision handling and rounding behavior
     - Test edge cases: zero costs, very large amounts, negative values
     - Localized formatting tests for future internationalization
   - **Cache Extension Tests** (`tests/unit/cache.test.ts`):
     - Test cost data storage and retrieval in extended cache
     - Validate backward compatibility with existing cache operations
     - Test cost aggregation and session management
     - Performance tests for cache operations with cost data

2. **Integration Testing**
   - **Complete Cost Tracking Pipeline** (`tests/integration/cost-tracking.test.ts`):
     - End-to-end testing with mock LLM responses
     - Validate cost calculation through message processing pipeline
     - Test status line integration with real cost data
     - API endpoint testing with complete cost workflows
   - **Status Line Integration Tests**:
     - Test cost module rendering with various configurations
     - Validate variable replacement and formatting
     - Test real-time updates during active sessions
     - Theme integration and color coding validation
   - **Configuration Management Tests**:
     - Test cost configuration loading and validation
     - Migration testing for existing configurations
     - Runtime configuration update testing
     - Error handling for invalid cost configurations

3. **Performance Validation**
   - **Cost Calculation Performance**:
     - Benchmark cost calculation speed with various token counts
     - Validate minimal impact on response processing times
     - Memory usage profiling for cost data storage
     - Concurrent session cost tracking performance
   - **Status Line Performance**:
     - Real-time cost update performance testing
     - Status line rendering performance with cost modules
     - Variable replacement efficiency validation
   - **API Performance**:
     - Response time testing for cost analytics endpoints
     - Concurrent access testing for cost data APIs
     - Database query optimization validation

4. **Documentation Updates**
   - **Configuration Documentation**:
     - Complete configuration reference for cost tracking
     - Example configurations for common use cases
     - Migration guide for existing setups
     - Best practices and troubleshooting guide
   - **API Documentation**:
     - Complete OpenAPI specification for cost endpoints
     - Usage examples for all cost management operations
     - Integration examples for external tools
     - Authentication and authorization documentation
   - **User Documentation**:
     - Cost tracking setup and configuration guide
     - Status line customization examples
     - Cost analysis and optimization tips
     - FAQ for common cost tracking questions

5. **Final Integration Validation**
   - **Regression Testing**:
     - Complete test suite execution to ensure no regressions
     - Existing functionality validation with cost tracking enabled/disabled
     - Performance baseline comparison with and without cost tracking
     - Memory usage validation for extended cache operations
   - **Manual QA Testing**:
     - Real-world testing with actual LLM providers
     - User experience validation for status line integration
     - Configuration workflow testing with various scenarios
     - Error handling validation for edge cases and failures
   - **Production Readiness Validation**:
     - Configuration validation for production environments
     - Monitoring and logging integration testing
     - Backup and recovery validation for cost data
     - Security review for cost data access and APIs

## Key Design Decisions

### Cost Calculation Strategy

**Pricing Model:**
- **Token-based pricing**: Costs calculated from input/output token counts
- **Provider-specific pricing**: Support for different pricing per provider
- **Model-level granularity**: Individual pricing for each model within providers
- **Fallback pricing**: Default pricing when specific model pricing is unavailable

**Currency Handling:**
- **Single currency default**: USD as default currency with multi-currency preparation
- **Consistent currency**: All costs stored in base currency for consistency
- **Display flexibility**: Multiple display formats regardless of storage currency

### Performance Optimization

**Asynchronous Processing:**
- **Non-blocking calculations**: Cost calculation occurs after response processing
- **Background updates**: Cost data updated asynchronously to avoid impact on user experience
- **Caching strategy**: Calculated costs cached to avoid repeated calculations

**Memory Efficiency:**
- **Sparse cost data**: Cost data only stored when cost tracking is enabled
- **Compact storage**: Efficient data structures for cost information
- **Optional persistence**: Cost history only stored when explicitly configured

### Configuration Strategy

**Opt-in Design:**
- **Disabled by default**: Cost tracking must be explicitly enabled
- **Minimal configuration**: Sensible defaults require minimal setup
- **Flexible pricing**: Support for both global and provider-specific pricing

**Backward Compatibility:**
- **Optional configuration**: Existing configurations work without modification
- **Graceful degradation**: System functions normally when cost tracking fails
- **Migration support**: Automatic configuration updates for schema changes

### Error Handling

**Comprehensive Error Handling Strategy:**

**Cost Calculation Errors:**
- **Missing pricing data**: Graceful fallback to default pricing
- **Invalid token data**: Error logging without breaking functionality
- **Calculation failures**: System continues with cost tracking disabled
- **Configuration errors**: Clear error messages with system degradation

**Data Validation:**
- **Input validation**: Comprehensive validation for cost configuration and data
- **Type safety**: Strong TypeScript interfaces for all cost-related types
- **Runtime validation**: JSON schema validation for configuration data
- **Error recovery**: Automatic fallback to safe defaults

## Benefits of New Architecture

1. **Enhanced Cost Awareness**
   - Real-time cost visibility for all LLM usage
   - Per-model cost breakdowns for optimization insights
   - Historical cost tracking for budget management

2. **Seamless Integration**
   - Non-intrusive addition to existing functionality
   - Zero-impact when cost tracking is disabled
   - Consistent with existing configuration and status line patterns

3. **Performance Optimized**
   - Asynchronous cost calculation prevents blocking
   - Efficient caching minimizes computational overhead
   - Memory-conscious design scales with usage

4. **Extensible Design**
   - Plugin-ready architecture for future enhancements
   - API foundation for external cost management tools
   - Multi-currency preparation for global deployment

5. **Production Ready**
   - Comprehensive testing ensures reliability
   - Error handling maintains system stability
   - Configuration validation prevents misconfiguration

## Risk Assessment

**Low Risk Areas:**
- Cost calculation logic is well-understood and deterministic
- Integration with existing token tracking is straightforward
- Status line system already supports modular extensions
- Configuration system has established patterns for new features

**Medium Risk Areas:**
- Performance impact of real-time cost calculation requires careful testing
- Error handling for complex pricing configurations needs thorough validation
- User experience impact of cost display requires iterative refinement

**High Risk Areas:**
- Memory usage growth with cost history persistence needs monitoring
- Integration complexity across multiple system components
- Configuration schema evolution and migration challenges

**Mitigation Strategies:**
- Comprehensive performance testing at each implementation phase
- Gradual feature rollout with configurable enablement
- Extensive error handling and graceful degradation
- Regular performance profiling and optimization

## Success Criteria

- [ ] **Cost Calculation**: Accurate cost calculation for all supported providers and models
- [ ] **Status Line Integration**: Rich cost display with multiple formatting options
- [ ] **API Endpoints**: Complete REST API for cost data access and management
- [ ] **Performance**: <5ms overhead for cost calculation, <1% memory increase
- [ ] **Backward Compatibility**: Existing functionality unchanged with cost tracking disabled
- [ ] **Error Handling**: Graceful degradation for all error scenarios
- [ ] **Testing**: >90% code coverage for cost tracking components
- [ ] **Documentation**: Complete configuration and API documentation
- [ ] **Configuration Validation**: All configurations pass schema validation
- [ ] **Production Readiness**: Performance and security validation completed

## Migration Considerations

- **No breaking changes** to existing configurations or APIs
- **Gradual enhancement** - cost tracking is additive and optional
- **Backward compatibility** - all existing functionality preserved
- **Configuration migration** - automatic schema updates with user notification
- **Performance impact** - minimal when cost tracking is disabled
- **Storage impact** - cost data only stored when explicitly enabled

## Technical Implementation Notes

*Note: This implementation leverages existing architectural patterns including the token usage cache, status line module system, and configuration management infrastructure. All cost tracking features are designed as enhancements that integrate seamlessly without disrupting core routing functionality.*

---

## PLAN REVIEW RESULTS

### Redundancies Found:
- None identified - each phase builds upon previous work with minimal overlap
- Testing is integrated throughout rather than as separate phase
- Configuration work is distributed across relevant phases

### Inconsistencies Found:
- None identified - consistent approach follows existing codebase patterns
- Error handling strategy consistent across all components
- Performance considerations addressed in each phase

### Missing Critical Details:
- Specific database schema for cost history persistence (marked as optional)
- Detailed security considerations for cost data access (existing patterns apply)
- Specific performance benchmarks and SLA requirements (to be defined in Phase 4)