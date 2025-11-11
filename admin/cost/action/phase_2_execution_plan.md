# Phase 2 Execution Plan: Session Cost Storage and Management

## Introduction

**Phase Objective:** Extend session management with cost data integration, implement session cost persistence leveraging existing LRU cache infrastructure, and ensure seamless integration with the existing session management system.

**Critical Instruction:** If any steps cannot be completed due to technical blockers, implementation conflicts, or unexpected architectural issues, execution should be aborted immediately. The status document should be updated with the specific blocking issue, and the user must be notified before proceeding.

## Pre-Implementation Steps (Main Agent)

### Step 1: Master Plan Review
- Read the entire master plan document at `admin/cost/master_plan.md` to understand complete scope and context
- Focus on Phase 2 requirements and integration points
- Review existing session management patterns and LRU cache infrastructure

### Step 2: Status Assessment
- Read `admin/cost/status/phase_1_execution_status.md` to understand current state
- Verify Phase 1 was completed successfully with all core components implemented
- Confirm test infrastructure is operational and all tests are passing

### Step 3: Test Suite Validation
- Run full test suite using `pnpm test`
- Verify all 94 tests pass (1 test skipped for known issue)
- If tests fail and status shows they should pass: Stop and notify user
- If tests fail and status shows they were failing: Make note and continue

### Step 4: Codebase Review
- Review existing session management infrastructure in `src/utils/cache.ts`
- Analyze existing `sessionUsageCache` patterns and LRU cache implementation
- Examine session ID extraction patterns from `src/utils/router.ts`
- Verify integration points for cost data storage

## Sub-Agent Usage Policy

**MANDATORY SUB-AGENT USAGE FOR IMPLEMENTATION**

All implementation steps must be performed by sub-agents. The main agent should only execute pre-implementation steps and delegate all atomic operations (file creation, file modification, test execution, debugging) to specialized sub-agents.

## Implementation Steps (Sub-Agents)

### Step 1: Extend Session Management Infrastructure

**Sub-Agent Type:** General-purpose agent

**Task:** Integrate cost calculator with existing session management infrastructure

**Requirements:**
- Associate costs with session IDs using existing `sessionUsageCache` patterns
- Implement session reset behavior integrated with existing session lifecycle
- Add session cost persistence leveraging existing LRU cache infrastructure
- Ensure cost data follows same session ID keys as token usage tracking
- Maintain consistency with existing session management patterns

**Integration Points:**
- Use same session ID extraction patterns from `src/utils/router.ts:185-190`
- Follow existing LRU cache capacity (100 entries) and eviction patterns
- Integrate with existing session lifecycle management (no explicit start/end events needed)

**Code Integration:**
```typescript
// Extend existing session management patterns
// Use same session ID keys as sessionUsageCache for consistency
// Follow proven pattern from existing token tracking infrastructure
```

### Step 2: Implement Session Cost Storage

**Sub-Agent Type:** General-purpose agent

**Task:** Implement cost data storage using existing LRU cache infrastructure

**Requirements:**
- **Leverage existing `sessionUsageCache` infrastructure** instead of creating new storage
- Extend the existing cache patterns to store cost data alongside token usage
- Store per-model cost breakdowns using the same session ID keys
- Support session duration tracking using existing session management patterns
- Implement cost aggregation logic integrated with existing cache operations
- Ensure cost data persistence follows same LRU eviction patterns

**Storage Strategy:**
- Use separate cost cache with same patterns as `sessionUsageCache`
- Maintain same session ID keys for consistency
- Follow existing LRU cache capacity and eviction behavior
- No session events needed - existing token tracking pattern handles lifecycle automatically

**Implementation Details:**
- Session IDs extracted from metadata following existing pattern
- Session lifecycle: Sessions exist as long as Claude Code uses same session ID
- Automatic cleanup on session end via LRU eviction (100-entry capacity)
- Simplified approach - cost tracking follows exact same pattern as token usage tracking

### Step 3: Extend CostCalculator with Enhanced Session Management

**Sub-Agent Type:** General-purpose agent

**Task:** Enhance CostCalculator with comprehensive session management integration

**Requirements:**
- Extend `CostCalculator` class with session management methods
- Implement session cost retrieval and reset functionality
- Add session duration tracking integrated with existing patterns
- Ensure proper error handling for session operations
- Maintain consistency with existing session management architecture

**Methods to Implement:**
- `getSessionCost(sessionId: string): SessionCostData | undefined`
- `resetSession(sessionId: string): void`
- `getAllSessionCosts(): Map<string, SessionCostData>`
- `clearExpiredSessions(): void`

**Integration Points:**
- Use same session ID patterns as existing infrastructure
- Follow existing LRU cache eviction patterns
- Maintain consistency with token usage tracking lifecycle

### Step 4: Implement Session Reset Integration

**Sub-Agent Type:** General-purpose agent

**Task:** Implement session reset behavior integrated with existing patterns

**Requirements:**
- Add session reset functionality to clear cost data
- Integrate with existing session lifecycle management
- Ensure reset behavior follows same patterns as token usage tracking
- Handle session boundary scenarios gracefully
- Maintain data consistency during reset operations

**Reset Strategy:**
- **No explicit session reset needed** - LRU cache handles session lifecycle automatically
- **Session boundaries** managed implicitly through cache eviction and server restarts
- **Simplified approach** - follows exact same pattern as existing token tracking

**Implementation:**
- Leverage existing LRU cache eviction for session cleanup
- Use same session ID patterns for consistency
- No additional session events or lifecycle management needed

### Step 5: Create Comprehensive Unit Tests

**Sub-Agent Type:** General-purpose agent

**Task:** Create comprehensive unit tests for session cost storage and management

**Test Requirements:**
- **Session cost storage tests**: Verify cost data persistence and retrieval
- **Session management integration tests**: Test integration with existing session infrastructure
- **LRU cache behavior tests**: Verify cost data follows same eviction patterns
- **Session reset tests**: Test session reset and cleanup functionality
- **Concurrent access tests**: Test thread-safe session operations
- **Error scenario tests**: Test error handling for invalid session operations

**Test Coverage Goals:**
- >90% coverage for all new session management code
- Comprehensive edge case testing
- Integration tests with existing session infrastructure
- Performance tests for concurrent session access

**Test Files:**
- Extend existing `tests/utils/costCalculator.test.ts`
- Add session management specific test cases
- Test LRU cache integration and eviction behavior
- Verify session reset and cleanup functionality

### Step 6: Integration Testing and Validation

**Sub-Agent Type:** General-purpose agent

**Task:** Perform comprehensive integration testing with existing session infrastructure

**Testing Requirements:**
- Verify cost data storage integrates seamlessly with existing session management
- Test session lifecycle consistency with token usage tracking
- Validate LRU cache behavior and eviction patterns
- Test concurrent session access scenarios
- Verify session reset and cleanup functionality
- Performance testing for session operations

**Validation Criteria:**
- All existing tests continue to pass
- No performance degradation in session operations
- Consistent session lifecycle behavior
- Proper error handling for edge cases
- Seamless integration with existing infrastructure

## Testing Requirements

### Unit Testing Requirements
- **Session Cost Storage**: Test cost data persistence and retrieval operations
- **Session Management**: Test integration with existing session infrastructure
- **LRU Cache Behavior**: Verify cost data follows same eviction patterns as token usage
- **Session Reset**: Test session reset and cleanup functionality
- **Concurrent Access**: Test thread-safe session operations
- **Error Scenarios**: Test error handling for invalid session operations

### Integration Testing Requirements
- **Session Lifecycle Consistency**: Verify cost tracking follows same patterns as token usage
- **LRU Cache Integration**: Test cost data eviction and persistence
- **Performance Validation**: Ensure no degradation in session operations
- **Error Handling**: Test graceful degradation during session failures

### Test Coverage Goals
- >90% coverage for all new session management code
- Comprehensive edge case testing
- Integration tests with existing session infrastructure
- Performance tests for concurrent session access

## Backward Compatibility

**Critical Requirements:**
- **No breaking changes** to existing session management functionality
- **Existing configurations must work without changes**
- **No interference** with existing token tracking and API response handling
- **Performance stability** - no degradation in session operations
- **UI consistency** - session management continues working normally

**Preservation Strategy:**
- Leverage existing session management infrastructure without modification
- Follow same session ID patterns and LRU cache behavior
- Maintain consistency with existing token tracking lifecycle
- No changes to existing session management APIs or behavior

## Error Handling

**Error Handling Requirements:**
- **Graceful degradation** during session storage failures
- **Session operation errors** should not affect API request processing
- **LRU cache failures** should not disrupt cost tracking functionality
- **Session reset errors** should be handled gracefully
- **Concurrent access conflicts** should be resolved safely

**Error Handling Strategy:**
- Comprehensive error handling for all session operations
- Graceful fallback to disabled state during critical failures
- No blocking behavior during session management errors
- Clear error logging for debugging purposes

## Next Steps

### Step 1: Final Test Run
- Run full test suite using `pnpm test`
- Verify all tests pass (including new session management tests)
- Ensure no regression in existing functionality

### Step 2: Status Documentation
- Create/update `admin/cost/status/phase_2_execution_status.md`
- Document current phase execution steps with status ("COMPLETED", "IN PROGRESS", "NOT STARTED", "NEEDS CLARIFICATION")
- Document final status of the test suite
- Include a summary of the phase execution and what was accomplished
- Note any risks or blocking issues encountered
- End the status document with a single overarching next step

## Success Criteria

- [ ] Session cost storage integrates seamlessly with existing session management
- [ ] Cost data follows same LRU cache patterns as token usage tracking
- [ ] Session reset behavior works correctly
- [ ] All existing tests continue to pass
- [ ] Comprehensive unit tests for session management (>90% coverage)
- [ ] No performance degradation in session operations
- [ ] Backward compatibility maintained with existing functionality
- [ ] Error handling provides graceful degradation

## Risk Assessment

**Low Risk Areas:**
- Session cost storage implementation
- LRU cache integration
- Basic session management operations

**Medium Risk Areas:**
- Session reset integration
- Concurrent session access
- Error handling for session failures

**High Risk Areas:**
- Complex session lifecycle scenarios
- Performance impact on existing session operations
- Integration conflicts with existing infrastructure

**Mitigation Strategies:**
- Comprehensive testing at each implementation step
- Gradual integration with existing systems
- Extensive error handling and logging
- Performance monitoring during implementation