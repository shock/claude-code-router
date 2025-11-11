# Phase 3 Execution Plan: Token Capture Integration

## Introduction

**High-level Overview**: Phase 3 focuses on integrating cost tracking with the existing API response processing system. This phase will hook into the router's `onSend` hook to capture token usage data from API responses, extract model information from routing decisions, associate data with session IDs, and pass the information to the cost calculator for real-time cost calculation.

**Critical Instruction**: If any steps cannot be completed due to missing dependencies, integration issues, or unexpected architectural changes, execution should be aborted, the status document updated with the specific blocking issues, and the user notified immediately.

## Pre-Implementation Steps

**IMPORTANT**: These steps should NOT use sub-agents and should be executed by the main agent.

### Step 1: Master Plan Review
- Read the entire master plan document at `admin/cost/master_plan.md` to understand complete scope and context
- Focus on "Phase 3: Token Capture Integration" section and related integration points
- Review "Session Management Strategy" and "Integration Points" sections

### Step 2: Status Assessment
- Scan `admin/cost/status` directory for current execution status
- Read `admin/cost/status/phase_2_execution_status.md` to understand current implementation state
- Verify Phase 2 was completed successfully with cost status line provider and router initialization
- **Risk Check**: If execution seems premature/risky, stop and notify user

### Step 3: Test Suite Validation
- Run full test suite using `pnpm test`
- **If tests fail and status shows they should pass**: Stop and notify user
- **If tests fail and status shows they were failing**: Make note and continue
- Current baseline: 148 tests passing, 1 test skipped (149 total)

### Step 4: Codebase Review
- Review existing `onSend` hook implementation in `src/index.ts` (lines 397-400)
- Review session ID extraction in `src/utils/router.ts` (lines 185-190)
- Review model assignment in `src/utils/router.ts` (line 224)
- Review existing token usage cache pattern in `src/index.ts` (line 383)
- Understand existing API response structure and `payload.usage` object

## Sub-Agent Usage Policy

**MANDATORY SUB-AGENT USAGE FOR IMPLEMENTATION**

- For every implementation step, the execution plan must:
    - Clearly indicate that the step is to be performed by a sub-agent.
    - Specify the type of sub-agent to be used (e.g., file editor, test runner, debugger).
    - Avoid instructing the main agent to perform implementation steps directly.
- The only exceptions are pre-implementation steps, which must be performed by the main agent.

## Implementation Steps

### Step 1: Extend onSend Hook for Token Capture

**Sub-Agent Type**: General-purpose agent

**Objective**: Integrate cost calculation with the existing `onSend` hook to capture token usage data from API responses.

**Implementation Details**:
- **Location**: Extend the existing `onSend` hook in `src/index.ts` (lines 397-400)
- **Integration Point**: Add cost calculation logic after the existing `event.emit('onSend', ...)` call
- **Data Sources**:
  - Token counts: Extract from `payload.usage` object containing `input_tokens` and `output_tokens`
  - Model information: Extract from `req.body.model` set by router at line 224 in `src/utils/router.ts`
  - Session ID: Extract from `req.sessionId` from metadata extraction at lines 185-190 in `src/utils/router.ts`
- **Asynchronous Processing**: Use `process.nextTick()` to avoid blocking request processing
- **Error Handling**: Comprehensive error handling to prevent request failures

**Source Code Example from Master Plan**:
```typescript
// In the onSend hook (src/index.ts line 397-400)
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

**Test Requirements**:
- Unit tests for token extraction from various payload formats
- Integration tests for cost calculation during API response processing
- Error handling tests for malformed payload data
- Performance tests to ensure no request processing delays

### Step 2: Ensure Cost Calculator Availability in Router Context

**Sub-Agent Type**: General-purpose agent

**Objective**: Ensure the cost calculator instance is available in the router context for the `onSend` hook.

**Implementation Details**:
- **Location**: Router initialization in `src/index.ts` and router middleware in `src/utils/router.ts`
- **Current State**: Cost calculator is already initialized in Phase 1 and passed to router context
- **Verification**: Confirm cost calculator is properly passed through the router context chain
- **Integration**: Ensure the cost calculator instance is accessible in the `onSend` hook context

**Source Code Example from Master Plan**:
```typescript
// In src/index.ts - during router initialization
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

// Pass cost calculator to router context
const context = {
  config,
  event,
  costCalculator  // Ensure this is passed to router
};
```

**Test Requirements**:
- Integration tests for cost calculator availability in router context
- Tests for cost calculator initialization and configuration
- Error handling tests for missing cost calculator

### Step 3: Create Integration Tests for Token Capture

**Sub-Agent Type**: General-purpose agent

**Objective**: Create comprehensive integration tests to verify token capture and cost calculation during API response processing.

**Implementation Details**:
- **Location**: Create `tests/integration/tokenCaptureIntegration.test.ts`
- **Test Scenarios**:
  - Test token extraction from various API response formats
  - Test cost calculation with different token counts and model configurations
  - Test session association and cost accumulation
  - Test error handling for malformed payloads
  - Test asynchronous processing to ensure no request blocking
  - Test edge cases (zero tokens, missing usage data, etc.)
- **Mock Strategy**: Mock API responses with different usage data structures
- **Verification**: Verify cost calculator receives correct data and calculates costs accurately

**Test Requirements**:
- Minimum 15 comprehensive integration test cases
- Coverage for all token capture scenarios
- Performance validation for non-blocking behavior
- Error handling validation for edge cases

### Step 4: Create Unit Tests for Token Capture Logic

**Sub-Agent Type**: General-purpose agent

**Objective**: Create focused unit tests for the token capture logic in the `onSend` hook.

**Implementation Details**:
- **Location**: Create `tests/utils/tokenCapture.test.ts`
- **Test Scenarios**:
  - Test token extraction from payload.usage object
  - Test model information extraction from req.body.model
  - Test session ID extraction from req.sessionId
  - Test conditional logic for cost calculation
  - Test error handling for various failure scenarios
  - Test asynchronous processing behavior
- **Mock Strategy**: Mock request, reply, and payload objects
- **Focus**: Test the specific token capture logic independently

**Test Requirements**:
- Minimum 10 focused unit test cases
- Coverage for all conditional branches in token capture logic
- Error handling validation
- Performance validation

### Step 5: Update Existing Integration Tests

**Sub-Agent Type**: General-purpose agent

**Objective**: Update existing router integration tests to include cost tracking verification.

**Implementation Details**:
- **Location**: Update `tests/integration/costTracking.test.ts`
- **Test Enhancements**:
  - Add tests for cost calculation during API response processing
  - Verify cost accumulation across multiple requests
  - Test session-based cost tracking
  - Verify status line variable updates after cost calculation
  - Test error handling and graceful degradation
- **Integration**: Ensure tests work with existing router functionality
- **Backward Compatibility**: Verify no regression in existing test functionality

**Test Requirements**:
- Update at least 5 existing test cases to include cost verification
- Add 5 new test cases specifically for token capture integration
- Ensure all existing tests continue to pass

### Step 6: Manual Testing and Validation

**Sub-Agent Type**: General-purpose agent

**Objective**: Perform manual testing to validate token capture and cost calculation in real-world scenarios.

**Implementation Details**:
- **Testing Strategy**:
  - Test with live router and real API responses
  - Verify cost calculation accuracy with known token counts
  - Test session-based cost accumulation
  - Verify status line display updates correctly
  - Test error scenarios and graceful degradation
- **Validation Points**:
  - Token counts are correctly extracted from API responses
  - Model information is correctly associated with token usage
  - Session IDs are properly maintained across requests
  - Cost calculations are accurate and consistent
  - Status line variables update in real-time

**Test Requirements**:
- Manual test scenarios covering all major use cases
- Validation of real-time cost tracking behavior
- Performance impact assessment
- Error scenario validation

## Next Steps

### Step 1: Final Test Run
- Run full test suite using `pnpm test`
- Verify all tests pass (current baseline: 148 passing, 1 skipped)
- Run test coverage using `pnpm run test:coverage`
- Verify >90% coverage for all new code

### Step 2: Status Documentation
- Create/update `admin/cost/status/phase_3_execution_status.md`
- Document current phase execution steps:
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
- ✅ **SUB-AGENT USAGE**: The execution plan must explicitly require the use of sub-agents for all implementation steps, and must specify which sub-agent is responsible for each step

## Risk Assessment

**Low Risk Areas**:
- Token extraction from payload.usage object
- Model information extraction from req.body.model
- Unit test creation

**Medium Risk Areas**:
- Integration with existing onSend hook
- Asynchronous processing implementation
- Cost calculator availability in router context

**High Risk Areas**:
- Complex error handling scenarios
- Performance impact on request processing
- Integration with existing session management

**Mitigation Strategies**:
- Comprehensive testing at each step
- Gradual integration with existing systems
- Extensive error handling and logging
- Performance monitoring and optimization