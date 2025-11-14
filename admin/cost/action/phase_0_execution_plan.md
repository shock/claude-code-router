# Phase 0 Execution Plan: Foundational Analysis and Setup

## Introduction

Phase 0 establishes the foundational infrastructure for cost tracking implementation. This phase focuses on analyzing the current architecture, setting up test infrastructure, extending the configuration schema, and establishing baseline tests. The goal is to create a solid foundation for subsequent phases while ensuring no disruption to existing router functionality.

**Critical Instruction**: If any steps cannot be completed due to missing files, unexpected codebase structure, or test failures that should pass according to status, execution should be aborted, status document updated, and user notified immediately.

## Pre-Implementation Steps

**IMPORTANT**: These steps must be executed by the main agent, NOT sub-agents.

### Step 1: Master Plan Review
- Read the entire master plan document at `admin/cost/master_plan.md` to understand complete scope and context
- Verify understanding of cost tracking objectives, architecture, and integration points

### Step 2: Status Assessment
- Scan `admin/cost/status` directory for current execution status
- **Current Status**: No status files exist, indicating this is the initial phase execution
- **Risk Check**: No previous execution status found, proceed with caution and verify test suite baseline

### Step 3: Test Suite Validation
- Run full test suite to establish baseline
- **If tests fail and status shows they should pass**: Stop and notify user
- **If tests fail and status shows they were failing**: Make note and continue

### Step 4: Codebase Review
- Review codebase and understand relevant code files/modules
- Identify key integration points mentioned in master plan:
  - Token capture points in API response processing
  - Session management patterns
  - Status line architecture
  - Configuration loading patterns

## Sub-Agent Usage Policy

**MANDATORY SUB-AGENT USAGE FOR IMPLEMENTATION**

For every implementation step, the execution plan must:
- Clearly indicate that the step is to be performed by a sub-agent
- Specify the type of sub-agent to be used (e.g., file editor, test runner, debugger)
- Avoid instructing the main agent to perform implementation steps directly

The only exceptions are pre-implementation steps, which must be performed by the main agent.

## Implementation Steps

**MANDATORY: All implementation steps must be performed by sub-agents.**

### Step 1: Analyze Current Architecture

**Sub-Agent Type**: Explore agent with "very thorough" thoroughness level

**Task**: Analyze current router architecture to identify integration points

**Detailed Instructions**:
- Verify token capture points in API response processing
- Confirm session management patterns and LRU cache usage
- Document existing status line architecture and variable substitution
- Identify integration points for cost tracking:
  - API response processing (`onSend` hook in `src/index.ts` lines 374-377)
  - Session ID extraction (`src/utils/router.ts` lines 185-190)
  - Model information routing (`src/utils/router.ts` line 224)
  - Status line variable substitution system
  - Configuration loading patterns

**Test Requirements**:
- Verify all identified integration points exist and are accessible
- Document current behavior for baseline comparison

### Step 2: Establish Baseline Tests

**Sub-Agent Type**: Test runner agent

**Task**: Ensure existing router tests pass and document current status line behavior

**Detailed Instructions**:
- Run existing test suite to establish baseline performance
- Document current status line behavior and variable support
- Verify configuration loading patterns work correctly
- Create baseline test documentation for regression testing

**Test Requirements**:
- All existing router tests must pass
- Document test coverage and any failing tests
- Create baseline performance metrics

### Step 3: Test Infrastructure Setup

**Sub-Agent Type**: File editor agent

**Task**: Set up comprehensive test infrastructure for cost tracking

**Detailed Instructions**:

#### 3.1: Install Test Framework Dependencies
- Install Jest test framework with TypeScript support:
  ```bash
  npm install --save-dev jest @types/jest ts-jest
  ```

#### 3.2: Create Jest Configuration
- Create `jest.config.js` with TypeScript support:
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

#### 3.3: Create Test Directory Structure
- Create organized test structure:
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

#### 3.4: Add Test Scripts to package.json
- Add test scripts to `package.json`:
  ```json
  {
    "scripts": {
      "test": "jest",
      "test:watch": "jest --watch",
      "test:coverage": "jest --coverage"
    }
  }
  ```

#### 3.5: Create Test Utilities and Fixtures
- Create test utilities for cost tracking scenarios
- Create configuration fixtures for testing
- Set up mock data for controlled testing

**Test Requirements**:
- Test framework installation must succeed
- Jest configuration must be valid and functional
- Test scripts must execute without errors
- Test directory structure must be created successfully

### Step 4: Configuration Schema Extension

**Sub-Agent Type**: File editor agent

**Task**: Extend configuration schema with CostTracking section

**Detailed Instructions**:

#### 4.1: Extend Main Configuration Interface
- Extend the main `Config` interface in `ui/src/types.ts` (line 52)
- Add `CostTracking?: CostTrackingConfig;` to the interface
- Create type definitions for cost tracking configuration:
  ```typescript
  interface CostTrackingConfig {
    enabled?: boolean;
    default_currency?: string;
    model_pricing?: Record<string, ModelPricing>;
  }

  interface ModelPricing {
    input_cost_per_million: number;
    output_cost_per_million: number;
    currency?: string;
  }
  ```

#### 4.2: Add Model Pricing Validation
- Implement validation for `<provider>,<model>` format
- Add validation rules for pricing values (must be positive numbers)
- Support default_currency configuration with sensible defaults
- Implement configuration validation rules

#### 4.3: Create Configuration Example
- Create comprehensive configuration example in documentation
- Include examples for different providers and models
- Document all available configuration options

**Test Requirements**:
- Configuration schema extension must compile without errors
- Type definitions must be compatible with existing code
- Validation rules must catch invalid configurations
- Configuration examples must be syntactically correct

### Step 5: Baseline Verification

**Sub-Agent Type**: Test runner agent

**Task**: Verify baseline functionality after all changes

**Detailed Instructions**:
- Run full test suite to ensure no regressions
- Verify configuration loading still works correctly
- Test router startup with extended configuration schema
- Ensure existing status line functionality remains unchanged

**Test Requirements**:
- All existing tests must pass
- Configuration loading must work with extended schema
- Router startup must succeed
- No performance degradation in existing functionality

## Next Steps

### Step 1: Final Test Run
- Run full test suite

### Step 2: Status Documentation
- Create `admin/cost/status/phase_0_execution_status.md`
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
- ✅ **SUB-AGENT USAGE**: The execution plan explicitly requires the use of sub-agents for all implementation steps, and specifies which sub-agent is responsible for each step

## Risk Assessment

**Low Risk**:
- Test infrastructure setup
- Configuration schema extension

**Medium Risk**:
- Integration point analysis
- Baseline test verification

**High Risk**:
- Breaking existing functionality
- Configuration schema conflicts

**Mitigation Strategies**:
- Comprehensive testing at each step
- Gradual integration approach
- Extensive error handling
- Immediate rollback on failures