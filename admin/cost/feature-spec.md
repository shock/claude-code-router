# Session Cost Tracking Feature Specification

## Overview

This feature enables real-time cost tracking for Claude Code Router sessions by calculating accumulated costs based on token usage across different models. The system will track costs per model and provide a total session cost that can be displayed in the status line.

## Goals

1. **Per-Model Cost Tracking**: Track input and output token costs separately for each model
2. **Session Accumulation**: Maintain running totals for the current session
3. **Status Line Integration**: Add a new "cost" module to display total session cost
4. **Configurable Pricing**: Allow users to define model-specific pricing in configuration

## Architecture

### Data Flow
```
API Response → Token Usage → Cost Calculation → Session Storage → Status Line Display
     ↓              ↓              ↓               ↓               ↓
Provider API   input/output   model pricing   per-model totals   total cost
              token counts    per 1M tokens   & session total    display
```

### Components

1. **Cost Calculator Service**
   - Calculates cost from token counts using model-specific pricing
   - Maintains session-level cost accumulation
   - Provides cost data to status line and other consumers

2. **Configuration Schema**
   - Extends existing model configuration with optional pricing
   - Supports per-model input/output pricing

3. **Status Line Module**
   - New "cost" module type
   - Displays total session cost
   - Configurable formatting and display options

## Configuration Changes

### Extended Model Configuration

Add optional pricing fields to model definitions in `config.json`:

```json
{
  "CostTracking": {
    "enabled": true,
    "currency": "USD",
    "model_pricing": {
      "openai,gpt-4.1": {
        "input_tokens_per_million": 2.50,
        "output_tokens_per_million": 10.00
      },
      "openrouter,deepseek-chat": {
        "input_tokens_per_million": 0.15,
        "output_tokens_per_million": 0.60
      }
    }
  }
}
```

## Cost Calculation Logic

### Formula
```
cost = (input_tokens * input_price_per_million / 1,000,000) +
       (output_tokens * output_price_per_million / 1,000,000)
```

### Example Calculation
For GPT-4.1 with 1,500 input tokens and 800 output tokens:
```
input_cost = 1,500 * $2.50 / 1,000,000 = $0.00375
output_cost = 800 * $10.00 / 1,000,000 = $0.00800
total_cost = $0.01175
```

## Session Cost Storage

### Data Structure
```typescript
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
```

### Storage Strategy
- **In-Memory Cache**: Use existing `sessionUsageCache` or similar LRU cache
- **Session Lifetime**: Costs persist for the duration of the Claude Code session
- **Reset Behavior**: Costs reset when session ends or user starts new conversation

## Status Line Integration

### New Module Type: "cost"

```json
{
  "StatusLine": {
    "default": {
      "modules": [
        {
          "type": "cost",
          "icon": "💵",
          "text": "{{totalCost}}",
          "color": "bright_green",
          "format": "currency"  // Options: "currency", "decimal", "scientific"
        }
      ]
    }
  }
}
```

### Available Variables for Cost Module
- `{{totalCost}}` - Total session cost (formatted)
- `{{totalCostRaw}}` - Total session cost (raw number)
- `{{modelCosts}}` - JSON string of per-model costs
- `{{sessionDuration}}` - Session duration in human-readable format

### Format Options
- **currency**: "$0.12", "€0.12", etc. (based on configured currency)
- **decimal**: "0.1234"
- **scientific**: "1.23e-1"
- **compact**: "$0.12" (auto-format based on magnitude)

## API Changes

### New Endpoints (Optional)

```typescript
// Get current session cost summary
GET /api/cost/session
Response: {
  totalCost: number;
  currency: string;
  modelCosts: Record<string, ModelCost>;
  sessionStart: string;
}

// Get cost history (if persistent storage implemented)
GET /api/cost/history?days=7
```

### Internal APIs

```typescript
// Cost calculation service
interface CostCalculator {
  calculateCost(model: string, inputTokens: number, outputTokens: number): number;
  getSessionCost(sessionId: string): SessionCostData;
  resetSession(sessionId: string): void;
}

// Status line variable provider
interface CostStatusLineProvider {
  getCostVariables(sessionId: string): Record<string, string>;
}
```

## Implementation Phases

### Phase 1: Core Cost Calculation
- [ ] Extend configuration schema with pricing
- [ ] Implement cost calculation service
- [ ] Integrate with existing token capture logic
- [ ] Add session cost storage

### Phase 2: Status Line Integration
- [ ] Implement "cost" module type
- [ ] Add cost variables to status line variable system
- [ ] Support multiple display formats
- [ ] Update documentation

### Phase 3: Advanced Features
- [ ] Cost breakdown by model in status line
- [ ] Session cost history
- [ ] Cost alerts/thresholds
- [ ] Export cost data

## Configuration Migration

### Backward Compatibility
- All pricing fields are optional
- If pricing not configured, cost tracking is disabled for that model
- Status line cost module gracefully handles missing pricing data

### Default Behavior
- When pricing is missing: cost module shows "N/A" or hides itself
- Users can enable/disable cost tracking globally

## Error Handling

### Missing Pricing Data
- Log warning when model used without pricing configuration
- Skip cost calculation for that model
- Continue tracking tokens for potential later cost calculation

### Configuration Errors
- Validate pricing configuration on startup
- Provide clear error messages for invalid pricing
- Fallback to disabled state for problematic configurations

## Testing Strategy

### Unit Tests
- Cost calculation with various token counts and prices
- Configuration validation
- Session cost accumulation
- Status line variable formatting

### Integration Tests
- End-to-end cost tracking with real API responses
- Status line display with cost module
- Session persistence and reset behavior

### Performance Testing
- Impact on response times with cost calculation
- Memory usage with session cost storage
- Cache efficiency for frequent cost lookups

## Security Considerations

- Cost data should not be persisted beyond session lifetime
- No sensitive pricing information in logs
- Cost calculations should not expose API keys or provider details

## Future Enhancements

1. **Persistent Cost History**: Store cost data across sessions
2. **Budget Alerts**: Notify users when approaching cost limits
3. **Cost Analytics**: Provide insights into cost patterns
4. **Multi-Currency Support**: Automatic currency conversion
5. **Provider-Specific Pricing**: Auto-fetch pricing from provider APIs

## Dependencies

- No external dependencies for core functionality
- Currency formatting may use existing Node.js Intl API
- Optional: External service for currency conversion if multi-currency support added

## Documentation Updates

- Update configuration reference with pricing fields
- Add cost module documentation to status line guide
- Create usage examples and best practices
- Update CLI help text for new features