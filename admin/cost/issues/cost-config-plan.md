# Plan: Fix Cost Tracking Configuration Format

## Problem Summary
The current cost tracking configuration uses `"provider,model"` format (e.g., `"openai,gpt-4"`) as keys, but actual requests only contain model names without provider information. This mismatch prevents proper cost calculation.

## Implementation Plan

### Phase 1: Core Type System Updates
- **Update `src/types/cost.ts`**: Remove provider+model format expectations
- **Update `src/config/costConfig.ts`**: Remove provider+model validation, update `extractRouterModels()` to return model names only
- **Update `src/utils/costCalculator.ts`**: Ensure pricing lookup uses model names directly

### Phase 2: UI Component Updates  
- **Update `ui/src/utils/cost-tracking.ts`**: Simplify validation to check for non-empty strings only
- **Update `ui/src/types.ts`**: Align TypeScript interfaces with backend changes

### Phase 3: Status Line Provider Updates
- **Update `src/utils/costStatusLineProvider.ts`**: Change dynamic variable format from `cost.provider_model` to `cost.model`

### Phase 4: Comprehensive Test Updates
- **Update all test files**: Remove provider+model format tests, update test data with model names only
- **Test files affected**: `costConfig.test.ts`, `costTracking.test.ts`, `costCalculator.test.ts`, `costStatusLineProvider.test.ts`

### Phase 5: Documentation and Examples
- **Update `CLAUDE.md` and `README.md`**: Provide migration instructions and examples
- **Update `ui/config.example.json`**: Show new configuration format

## Configuration Format Change
**Before**: `{"openai,gpt-4": {...}, "anthropic,claude-3.5-sonnet": {...}}`  
**After**: `{"gpt-4": {...}, "claude-3.5-sonnet": {...}}`

## Migration Impact
- **Breaking change**: Users must update their `config.json` files
- **Status line variables**: Change from `cost.openai_gpt-4` to `cost.gpt-4`
- **Validation**: Provider+model format will fail validation

## Testing Strategy
- Update all unit and integration tests
- Manual testing with live Claude Code sessions
- Verify cost calculation works with real model names
