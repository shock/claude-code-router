# Phase 2 Execution Plan: Status Line Provider Implementation

## Introduction

**Phase Overview**: Implement the cost status line provider with comprehensive variable generation, dynamic model-specific variables, and integration with the existing status line system. This phase enables real-time cost display in the status line with support for various formatting options and error states.

**Critical Instruction**: If any steps cannot be completed due to missing dependencies, configuration issues, or unexpected codebase changes, execution should be aborted, the status document updated with specific blocking issues, and the user notified immediately.

## Pre-Implementation Steps

**IMPORTANT**: These steps should NOT use sub-agents and should be executed by the main agent.

### Step 1: Master Plan Review
- Read the entire master plan document at `admin/cost/master_plan.md` to understand complete scope and context for Phase 2
- Focus on sections: "Phase 2: Status Line Provider Implementation" and "Status Line Integration Strategy"
- Understand the existing status line architecture and integration points

### Step 2: Status Assessment
- Read `admin/cost/status/phase_1_execution_status.md` to understand current implementation state
- Verify that Phase 1 was completed successfully with all core components in place
- Confirm that cost calculator and configuration validation are operational

### Step 3: Test Suite Validation
- Run full test suite using `pnpm test`
- **If tests fail and status shows they should pass**: Stop and notify user
- **If tests fail and status shows they were failing**: Make note and continue
- Verify current test count and coverage metrics match Phase 1 completion status

### Step 4: Codebase Review
- Review existing status line system in `src/utils/statusline.ts`
- Understand variable substitution patterns and provider registration
- Identify integration points for cost status line provider
- Verify existing status line module types and configuration patterns

## Sub-Agent Usage Policy

**MANDATORY SUB-AGENT USAGE FOR IMPLEMENTATION**

- For every implementation step, the execution plan must:
  - Clearly indicate that the step is to be performed by a sub-agent
  - Specify the type of sub-agent to be used (e.g., file editor, test runner, debugger)
  - Avoid instructing the main agent to perform implementation steps directly
- The only exceptions are pre-implementation steps, which must be performed by the main agent

## Implementation Steps

### Step 1: Create Enhanced CostStatusLineProvider with Dynamic Model Variables

**Sub-Agent Type**: General-purpose agent

**Task**: Create `src/utils/costStatusLineProvider.ts` with comprehensive variable generation

**Requirements from Master Plan**:
- Implement status line variable provider interface with enhanced dynamic model-specific variables
- Support the following base variables:
  - `{{totalCost}}` - Formatted total session cost
  - `{{totalCostRaw}}` - Raw numeric total cost
  - `{{sessionDuration}}` - Session duration
  - `{{modelCosts}}` - JSON string of per-model costs
  - `{{topModel}}` - Most expensive model used
  - `{{topModelCost}}` - Cost of most expensive model
  - `{{trackingStatus}}` - Current tracking state (Active/Partial/Disabled)
  - `{{statusMessage}}` - Detailed status message
  - `{{statusColor}}` - Color indicator for status
- Support dynamic model-specific variables in format: `{{cost.<provider>_<model>}}` (e.g., `{{cost.openai_gpt_4}}`)
- Handle disabled state with appropriate fallback messages
- Implement currency formatting with locale support
- Implement duration formatting for session time

**Source Code from Master Plan**:
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
      // Generate variables for each model in format: cost.<provider>_<model>
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

**Testing Requirements**:
- Create comprehensive unit tests for the cost status line provider
- Test all variable generation scenarios (enabled, disabled, no session, active session)
- Test dynamic model variable generation
- Test currency and duration formatting
- Test error handling and fallback behavior
- Ensure >90% test coverage for the provider

### Step 2: Extend Status Line System with Cost Provider Registration

**Sub-Agent Type**: General-purpose agent

**Task**: Extend existing status line system to support cost provider registration

**Requirements from Master Plan**:
- Add global cost provider registration to `src/utils/statusline.ts`
- Extend `parseStatusLineData` function to include cost variables
- Ensure cost variables are available for substitution in status line templates

**Source Code from Master Plan**:
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

**Testing Requirements**:
- Test that cost variables are properly integrated into existing status line system
- Verify variable substitution works correctly with cost variables
- Test that cost provider registration functions correctly
- Ensure backward compatibility with existing status line functionality

### Step 3: Router Initialization Integration

**Sub-Agent Type**: General-purpose agent

**Task**: Integrate cost status line provider during router initialization

**Requirements from Master Plan**:
- Register cost provider during router initialization in `src/index.ts`
- Ensure cost calculator is available before registering provider
- Handle cases where cost tracking is disabled

**Source Code from Master Plan**:
```typescript
// In src/index.ts - during router initialization
if (costCalculator && costTrackingConfig.enabled) {
  const costStatusLineProvider = new CostStatusLineProvider(costCalculator);
  registerCostStatusLineProvider(costStatusLineProvider);
}
```

**Testing Requirements**:
- Test router initialization with cost tracking enabled and disabled
- Verify provider registration occurs correctly
- Test that cost variables are available after initialization

### Step 4: Comprehensive Error Handling and Status Display

**Sub-Agent Type**: General-purpose agent

**Task**: Implement comprehensive error handling and status display for cost tracking

**Requirements from Master Plan**:
- Implement color-coded status: Green for active, Yellow for partial, Red for disabled/error states
- Provide clear status messages: "Active", "Partial (2 models unconfigured)", "Disabled", "Error"
- Support dynamic model variables with fallback values
- Include configuration guidance in error messages
- Support progressive disclosure for detailed status messages

**Testing Requirements**:
- Test all error states and corresponding status messages
- Verify color coding works correctly
- Test fallback behavior for missing model variables
- Ensure error messages are clear and actionable

### Step 5: Enhanced Variable Substitution Support

**Sub-Agent Type**: General-purpose agent

**Task**: Ensure existing variable substitution system supports cost variables

**Requirements from Master Plan**:
- The existing `replaceVariables` function in `src/utils/statusline.ts` already supports the `{{variable}}` pattern
- Verify that cost variables work seamlessly with the current system
- Ensure all cost variables are properly substituted in status line templates

**Testing Requirements**:
- Test all cost variable substitution patterns
- Verify variable names are correctly resolved
- Test edge cases with special characters in model names
- Ensure backward compatibility with existing variable substitution

### Step 6: Status Line Configuration Examples

**Sub-Agent Type**: General-purpose agent

**Task**: Create comprehensive status line configuration examples

**Requirements from Master Plan**:
- Create default configuration examples for cost display
- Support various formatting options and use cases
- Provide examples for different levels of detail

**Source Code from Master Plan**:
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
          "text": "{{cost.openai_gpt_4}}",
          "color": "bright_cyan"
        }
      ]
    }
  }
}
```

**Testing Requirements**:
- Test all configuration examples work correctly
- Verify variable substitution in different configuration scenarios
- Test color coding and icon support
- Ensure configuration validation handles cost module types

### Step 7: Create Comprehensive Unit Tests

**Sub-Agent Type**: Test runner agent

**Task**: Create comprehensive unit tests for all Phase 2 components

**Testing Requirements**:
- Create `tests/utils/costStatusLineProvider.test.ts` with comprehensive test coverage
- Test all variable generation scenarios:
  - Enabled state with active session
  - Disabled state when cost tracking is disabled
  - No session data available
  - Multiple models with costs
  - Error states and fallback behavior
- Test dynamic model variable generation for various model formats
- Test currency formatting with different currencies
- Test duration formatting for various time periods
- Test top model identification logic
- Test error handling and graceful degradation
- Ensure >90% test coverage for the cost status line provider
- Mock cost calculator for controlled testing scenarios

### Step 8: Update and Extend Integration Tests

**Sub-Agent Type**: Test runner agent

**Task**: Update existing integration tests to include cost status line functionality

**Testing Requirements**:
- Update existing router integration tests to verify cost status line integration
- Test cost variable substitution in status line templates
- Verify provider registration and initialization
- Test end-to-end cost tracking with status line display
- Ensure backward compatibility with existing status line functionality

### Step 9: Manual Testing and Validation

**Sub-Agent Type**: General-purpose agent

**Task**: Perform manual testing and validation of the complete Phase 2 implementation

**Testing Requirements**:
- Test with live router and real API responses
- Verify cost calculation accuracy in status line display
- Test status line display with various configurations
- Validate session reset behavior
- Test error scenarios and graceful degradation
- Verify all cost variables are properly displayed

## Next Steps

### Step 1: Final Test Run
- Run full test suite using `pnpm test`
- Verify all tests pass (expecting increased test count from Phase 1)
- Check test coverage metrics for new code
- Ensure build compilation is successful

### Step 2: Status Documentation
- Create `admin/cost/status/phase_2_execution_status.md`
- Document current phase execution steps with status ("COMPLETED", "IN PROGRESS", "NOT STARTED", "NEEDS CLARIFICATION")
- Document final status of the test suite including test count and coverage
- Include a summary of the phase execution and what was accomplished
- Note any risks or blocking issues encountered
- End the status document with a single overarching next step for Phase 3

## Critical Requirements Checklist

- **TESTING REQUIREMENTS**: Include specific test requirements for all new code - ✅ Covered in Steps 1, 7, 8, 9
- **BACKWARD COMPATIBILITY**: Explicitly address backward compatibility concerns - ✅ Covered in Steps 2, 5
- **ERROR HANDLING**: Document error handling preservation requirements - ✅ Covered in Steps 1, 4
- **STATUS TRACKING**: Include status document creation/update instructions - ✅ Covered in Next Steps
- **SUB-AGENT USAGE**: The execution plan must explicitly require the use of sub-agents for all implementation steps, and must specify which sub-agent is responsible for each step - ✅ All implementation steps specify sub-agent usage

## Success Criteria

- [ ] Cost status line provider implemented with comprehensive variable generation
- [ ] Dynamic model-specific variables work correctly
- [ ] Status line system extended to support cost provider registration
- [ ] Router initialization integrates cost status line provider
- [ ] Comprehensive error handling and status display implemented
- [ ] Variable substitution supports all cost variables
- [ ] Configuration examples work correctly
- [ ] Comprehensive unit tests created and passing
- [ ] Integration tests updated and passing
- [ ] Manual testing confirms expected behavior
- [ ] All existing tests continue to pass
- [ ] >90% test coverage for new code
- [ ] Build compilation successful
- [ ] Status documentation created and accurate