# Cost Tracking Configuration Schema

## Overview

This document defines the configuration schema for the session cost tracking feature. The schema extends the existing Claude Code Router configuration to support model-specific pricing and cost tracking settings.

## Extended Provider Configuration

### Global Pricing Configuration

For simpler setup, define pricing globally:

```json
{
  "CostTracking": {
    "enabled": true,
    "default_currency": "USD",
    "model_pricing": {
      "gpt-4.1": {
        "input_tokens_per_million": 2.50,
        "output_tokens_per_million": 10.00
      },
      "gpt-4.1-mini": {
        "input_tokens_per_million": 0.15,
        "output_tokens_per_million": 0.60
      },
      "claude-3-5-sonnet": {
        "input_tokens_per_million": 3.00,
        "output_tokens_per_million": 15.00
      },
      "gemini-2.5-flash": {
        "input_tokens_per_million": 0.10,
        "output_tokens_per_million": 0.40
      }
    }
  }
}
```

## Complete Configuration Schema

### Root Level Configuration

```json
{
  "CostTracking": {
    "enabled": true,
    "default_currency": "USD",
    "session_persistence": "memory",
    "model_pricing": {
      "[model_name]": {
        "input_tokens_per_million": number,
        "output_tokens_per_million": number,
        "currency": "string"
      }
    }
  }
}
```

## Configuration Properties

### CostTracking Object

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable/disable cost tracking globally |
| `default_currency` | string | `"USD"` | Default currency for cost display |
| `model_pricing` | object | `{}` | Global model pricing definitions |

### Pricing Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `input_tokens_per_million` | number | Yes | Cost per million input tokens |
| `output_tokens_per_million` | number | Yes | Cost per million output tokens |
| `currency` | string | No | Currency code (defaults to `default_currency`) |

## Status Line Configuration

### Cost Module Configuration

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

## Available Status Line Variables

### Cost Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{totalCost}}` | Total session cost (formatted) | `"$0.12"` |
| `{{totalCostRaw}}` | Total session cost (raw number) | `"0.1234"` |
| `{{sessionDuration}}` | Session duration | `"15m"` |
| `{{modelCosts}}` | JSON string of per-model costs | `{"gpt-4.1": 0.08, "gpt-4.1-mini": 0.04}` |
| `{{topModel}}` | Most expensive model used | `"gpt-4.1"` |
| `{{topModelCost}}` | Cost of most expensive model | `"$0.08"` |

### Model-Specific Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{cost.gpt-4.1}}` | Cost for specific model | `"$0.08"` |
| `{{cost.gpt-4.1-mini}}` | Cost for specific model | `"$0.04"` |

## Example Configurations

### Basic Configuration

```json
{
  "CostTracking": {
    "enabled": true,
    "default_currency": "USD",
    "model_pricing": {
      "gpt-4.1": {
        "input_tokens_per_million": 2.50,
        "output_tokens_per_million": 10.00
      },
      "gpt-4.1-mini": {
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

### Advanced Configuration

```json
{
  "CostTracking": {
    "enabled": true,
    "default_currency": "USD",
    "model_pricing": {
      "gpt-4.1": {
        "input_tokens_per_million": 2.50,
        "output_tokens_per_million": 10.00
      },
      "gpt-4.1-mini": {
        "input_tokens_per_million": 0.15,
        "output_tokens_per_million": 0.60
      },
      "claude-3-5-sonnet": {
        "input_tokens_per_million": 3.00,
        "output_tokens_per_million": 15.00
      },
      "gemini-2.5-flash": {
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

## Configuration Validation

### Required Validation Rules

1. **Pricing Values**: Must be positive numbers
2. **Currency Codes**: Must be valid ISO 4217 currency codes
3. **Model Names**: Must match actual model names used in routing
4. **Module Configuration**: Cost module requires cost tracking to be enabled

### Error Handling

- **Missing Pricing**: Log warning, skip cost calculation for that model
- **Invalid Currency**: Fallback to default currency
- **Negative Pricing**: Reject configuration with clear error message
- **Duplicate Model Names**: Use first occurrence, log warning

## Migration from Existing Configuration

### Automatic Migration

No breaking changes - existing configurations continue to work without modification.

### Manual Migration Steps

1. Add `CostTracking` section to enable feature
2. Define model pricing in `model_pricing` or per-model `pricing` fields
3. Add cost module to status line configuration if desired

## Environment Variables

### Optional Overrides

```bash
# Enable/disable cost tracking
COST_TRACKING_ENABLED=true

# Default currency
COST_TRACKING_CURRENCY=EUR

# Session persistence
COST_SESSION_PERSISTENCE=file
```

## Best Practices

1. **Start Simple**: Begin with global pricing configuration
2. **Use Real Pricing**: Reference current provider pricing pages
3. **Monitor Accuracy**: Compare calculated costs with provider invoices
4. **Regular Updates**: Update pricing when providers change rates
5. **Test Configurations**: Validate cost calculations with known token counts