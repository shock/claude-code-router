# Session Cost Tracking Feature Specification

## Overview

This feature enables real-time cost tracking for Claude Code Router sessions by calculating accumulated costs based on token usage across different models. The system will track costs per model and provide a total session cost that can be displayed in the status line.

## Goals

1. **Per-Model Cost Tracking**: Track input and output token costs separately for each model
2. **Session Accumulation**: Maintain running totals for the current session
3. **Status Line Integration**: Add a new "cost" module to display total session cost
4. **Configurable Pricing**: Allow users to define model-specific pricing in configuration using `<provider>,<model>` format

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

2. **Configuration System**
   - Local configuration only (no remote configuration support)
   - Supports per-model input/output pricing using `<provider>,<model>` format

3. **Status Line Module**
   - New "cost" module type
   - Displays total session cost
   - Configurable formatting and display options

## Configuration

### Cost Tracking Configuration

Add cost tracking configuration to `config.json`:

```json
{
  "CostTracking": {
    "enabled": true,
    "default_currency": "USD",
    "model_pricing": {
      "openai,gpt-4.1": {
        "input_tokens_per_million": 2.50,
        "output_tokens_per_million": 10.00
      },
      "openrouter,deepseek-chat": {
        "input_tokens_per_million": 0.15,
        "output_tokens_per_million": 0.60
      },
      "anthropic,claude-3-5-sonnet": {
        "input_tokens_per_million": 3.00,
        "output_tokens_per_million": 15.00
      },
      "google,gemini-2.5-flash": {
        "input_tokens_per_million": 0.10,
        "output_tokens_per_million": 0.40
      }
    }
  }
}
```

### Configuration Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable/disable cost tracking globally |
| `default_currency` | string | `"USD"` | Default currency for cost display |
| `model_pricing` | object | `{}` | Model pricing definitions using `<provider>,<model>` format |

### Pricing Object Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `input_tokens_per_million` | number | Yes | Cost per million input tokens |
| `output_tokens_per_million` | number | Yes | Cost per million output tokens |
| `currency` | string | No | Currency code (defaults to `default_currency`) |

### Status Line Configuration

Add cost module to status line configuration:

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
          "format": "currency",
          "precision": 2,
          "show_breakdown": false
        }
      ]
    }
  }
}
```

### Cost Module Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `type` | string | - | Must be `"cost"` |
| `icon` | string | `"💵"` | Display icon |
| `text` | string | `"{{totalCost}}"` | Text template with variables |
| `color` | string | `"bright_green"` | Text color |
| `format` | string | `"currency"` | Display format (`"currency"`, `"decimal"`, `"scientific"`, `"compact"`) |
| `precision` | number | `2` | Decimal precision for display |
| `show_breakdown` | boolean | `false` | Show per-model breakdown (if space allows) |

### Available Status Line Variables

#### Cost Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `{{totalCost}}` | Total session cost (formatted) | `"$0.12"` |
| `{{totalCostRaw}}` | Total session cost (raw number) | `"0.1234"` |
| `{{sessionDuration}}` | Session duration | `"15m"` |
| `{{modelCosts}}` | JSON string of per-model costs | `{"openai,gpt-4.1": 0.08, "openrouter,deepseek-chat": 0.04}` |
| `{{topModel}}` | Most expensive model used | `"openai,gpt-4.1"` |
| `{{topModelCost}}` | Cost of most expensive model | `"$0.08"` |

#### Model-Specific Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `{{cost.openai,gpt-4.1}}` | Cost for specific model | `"$0.08"` |
| `{{cost.openrouter,deepseek-chat}}` | Cost for specific model | `"$0.04"` |

### Example Configurations

#### Basic Configuration
```json
{
  "CostTracking": {
    "enabled": true,
    "default_currency": "USD",
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
  },
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

#### Advanced Configuration
```json
{
  "CostTracking": {
    "enabled": true,
    "default_currency": "USD",
    "model_pricing": {
      "openai,gpt-4.1": {
        "input_tokens_per_million": 2.50,
        "output_tokens_per_million": 10.00
      },
      "openrouter,deepseek-chat": {
        "input_tokens_per_million": 0.15,
        "output_tokens_per_million": 0.60
      },
      "anthropic,claude-3-5-sonnet": {
        "input_tokens_per_million": 3.00,
        "output_tokens_per_million": 15.00
      },
      "google,gemini-2.5-flash": {
        "input_tokens_per_million": 0.10,
        "output_tokens_per_million": 0.40
      }
    }
  },
  "StatusLine": {
    "default": {
      "modules": [
        {
          "type": "cost",
          "icon": "💰",
          "text": "{{totalCost}} ({{topModel}})",
          "color": "bright_yellow",
          "format": "compact",
          "precision": 3,
          "show_breakdown": true
        }
      ]
    },
    "powerline": {
      "modules": [
        {
          "type": "cost",
          "icon": "💵",
          "text": "{{totalCost}}",
          "color": "white",
          "background": "bg_bright_green"
        }
      ]
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

## Internal APIs

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

## Configuration Validation

### Required Validation Rules

1. **Pricing Values**: Must be positive numbers
2. **Currency Codes**: Must be valid ISO 4217 currency codes
3. **Model Names**: Must match actual model names used in routing with `<provider>,<model>` format
4. **Module Configuration**: Cost module requires cost tracking to be enabled

### Backward Compatibility
- All cost configuration fields are optional
- If CostTracking not pressent in config, cost tracking is disabled

### Startup Validation
- CostTracking fields are validated on startup, if present
- If CostTracking is present but disabled, cost tracking is disabled
- If CostTracking is present and enabled, and all models have valid pricing, cost tracking is enabled and should not cause any exceptions
- If Cost Tracking is enabled and any configured models are missing cost data, print warning on startup listing unconfigured models and require user to press ENTER to continue.  S model cost to 0 for any missing models

### Runtime Behavior
- If Cost Tracking is disabled (default), status line cost module should show "Disabled"
- If an error/exception occurs during cost calculation, log the error to logs and show "Error" in cost status line module (for all variables)
- When CostTracking is disabled, status line cost module shows "Disabled" for all variables

## Error Handling

### Configuration Errors
- Validate pricing configuration on startup
- Provide clear error messages for invalid pricing configuration and require user to press ENTER to continue
- Fallback to disabled state for problematic configurations

## Testing Strategy

### Unit Tests
- Cost calculation with various token counts and prices
- Configuration validation
- Session cost accumulation
- Status line variable formatting

### Integration Tests
- End-to-end cost tracking with stubbed API responses
- Validate status line variables in cost module for various scenarios
- Session persistence and reset behavior

## Best Practices

1. **Use Provider,Model Format**: Always use the `<provider>,<model>` format in model_pricing to match router configuration

## Future Enhancements

1. **Persistent Cost History**: Store cost data across sessions
2. **Budget Alerts**: Notify users when approaching cost limits
3. **Cost Analytics**: Provide insights into cost patterns
4. **Multi-Currency Support**: Automatic currency conversion
5. **Cost Import/Export**: Allow users to export cost data for analysis

## Dependencies

- No external dependencies for core functionality
- Currency formatting may use existing Node.js Intl API
- Optional: External service for currency conversion if multi-currency support added

## Documentation Updates

- Update configuration reference with pricing fields
- Add cost module documentation to status line guide
- Create usage examples and best practices
- Update CLI help text for new features