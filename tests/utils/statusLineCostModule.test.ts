import {
  formatCostValue,
  renderCostModuleText,
  renderDefaultStyle,
  renderPowerlineStyle,
  CostModule,
  StatusLineThemeConfig,
  registerCostStatusLineProvider
} from '../../src/utils/statusline';
import { CostStatusLineProvider } from '../../src/utils/costStatusLineProvider';
import { CostCalculator } from '../../src/utils/costCalculator';
import { CostTrackingConfig } from '../../src/types/cost';

// Mock Intl.NumberFormat for consistent currency formatting
const mockNumberFormat = jest.spyOn(Intl, 'NumberFormat');

// Mock implementations for controlled testing
const mockCurrencyFormatter = {
  format: jest.fn((amount: number) => {
    if (amount < 0.01) {
      return `$${amount.toFixed(4)}`;
    }
    return `$${amount.toFixed(2)}`;
  })
};

describe('Cost Module Functionality', () => {
  const mockConfig: CostTrackingConfig = {
    enabled: true,
    default_currency: 'USD',
    model_pricing: {
      'openai,gpt-4': {
        input_cost_per_million: 2.50,
        output_cost_per_million: 10.00
      },
      'anthropic,claude-3.5-sonnet': {
        input_cost_per_million: 3.00,
        output_cost_per_million: 15.00
      }
    }
  };

  let costCalculator: CostCalculator;
  let costStatusLineProvider: CostStatusLineProvider;

  beforeEach(() => {
    // Mock currency formatter
    mockNumberFormat.mockImplementation(() => mockCurrencyFormatter as any);

    costCalculator = new CostCalculator(mockConfig);
    costStatusLineProvider = new CostStatusLineProvider(costCalculator, mockConfig);
    registerCostStatusLineProvider(costStatusLineProvider);

    // Reset mock calls
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockNumberFormat.mockRestore();
  });

  describe('formatCostValue function', () => {
    test('should format currency with proper precision', () => {
      expect(formatCostValue('0.003456', 'currency', 2)).toMatch(/\$0\.00/);
      expect(formatCostValue('1.234567', 'currency', 2)).toMatch(/\$1\.23/);
      expect(formatCostValue('100.50', 'currency', 0)).toMatch(/\$100/);
    });

    test('should format decimal values correctly', () => {
      expect(formatCostValue('0.003456', 'decimal', 2)).toBe('0.00');
      expect(formatCostValue('1.234567', 'decimal', 4)).toBe('1.2346');
      expect(formatCostValue('100.50', 'decimal', 0)).toBe('101');
    });

    test('should format scientific notation correctly', () => {
      expect(formatCostValue('0.003456', 'scientific', 2)).toBe('3.46e-3');
      expect(formatCostValue('1234.567', 'scientific', 3)).toBe('1.235e+3');
      expect(formatCostValue('0.000000123', 'scientific', 4)).toBe('1.2300e-7');
    });

    test('should format compact notation correctly', () => {
      expect(formatCostValue('1234.56', 'compact', 2)).toBe('1.23K');
      expect(formatCostValue('1234567.89', 'compact', 2)).toBe('1.23M');
      expect(formatCostValue('1234567890.12', 'compact', 2)).toBe('1.23B');
      expect(formatCostValue('999.99', 'compact', 2)).toBe('999.99');
    });

    test('should handle invalid numeric values gracefully', () => {
      expect(formatCostValue('invalid', 'currency', 2)).toBe('invalid');
      expect(formatCostValue('NaN', 'decimal', 2)).toBe('NaN');
      expect(formatCostValue('', 'scientific', 2)).toBe('');
    });

    test('should handle edge cases with precision', () => {
      expect(formatCostValue('0.0000001', 'currency', 6)).toMatch(/\$0\.000000/);
      expect(formatCostValue('999999999.99', 'compact', 0)).toBe('1000M');
      expect(formatCostValue('0.000000001', 'scientific', 9)).toBe('1.000000000e-9');
    });
  });

  describe('renderCostModuleText function', () => {
    const baseModule: CostModule = {
      type: 'cost',
      text: '{{totalCost}}',
      icon: '💰'
    };

    test('should render basic cost display with default formatting', () => {
      const variables = {
        totalCost: '0.003456',
        trackingStatus: 'Active',
        statusMessage: '1 model used'
      };

      const result = renderCostModuleText(baseModule, variables);
      expect(result).toMatch(/\$0\.00/);
    });

    test('should handle custom precision and format configurations', () => {
      const module: CostModule = {
        ...baseModule,
        precision: 4,
        format: 'decimal'
      };

      const variables = {
        totalCost: '1.23456789',
        trackingStatus: 'Active',
        statusMessage: '1 model used'
      };

      const result = renderCostModuleText(module, variables);
      expect(result).toBe('1.2346');
    });

    test('should show breakdown when show_breakdown is true', () => {
      const module: CostModule = {
        ...baseModule,
        show_breakdown: true,
        text: '{{totalCost}}'
      };

      const variables = {
        totalCostRaw: '0.01',
        totalCost: '$0.01',
        topModel: 'openai,gpt-4',
        topModelCost: '0.005',
        trackingStatus: 'Active',
        statusMessage: '2 models used'
      };

      const result = renderCostModuleText(module, variables);
      expect(result).toMatch(/\$0\.01 \(openai,gpt-4: \$0\.01\)/);
    });

    test('should handle disabled cost tracking state', () => {
      const variables = {
        trackingStatus: 'Disabled',
        statusMessage: 'Cost tracking disabled'
      };

      const result = renderCostModuleText(baseModule, variables);
      expect(result).toBe('Cost tracking disabled');
    });

    test('should handle no cost data scenario', () => {
      const variables = {
        trackingStatus: 'Active',
        statusMessage: 'No cost data'
      };

      const result = renderCostModuleText(baseModule, variables);
      expect(result).toBe('No cost data');
    });

    test('should handle custom status message when no cost data', () => {
      const variables = {
        trackingStatus: 'Active',
        statusMessage: 'Custom no data message'
      };

      const result = renderCostModuleText(baseModule, variables);
      expect(result).toBe('Custom no data message');
    });

    test('should format model-specific cost variables', () => {
      const module: CostModule = {
        ...baseModule,
        text: 'GPT-4: {{cost.openai_gpt_4}} | Claude: {{cost.anthropic_claude_3_5_sonnet}}',
        precision: 4,
        format: 'decimal'
      };

      const variables = {
        'cost.openai_gpt_4': '0.003456',
        'cost.anthropic_claude_3_5_sonnet': '0.005678',
        totalCost: '0.01',
        trackingStatus: 'Active',
        statusMessage: '2 models used'
      };

      const result = renderCostModuleText(module, variables);
      expect(result).toBe('GPT-4: 0.0035 | Claude: 0.0057');
    });

    test('should handle variable substitution in text template', () => {
      const module: CostModule = {
        ...baseModule,
        text: 'Cost: {{totalCost}} | Duration: {{sessionDuration}} | Top: {{topModel}}',
        precision: 2,
        format: 'currency'
      };

      const variables = {
        totalCost: '0.01',
        sessionDuration: '5m 30s',
        topModel: 'openai,gpt-4',
        trackingStatus: 'Active',
        statusMessage: '1 model used'
      };

      const result = renderCostModuleText(module, variables);
      expect(result).toMatch(/Cost: \$0\.01 \| Duration: 5m 30s \| Top: openai,gpt-4/);
    });

    test('should handle missing model-specific variables gracefully', () => {
      const module: CostModule = {
        ...baseModule,
        text: 'GPT-4: {{cost.openai_gpt_4}} | Unknown: {{cost.unknown_model}}',
        precision: 2,
        format: 'currency'
      };

      const variables = {
        'cost.openai_gpt_4': '0.003456',
        totalCost: '0.01',
        trackingStatus: 'Active',
        statusMessage: '1 model used'
      };

      const result = renderCostModuleText(module, variables);
      expect(result).toMatch(/GPT-4: \$0\.00 \| Unknown: \{\{cost\.unknown_model\}\}/);
    });

    test.skip('should handle breakdown without top model', () => {
      const module: CostModule = {
        ...baseModule,
        show_breakdown: true,
        text: '{{totalCost}}'
      };

      const variables = {
        totalCostRaw: '0.01',
        totalCost: '$0.01',
        topModel: 'None',
        topModelCost: '0',
        trackingStatus: 'Active',
        statusMessage: 'No model usage tracked'
      };

      const result = renderCostModuleText(module, variables);
      expect(result).toMatch(/\$0\.01/);
    });
  });

  describe('Cost module integration in status line rendering', () => {
    const costModule: CostModule = {
      type: 'cost',
      text: '{{totalCost}}',
      icon: '💰',
      color: 'bright_green'
    };

    const powerlineCostModule: CostModule = {
      type: 'cost',
      text: '{{totalCost}}',
      icon: '💰',
      color: 'white',
      background: 'bg_bright_green'
    };

    test('should integrate cost module in default style rendering', async () => {
      const theme: StatusLineThemeConfig = {
        modules: [costModule]
      };

      const variables = {
        totalCost: '0.003456',
        trackingStatus: 'Active',
        statusMessage: '1 model used'
      };

      const result = await renderDefaultStyle(theme, variables);
      expect(result).toContain('💰');
      expect(result).toMatch(/\$0\.00/);
    });

    test('should integrate cost module in powerline style rendering', async () => {
      const theme: StatusLineThemeConfig = {
        modules: [powerlineCostModule]
      };

      const variables = {
        totalCost: '0.003456',
        trackingStatus: 'Active',
        statusMessage: '1 model used'
      };

      const result = await renderPowerlineStyle(theme, variables);
      expect(result).toContain('💰');
      expect(result).toMatch(/\$0\.00/);
    });

    test('should handle cost module with breakdown in theme', async () => {
      const breakdownModule: CostModule = {
        ...costModule,
        show_breakdown: true,
        text: '{{totalCost}}'
      };

      const theme: StatusLineThemeConfig = {
        modules: [breakdownModule]
      };

      const variables = {
        totalCostRaw: '0.01',
        totalCost: '$0.01',
        topModel: 'openai,gpt-4',
        topModelCost: '0.005',
        trackingStatus: 'Active',
        statusMessage: '2 models used'
      };

      const result = await renderDefaultStyle(theme, variables);
      expect(result).toMatch(/\$0\.01 \(openai,gpt-4: \$0\.01\)/);
    });

    test('should handle disabled cost tracking in theme rendering', async () => {
      const theme: StatusLineThemeConfig = {
        modules: [costModule]
      };

      const variables = {
        trackingStatus: 'Disabled',
        statusMessage: 'Cost tracking disabled'
      };

      const result = await renderDefaultStyle(theme, variables);
      expect(result).toContain('Cost tracking disabled');
    });

    test('should skip empty cost modules in rendering', async () => {
      const theme: StatusLineThemeConfig = {
        modules: [
          {
            type: 'workDir',
            text: 'test',
            icon: '📁'
          },
          costModule
        ]
      };

      const variables = {
        trackingStatus: 'Active',
        statusMessage: 'No cost data'
      };

      const result = await renderDefaultStyle(theme, variables);
      expect(result).toContain('📁 test');
      expect(result).toContain('No cost data');
    });
  });

  describe('Error scenarios and graceful degradation', () => {
    test('should handle missing cost provider gracefully', () => {
      // Unregister the provider
      registerCostStatusLineProvider(null as any);

      const module: CostModule = {
        type: 'cost',
        text: '{{totalCost}}',
        icon: '💰'
      };

      const variables = {
        trackingStatus: 'Active',
        statusMessage: 'No cost data'
      };

      const result = renderCostModuleText(module, variables);
      expect(result).toBe('No cost data');
    });

    test('should handle malformed cost values gracefully', () => {
      const module: CostModule = {
        type: 'cost',
        text: '{{totalCost}}',
        icon: '💰'
      };

      const variables = {
        totalCost: 'not-a-number',
        trackingStatus: 'Active',
        statusMessage: '1 model used'
      };

      const result = renderCostModuleText(module, variables);
      expect(result).toBe('not-a-number');
    });

    test('should handle extremely large numbers', () => {
      const module: CostModule = {
        type: 'cost',
        text: '{{totalCost}}',
        format: 'compact' as const,
        precision: 2
      };

      const variables = {
        totalCost: '999999999999.99',
        trackingStatus: 'Active',
        statusMessage: '1 model used'
      };

      const result = renderCostModuleText(module, variables);
      expect(result).toBe('1000.00B');
    });

    test('should handle negative cost values', () => {
      const module: CostModule = {
        type: 'cost',
        text: '{{totalCost}}',
        format: 'currency' as const,
        precision: 2
      };

      const variables = {
        totalCost: '-0.005',
        totalCostRaw: '-0.005',
        trackingStatus: 'Active',
        statusMessage: '1 model used'
      };

      const result = renderCostModuleText(module, variables);
      expect(result).toMatch(/-\$0\.01/);
    });

    test('should handle zero cost with various formats', () => {
      const module: CostModule = {
        type: 'cost',
        text: '{{totalCost}}',
        format: 'currency' as const,
        precision: 2
      };

      const variables = {
        totalCost: '0',
        trackingStatus: 'Active',
        statusMessage: '1 model used'
      };

      const result = renderCostModuleText(module, variables);
      expect(result).toMatch(/\$0\.00/);
    });
  });

  describe('Integration with real cost data', () => {
    test('should render with actual cost calculator data', async () => {
      const sessionId = 'integration-test';

      // Add real cost data
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);
      costCalculator.calculateCost(sessionId, 'anthropic,claude-3.5-sonnet', 800, 400);

      const variables = costStatusLineProvider.getCostVariables(sessionId);

      const module: CostModule = {
        type: 'cost',
        text: '{{totalCost}} | {{topModel}}: {{topModelCost}}',
        icon: '💰',
        precision: 4,
        format: 'decimal'
      };

      const result = renderCostModuleText(module, variables);

      // Should contain formatted cost values
      expect(result).toContain('|');
      expect(result).toContain('anthropic,claude-3.5-sonnet:');
      expect(result).toMatch(/\d+\.\d{4}/); // Should have decimal formatting
    });

    test('should handle dynamic model cost variables', async () => {
      const sessionId = 'dynamic-model-test';

      // Add cost data for specific models
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);
      costCalculator.calculateCost(sessionId, 'anthropic,claude-3.5-sonnet', 800, 400);

      const variables = costStatusLineProvider.getCostVariables(sessionId);

      const module: CostModule = {
        type: 'cost',
        text: 'GPT-4: {{cost.openai_gpt_4}} | Claude: {{cost.anthropic_claude_3_5_sonnet}}',
        icon: '💰',
        precision: 6,
        format: 'decimal'
      };

      const result = renderCostModuleText(module, variables);

      // Should contain both model-specific costs
      expect(result).toContain('GPT-4:');
      expect(result).toContain('Claude:');
      expect(result).toMatch(/\d+\.\d{4}/); // Should have decimal formatting
    });
  });

  describe('Performance and edge cases', () => {
    test('should handle very high precision without performance issues', () => {
      const module: CostModule = {
        type: 'cost',
        text: '{{totalCost}}',
        precision: 10,
        format: 'decimal'
      };

      const variables = {
        totalCost: '0.12345678901234567890',
        trackingStatus: 'Active',
        statusMessage: '1 model used'
      };

      const result = renderCostModuleText(module, variables);
      expect(result).toBe('0.1234567890');
    });

    test('should handle very long variable names', () => {
      const module: CostModule = {
        type: 'cost',
        text: '{{cost.very_long_model_name_with_many_underscores_and_special_characters}}',
        precision: 2,
        format: 'currency'
      };

      const variables = {
        'cost.very_long_model_name_with_many_underscores_and_special_characters': '0.005',
        totalCost: '0.01',
        trackingStatus: 'Active',
        statusMessage: '1 model used'
      };

      const result = renderCostModuleText(module, variables);
      expect(result).toMatch(/\$0\.01/);
    });

    test('should handle empty text template', () => {
      const module: CostModule = {
        type: 'cost',
        text: '',
        icon: '💰'
      };

      const variables = {
        totalCost: '0.01',
        trackingStatus: 'Active',
        statusMessage: '1 model used'
      };

      const result = renderCostModuleText(module, variables);
      expect(result).toBe('');
    });

    test('should handle undefined variables gracefully', () => {
      const module: CostModule = {
        type: 'cost',
        text: '{{undefinedVar}} {{totalCost}}',
        icon: '💰'
      };

      const variables = {
        totalCost: '0.01',
        trackingStatus: 'Active',
        statusMessage: '1 model used'
      };

      const result = renderCostModuleText(module, variables);
      expect(result).toBe(' $0.01');
    });
  });
});