# Phase 4 Execution Plan: Status Line Integration

## 1. Introduction

**Phase Overview:** This phase focuses on integrating the cost tracking functionality with the status line system to provide real-time cost display to users. The goal is to add "cost" module type support, register the cost status line provider, and implement comprehensive status line configuration for cost display.

**Critical Instruction:** If any steps cannot be completed due to missing dependencies, configuration issues, or unexpected codebase changes, execution should be aborted, the status document updated with specific blocking issues, and the user notified immediately.

## 2. Pre-Implementation Steps

**IMPORTANT**: These steps should NOT use sub-agents and should be executed by the main agent.

### Step 1: Master Plan Review
- Read the entire master plan document at `admin/cost/master_plan.md` to understand complete scope and context
- Focus on "Phase 4: Status Line Integration" section (lines 897-915)
- Review "Status Line Integration Strategy" section (lines 1054-1067)
- Review "Status Line Configuration Examples" section (lines 806-845)

### Step 2: Status Assessment
- Read `admin/cost/status/phase_3_execution_status.md` to understand current implementation state
- Verify Phase 3 was completed successfully with token capture integration
- Confirm cost calculator and status line provider are operational
- Check for any unresolved issues from previous phases

### Step 3: Test Suite Validation
- Run full test suite using `pnpm test` to establish baseline
- Verify current test status (237 tests passing, 1 skipped)
- If tests fail and status shows they should pass: Stop and notify user
- If tests fail and status shows they were failing: Make note and continue

### Step 4: Codebase Review
- Review existing status line system in `src/utils/statusline.ts`
- Understand current module types and variable substitution patterns
- Review existing status line configuration schema in `ui/src/types.ts`
- Understand how providers are registered and used in the status line system

## 3. Sub-Agent Usage Policy

**MANDATORY SUB-AGENT USAGE FOR IMPLEMENTATION**

- For every implementation step, the execution plan must:
  - Clearly indicate that the step is to be performed by a sub-agent.
  - Specify the type of sub-agent to be used (e.g., file editor, test runner, debugger).
  - Avoid instructing the main agent to perform implementation steps directly.
- The only exceptions are pre-implementation steps, which must be performed by the main agent.

## 4. Implementation Steps

### Step 1: Extend Status Line Configuration Schema
- **Sub-Agent Type**: General-purpose agent
- **Task**: Extend the status line configuration schema to support "cost" module type
- **Location**: Update `ui/src/types.ts` to add cost module configuration
- **Requirements**:
  - Add `CostModule` interface extending base `StatusLineModule`
  - Add `"cost"` to the `StatusLineModuleType` union type
  - Support cost-specific properties: `show_breakdown`, `precision`, `format`
  - Ensure backward compatibility with existing module types
- **Source Code Example from Master Plan**:
  ```typescript
  // In ui/src/types.ts - extend StatusLineModuleType
  type StatusLineModuleType = "git" | "workdir" | "model" | "tokens" | "cost";

  // Add CostModule interface
  interface CostModule extends StatusLineModuleBase {
    type: "cost";
    show_breakdown?: boolean;
    precision?: number;
    format?: "currency" | "decimal" | "scientific" | "compact";
  }
  ```

### Step 2: Implement Cost Module Handler
- **Sub-Agent Type**: General-purpose agent
- **Task**: Create cost module handler in status line system
- **Location**: Extend `src/utils/statusline.ts` with cost module support
- **Requirements**:
  - Add cost module type to the module type handlers
  - Support template variables from cost provider
  - Handle formatting options (currency, decimal, scientific, compact)
  - Support precision configuration
  - Handle disabled state display gracefully
- **Integration Points**:
  - Integrate with existing `parseStatusLineData` function
  - Use global `costStatusLineProvider` instance
  - Support all cost variables defined in Phase 2

### Step 3: Register Cost Status Line Provider Globally
- **Sub-Agent Type**: General-purpose agent
- **Task**: Ensure cost status line provider is properly registered globally
- **Location**: Verify and enhance provider registration in `src/utils/statusline.ts`
- **Requirements**:
  - Confirm global `costStatusLineProvider` variable exists
  - Verify `registerCostStatusLineProvider` function is properly implemented
  - Ensure provider is accessible throughout status line processing
  - Handle cases where cost tracking is disabled
- **Source Code Example from Master Plan**:
  ```typescript
  // Global cost provider instance
  let costStatusLineProvider: CostStatusLineProvider | null = null;

  // Function to register cost provider
  export function registerCostStatusLineProvider(provider: CostStatusLineProvider): void {
    costStatusLineProvider = provider;
  }
  ```

### Step 4: Update Router Initialization for Provider Registration
- **Sub-Agent Type**: General-purpose agent
- **Task**: Ensure cost provider is registered during router initialization
- **Location**: Verify and enhance `src/index.ts` router initialization
- **Requirements**:
  - Confirm cost provider registration happens after cost calculator initialization
  - Ensure registration only occurs when cost tracking is enabled
  - Handle initialization errors gracefully
  - Maintain existing router startup patterns
- **Source Code Example from Master Plan**:
  ```typescript
  // In src/index.ts - during router initialization
  if (costCalculator && costTrackingConfig.enabled) {
    const costStatusLineProvider = new CostStatusLineProvider(costCalculator);
    registerCostStatusLineProvider(costStatusLineProvider);
  }
  ```

### Step 5: Create Unit Tests for Status Line Cost Module
- **Sub-Agent Type**: General-purpose agent
- **Task**: Create comprehensive unit tests for cost module functionality
- **Location**: Create `tests/utils/statusLineCostModule.test.ts`
- **Requirements**:
  - Test cost module handler with various configurations
  - Test variable substitution for all cost variables
  - Test formatting options (currency, decimal, scientific, compact)
  - Test precision configuration
  - Test disabled state handling
  - Test error scenarios and graceful degradation
  - Achieve >90% test coverage for new code
- **Test Scenarios**:
  - Basic cost display with default formatting
  - Custom precision and format configurations
  - Model-specific cost variables
  - Disabled cost tracking state
  - Missing cost provider scenarios
  - Error handling during variable substitution

### Step 6: Create Integration Tests for Status Line Cost Integration
- **Sub-Agent Type**: General-purpose agent
- **Task**: Create integration tests for end-to-end status line cost display
- **Location**: Create `tests/integration/statusLineCostIntegration.test.ts`
- **Requirements**:
  - Test complete status line processing with cost modules
  - Test variable substitution in real status line configurations
  - Test integration between cost calculator and status line provider
  - Test session-based cost tracking in status line
  - Test configuration validation for cost modules
  - Test backward compatibility with existing status line functionality
- **Test Scenarios**:
  - Status line with cost module using {{totalCost}} variable
  - Status line with model-specific cost variables
  - Multiple cost modules in single status line configuration
  - Cost module with custom formatting and precision
  - Status line updates after cost calculation
  - Session reset and cost tracking continuity

### Step 7: Update Existing Status Line Tests
- **Sub-Agent Type**: General-purpose agent
- **Task**: Update existing status line tests to include cost module coverage
- **Location**: Update relevant test files in `tests/` directory
- **Requirements**:
  - Extend existing status line test suites with cost module cases
  - Ensure backward compatibility with existing test functionality
  - Add cost-specific test cases to existing integration tests
  - Verify cost variables work with existing variable substitution system
  - Test mixed module configurations (cost + existing modules)

### Step 8: Create Configuration Validation Tests
- **Sub-Agent Type**: General-purpose agent
- **Task**: Create tests for cost module configuration validation
- **Location**: Create `tests/config/statusLineCostConfig.test.ts`
- **Requirements**:
  - Test cost module configuration schema validation
  - Test invalid cost module configurations
  - Test missing required properties
  - Test type validation for cost module properties
  - Test configuration loading with cost modules
  - Test error handling for malformed cost configurations

## 5. Testing Requirements

### Unit Testing Requirements
- **Coverage**: >90% for all new code
- **Scope**: All cost module functionality, variable substitution, formatting
- **Edge Cases**: Invalid configurations, missing providers, disabled states
- **Performance**: Non-blocking status line processing

### Integration Testing Requirements
- **End-to-End**: Complete status line processing with cost tracking
- **Session Management**: Cost accumulation across multiple requests
- **Configuration**: Various cost module configurations and formats
- **Error Handling**: Graceful degradation for all failure scenarios

### Regression Testing Requirements
- **Backward Compatibility**: All existing status line functionality continues working
- **Existing Tests**: All 237 existing tests continue to pass
- **Build System**: Successful compilation with no errors
- **Performance**: No degradation in status line processing speed

## 6. Configuration Examples

### Basic Cost Display Configuration
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

### Detailed Cost Configuration with Breakdown
```json
{
  "StatusLine": {
    "detailed": {
      "modules": [
        {
          "type": "cost",
          "icon": "💰",
          "text": "{{totalCost}} ({{trackingStatus}})",
          "color": "{{statusColor}}",
          "precision": 6,
          "format": "currency"
        },
        {
          "type": "cost",
          "icon": "🤖",
          "text": "{{cost.openai_gpt_4}}",
          "color": "bright_cyan"
        }
      ]
    }
  }
}
```

### Mixed Module Configuration
```json
{
  "StatusLine": {
    "default": {
      "modules": [
        {
          "type": "git",
          "icon": "🌿",
          "text": "{{gitBranch}}"
        },
        {
          "type": "cost",
          "icon": "💵",
          "text": "{{totalCost}}",
          "color": "bright_green"
        },
        {
          "type": "tokens",
          "icon": "🧮",
          "text": "{{inputTokens}}/{{outputTokens}}"
        }
      ]
    }
  }
}
```

## 7. Next Steps

### Step 1: Final Test Run
- Run full test suite using `pnpm test`
- Verify all tests pass (expected: 237+ tests passing)
- Check test coverage meets requirements (>90% for new code)
- Validate build compilation is successful

### Step 2: Status Documentation
- Create/update `admin/cost/status/phase_4_execution_status.md`
- Document current phase execution steps with status ("COMPLETED", "IN PROGRESS", "NOT STARTED", "NEEDS CLARIFICATION")
- Document final status of the test suite
- Include a summary of the phase execution and what was accomplished
- Note any risks or blocking issues
- End the status document with a single overarching next step: "Proceed to Phase 5: Comprehensive Testing and Validation"

## 8. Risk Assessment

### Low Risk Areas
- Configuration schema extension
- Cost module handler implementation
- Unit test creation

### Medium Risk Areas
- Integration with existing status line system
- Provider registration and global state management
- Variable substitution integration

### High Risk Areas
- Complex configuration validation
- Error handling for missing providers
- Performance impact on status line processing

### Mitigation Strategies
- Comprehensive testing at each step
- Gradual integration with existing systems
- Extensive error handling and logging
- Performance monitoring and optimization

## 9. Success Criteria

- [ ] Cost module type added to status line configuration schema
- [ ] Cost module handler implemented in status line system
- [ ] Cost status line provider properly registered globally
- [ ] All cost variables supported in status line templates
- [ ] Formatting options (currency, decimal, scientific, compact) working
- [ ] Precision configuration working correctly
- [ ] Disabled state handled gracefully
- [ ] Comprehensive test coverage (>90% for new code)
- [ ] All existing tests continue to pass
- [ ] Configuration examples working as expected
- [ ] Backward compatibility maintained with existing status line functionality