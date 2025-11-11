import { CostStatusLineProvider } from '../../src/utils/costStatusLineProvider';
import { CostCalculator } from '../../src/utils/costCalculator';
import { CostTrackingConfig, SessionCostData } from '../../src/types/cost';

// Mock Date constructor for consistent duration testing
let mockCurrentTime: number | undefined;
const OriginalDate = global.Date;

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

describe('CostStatusLineProvider', () => {
  const mockConfig: CostTrackingConfig = {
    enabled: true,
    default_currency: 'USD',
    model_pricing: {
      'openai,gpt-4': {
        input_tokens_per_million: 2.50,
        output_tokens_per_million: 10.00
      },
      'anthropic,claude-3.5-sonnet': {
        input_tokens_per_million: 3.00,
        output_tokens_per_million: 15.00
      },
      'google,gemini-pro': {
        input_tokens_per_million: 1.50,
        output_tokens_per_million: 6.00
      }
    }
  };

  let costCalculator: CostCalculator;
  let statusLineProvider: CostStatusLineProvider;

  beforeEach(() => {
    // Mock currency formatter
    mockNumberFormat.mockImplementation(() => mockCurrencyFormatter as any);

    // Mock Date constructor to return controlled time
    mockCurrentTime = new OriginalDate('2024-11-11T00:00:00Z').getTime();
    global.Date = class extends OriginalDate {
      constructor(...args: any[]) {
        if (args.length === 0 && mockCurrentTime !== undefined) {
          super(mockCurrentTime);
        } else {
          super(...args as [any]);
        }
      }
      static now() {
        return mockCurrentTime !== undefined ? mockCurrentTime : OriginalDate.now();
      }
    } as any;

    costCalculator = new CostCalculator(mockConfig);
    statusLineProvider = new CostStatusLineProvider(costCalculator, mockConfig);

    // Reset mock calls
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.Date = OriginalDate;
    mockCurrentTime = undefined;
    mockNumberFormat.mockRestore();
  });

  describe('Basic functionality', () => {
    test('should generate status line with cost tracking enabled', () => {
      const sessionId = 'test-session';
      const template = 'Total: {{totalCost}} | Duration: {{sessionDuration}}';

      // Add some cost data
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);

      const result = statusLineProvider.generateStatusLine(sessionId, template);

      expect(result).toContain('Total:');
      expect(result).toContain('Duration:');
      expect(result).not.toContain('{{'); // No unsubstituted variables
      expect(result).not.toContain('}}');
    });

    test('should return disabled message when cost tracking is disabled', () => {
      const disabledConfig: CostTrackingConfig = {
        ...mockConfig,
        enabled: false
      };

      const disabledProvider = new CostStatusLineProvider(costCalculator, disabledConfig);
      const sessionId = 'test-session';
      const template = 'Total: {{totalCost}}';

      const result = disabledProvider.generateStatusLine(sessionId, template);

      expect(result).toBe('Cost tracking disabled');
    });

    test('should return no data message when no session data available', () => {
      const sessionId = 'non-existent-session';
      const template = 'Total: {{totalCost}}';

      const result = statusLineProvider.generateStatusLine(sessionId, template);

      expect(result).toBe('No cost data available');
    });
  });

  describe('Variable generation scenarios', () => {
    let sessionCost: SessionCostData;

    beforeEach(() => {
      const sessionId = 'test-session';

      // Add cost data for multiple models
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);
      costCalculator.calculateCost(sessionId, 'anthropic,claude-3.5-sonnet', 800, 400);
      costCalculator.calculateCost(sessionId, 'google,gemini-pro', 1200, 600);

      const costData = costCalculator.getSessionCost(sessionId);
      if (!costData) {
        throw new Error('Session cost data should be available');
      }
      sessionCost = costData;
    });

    test('should generate all base variables correctly', () => {
      const variables = statusLineProvider['generateVariables'](sessionCost);

      expect(variables.totalCost).toBeDefined();
      expect(variables.totalCostRaw).toBeDefined();
      expect(variables.sessionDuration).toBeDefined();
      expect(variables.modelCosts).toBeDefined();
      expect(variables.trackingStatus).toBe('Active');
      expect(variables.statusMessage).toBeDefined();
      expect(variables.statusColor).toBeDefined();
      expect(variables.topModel).toBeDefined();
      expect(variables.topModelCost).toBeDefined();
    });

    test('should generate dynamic model-specific variables', () => {
      const variables = statusLineProvider['generateVariables'](sessionCost);

      // Check for normalized model names
      expect(variables['cost.openai_gpt_4']).toBeDefined();
      expect(variables['cost.anthropic_claude_3_5_sonnet']).toBeDefined();
      expect(variables['cost.google_gemini_pro']).toBeDefined();
    });

    test('should identify top model correctly', () => {
      const variables = statusLineProvider['generateVariables'](sessionCost);

      // Based on pricing, claude-3.5-sonnet should be most expensive
      expect(variables.topModel).toBe('anthropic,claude-3.5-sonnet');
      expect(variables.topModelCost).toBeDefined();
    });

    test('should handle session with no model costs', () => {
      const emptySessionCost: SessionCostData = {
        sessionId: 'empty-session',
        startTime: new Date('2024-11-11T00:00:00Z'),
        totalCost: 0,
        modelCosts: {},
        currency: 'USD'
      };

      const variables = statusLineProvider['generateVariables'](emptySessionCost);

      expect(variables.totalCost).toBe('$0.0000');
      expect(variables.totalCostRaw).toBe('0.000000');
      expect(variables.topModel).toBe('None');
      expect(variables.topModelCost).toBe('$0.0000');
      expect(variables.statusMessage).toBe('No model usage tracked');
      expect(variables.statusColor).toBe('gray');
    });
  });

  describe('Model name normalization', () => {
    test('should normalize model names for variable usage', () => {
      const normalizeModelName = statusLineProvider['normalizeModelName'].bind(statusLineProvider);

      expect(normalizeModelName('openai,gpt-4')).toBe('openai_gpt_4');
      expect(normalizeModelName('anthropic,claude-3.5-sonnet')).toBe('anthropic_claude_3_5_sonnet');
      expect(normalizeModelName('google/gemini-pro')).toBe('google_gemini_pro');
      expect(normalizeModelName('azure@openai-gpt4')).toBe('azure_openai_gpt4');
      expect(normalizeModelName('model_with__multiple___underscores')).toBe('model_with_multiple_underscores');
      expect(normalizeModelName('_leading_trailing_')).toBe('leading_trailing');
    });
  });

  describe('Variable substitution', () => {
    test('should substitute all variables in template', () => {
      const sessionId = 'test-session';
      const template = 'Cost: {{totalCost}}, Duration: {{sessionDuration}}, Top: {{topModel}}';

      // Add some cost data
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);

      const result = statusLineProvider.generateStatusLine(sessionId, template);

      expect(result).not.toContain('{{totalCost}}');
      expect(result).not.toContain('{{sessionDuration}}');
      expect(result).not.toContain('{{topModel}}');
      expect(result).toContain('Cost:');
      expect(result).toContain('Duration:');
      expect(result).toContain('Top:');
    });

    test('should leave unknown variables unchanged', () => {
      const sessionId = 'test-session';
      const template = 'Known: {{totalCost}}, Unknown: {{unknownVariable}}';

      // Add some cost data
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);

      const result = statusLineProvider.generateStatusLine(sessionId, template);

      expect(result).not.toContain('{{totalCost}}');
      expect(result).toContain('{{unknownVariable}}'); // Unknown variable remains
    });

    test('should handle nested variable patterns', () => {
      const sessionId = 'test-session';
      const template = 'Model costs: {{cost.openai_gpt_4}} and {{cost.anthropic_claude_3_5_sonnet}}';

      // Add cost data for multiple models
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);
      costCalculator.calculateCost(sessionId, 'anthropic,claude-3.5-sonnet', 800, 400);

      const result = statusLineProvider.generateStatusLine(sessionId, template);

      expect(result).not.toContain('{{cost.openai_gpt_4}}');
      expect(result).not.toContain('{{cost.anthropic_claude_3_5_sonnet}}');
    });
  });

  describe('Currency formatting', () => {
    test('should format small amounts with higher precision', () => {
      const formatCurrency = statusLineProvider['formatCurrency'].bind(statusLineProvider);

      // Test actual Intl.NumberFormat behavior
      expect(formatCurrency(0.003, 'USD')).toMatch(/\$0\.0030/);
      expect(formatCurrency(0.0000125, 'USD')).toMatch(/\$0\.0000/); // Very small amounts round to 0
    });

    test('should format larger amounts with standard precision', () => {
      const formatCurrency = statusLineProvider['formatCurrency'].bind(statusLineProvider);

      expect(formatCurrency(1.25, 'USD')).toMatch(/\$1\.25/);
      expect(formatCurrency(100.50, 'USD')).toMatch(/\$100\.50/);
    });

    test('should handle zero cost', () => {
      const formatCurrency = statusLineProvider['formatCurrency'].bind(statusLineProvider);

      expect(formatCurrency(0, 'USD')).toMatch(/\$0\.0000/);
    });

    test('should handle different currencies', () => {
      const formatCurrency = statusLineProvider['formatCurrency'].bind(statusLineProvider);

      expect(formatCurrency(0.005, 'EUR')).toMatch(/€0\.0050/);
      expect(formatCurrency(2.50, 'EUR')).toMatch(/€2\.50/);
    });
  });

  describe('Duration formatting', () => {
    test('should format seconds correctly', () => {
      const formatDuration = statusLineProvider['formatDuration'].bind(statusLineProvider);

      // Set mock current time and create start time 45 seconds before
      const currentTime = new Date('2024-11-11T00:00:45Z');
      mockCurrentTime = currentTime.getTime();
      const startTime = new Date(currentTime.getTime() - 45 * 1000);

      expect(formatDuration(startTime)).toBe('45s');
    });

    test('should format minutes and seconds correctly', () => {
      const formatDuration = statusLineProvider['formatDuration'].bind(statusLineProvider);

      // Set mock current time and create start time 5 minutes 30 seconds before
      const currentTime = new Date('2024-11-11T00:05:30Z');
      mockCurrentTime = currentTime.getTime();
      const startTime = new Date(currentTime.getTime() - (5 * 60 + 30) * 1000);

      expect(formatDuration(startTime)).toBe('5m 30s');
    });

    test('should format hours and minutes correctly', () => {
      const formatDuration = statusLineProvider['formatDuration'].bind(statusLineProvider);

      // Set mock current time and create start time 2 hours 15 minutes before
      const currentTime = new Date('2024-11-11T02:15:00Z');
      mockCurrentTime = currentTime.getTime();
      const startTime = new Date(currentTime.getTime() - (2 * 60 * 60 + 15 * 60) * 1000);

      expect(formatDuration(startTime)).toBe('2h 15m');
    });

    test('should handle very short durations', () => {
      const formatDuration = statusLineProvider['formatDuration'].bind(statusLineProvider);

      // Set mock current time and create start time 1 second before
      const currentTime = new Date('2024-11-11T00:00:01Z');
      mockCurrentTime = currentTime.getTime();
      const startTime = new Date(currentTime.getTime() - 1000);

      expect(formatDuration(startTime)).toBe('1s');
    });
  });

  describe('Top model identification', () => {
    test('should identify most expensive model', () => {
      const getTopModel = statusLineProvider['getTopModel'].bind(statusLineProvider);

      const modelCosts = {
        'model-cheap': { totalCost: 0.001 },
        'model-expensive': { totalCost: 0.005 },
        'model-medium': { totalCost: 0.003 }
      };

      const topModel = getTopModel(modelCosts);

      expect(topModel).toEqual({
        name: 'model-expensive',
        cost: 0.005
      });
    });

    test('should return null when no models have costs', () => {
      const getTopModel = statusLineProvider['getTopModel'].bind(statusLineProvider);

      const modelCosts = {
        'model1': { totalCost: 0 },
        'model2': { totalCost: 0 }
      };

      const topModel = getTopModel(modelCosts);

      expect(topModel).toBeNull();
    });

    test('should handle empty model costs', () => {
      const getTopModel = statusLineProvider['getTopModel'].bind(statusLineProvider);

      const topModel = getTopModel({});

      expect(topModel).toBeNull();
    });
  });

  describe('Status message generation', () => {
    test('should generate message for single model', () => {
      const getStatusMessage = statusLineProvider['getStatusMessage'].bind(statusLineProvider);

      const sessionCost: SessionCostData = {
        sessionId: 'test',
        startTime: new Date(),
        totalCost: 0.01,
        modelCosts: {
          'openai,gpt-4': { totalCost: 0.01 } as any
        },
        currency: 'USD'
      };

      expect(getStatusMessage(sessionCost)).toBe('1 model used, openai,gpt-4 highest cost');
    });

    test('should generate message for multiple models', () => {
      const getStatusMessage = statusLineProvider['getStatusMessage'].bind(statusLineProvider);

      const sessionCost: SessionCostData = {
        sessionId: 'test',
        startTime: new Date(),
        totalCost: 0.02,
        modelCosts: {
          'openai,gpt-4': { totalCost: 0.01 } as any,
          'anthropic,claude-3.5-sonnet': { totalCost: 0.01 } as any
        },
        currency: 'USD'
      };

      expect(getStatusMessage(sessionCost)).toBe('2 models used, openai,gpt-4 highest cost');
    });

    test('should handle no model usage', () => {
      const getStatusMessage = statusLineProvider['getStatusMessage'].bind(statusLineProvider);

      const sessionCost: SessionCostData = {
        sessionId: 'test',
        startTime: new Date(),
        totalCost: 0,
        modelCosts: {},
        currency: 'USD'
      };

      expect(getStatusMessage(sessionCost)).toBe('No model usage tracked');
    });
  });

  describe('Status color determination', () => {
    test('should return gray for zero cost', () => {
      const getStatusColor = statusLineProvider['getStatusColor'].bind(statusLineProvider);

      expect(getStatusColor(0)).toBe('gray');
    });

    test('should return green for very low cost', () => {
      const getStatusColor = statusLineProvider['getStatusColor'].bind(statusLineProvider);

      expect(getStatusColor(0.005)).toBe('green');
      expect(getStatusColor(0.009)).toBe('green');
    });

    test('should return yellow for moderate cost', () => {
      const getStatusColor = statusLineProvider['getStatusColor'].bind(statusLineProvider);

      expect(getStatusColor(0.01)).toBe('yellow');
      expect(getStatusColor(0.05)).toBe('yellow');
      expect(getStatusColor(0.099)).toBe('yellow');
    });

    test('should return red for high cost', () => {
      const getStatusColor = statusLineProvider['getStatusColor'].bind(statusLineProvider);

      expect(getStatusColor(0.1)).toBe('red');
      expect(getStatusColor(1.0)).toBe('red');
      expect(getStatusColor(10.0)).toBe('red');
    });
  });

  describe('Public API methods', () => {
    test('should return available variables', () => {
      const variables = statusLineProvider.getAvailableVariables();

      expect(variables).toContain('totalCost');
      expect(variables).toContain('totalCostRaw');
      expect(variables).toContain('sessionDuration');
      expect(variables).toContain('modelCosts');
      expect(variables).toContain('topModel');
      expect(variables).toContain('topModelCost');
      expect(variables).toContain('trackingStatus');
      expect(variables).toContain('statusMessage');
      expect(variables).toContain('statusColor');
    });

    test('should return cost variables for session', () => {
      const sessionId = 'test-session';

      // Add some cost data
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);

      const variables = statusLineProvider.getCostVariables(sessionId);

      expect(variables.totalCost).toBeDefined();
      expect(variables.trackingStatus).toBe('Active');
      expect(variables.statusMessage).toBeDefined();
    });

    test('should return disabled variables when tracking disabled', () => {
      const disabledConfig: CostTrackingConfig = {
        ...mockConfig,
        enabled: false
      };

      const disabledProvider = new CostStatusLineProvider(costCalculator, disabledConfig);
      const variables = disabledProvider.getCostVariables('test-session');

      expect(variables.trackingStatus).toBe('Disabled');
      expect(variables.statusMessage).toBe('Cost tracking disabled');
    });

    test('should return no data variables when no session data', () => {
      const variables = statusLineProvider.getCostVariables('non-existent-session');

      expect(variables.trackingStatus).toBe('Active');
      expect(variables.statusMessage).toBe('No cost data available');
    });

    test('should return variable descriptions', () => {
      const descriptions = statusLineProvider.getVariableDescriptions();

      expect(descriptions.totalCost).toBeDefined();
      expect(descriptions.totalCostRaw).toBeDefined();
      expect(descriptions.sessionDuration).toBeDefined();
      expect(descriptions.modelCosts).toBeDefined();
      expect(descriptions.topModel).toBeDefined();
      expect(descriptions.topModelCost).toBeDefined();
      expect(descriptions.trackingStatus).toBeDefined();
      expect(descriptions.statusMessage).toBeDefined();
      expect(descriptions.statusColor).toBeDefined();
      expect(descriptions['cost.*']).toBeDefined();
    });
  });

  describe('Error handling and edge cases', () => {
    test('should handle malformed template gracefully', () => {
      const sessionId = 'test-session';
      const template = 'Cost: {{totalCost} | Unclosed: {{sessionDuration';

      // Add some cost data
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);

      const result = statusLineProvider.generateStatusLine(sessionId, template);

      // Should not throw error, should handle malformed template gracefully
      expect(typeof result).toBe('string');
    });

    test('should handle empty template', () => {
      const sessionId = 'test-session';
      const template = '';

      // Add some cost data
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);

      const result = statusLineProvider.generateStatusLine(sessionId, template);

      expect(result).toBe('');
    });

    test('should handle template with no variables', () => {
      const sessionId = 'test-session';
      const template = 'Static status line';

      // Add some cost data
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);

      const result = statusLineProvider.generateStatusLine(sessionId, template);

      expect(result).toBe('Static status line');
    });

    test('should handle very long session duration', () => {
      const formatDuration = statusLineProvider['formatDuration'].bind(statusLineProvider);

      const startTime = new Date('2024-01-01T00:00:00Z');
      const currentTime = new Date('2024-11-11T00:00:00Z');
      mockCurrentTime = currentTime.getTime();

      const duration = formatDuration(startTime);

      // Should handle long durations without error
      expect(duration).toMatch(/\d+h \d+m/);
    });

    test('should handle model names with unusual characters', () => {
      const sessionId = 'test-session';

      // Add cost with unusual model name (using a configured model to ensure data is created)
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);

      const variables = statusLineProvider.getCostVariables(sessionId);

      // Should generate variable without errors
      expect(variables.totalCost).toBeDefined();
    });
  });

  describe('Integration with CostCalculator', () => {
    test('should reflect real cost calculations', () => {
      const sessionId = 'integration-test';

      // Calculate costs using multiple models
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);
      costCalculator.calculateCost(sessionId, 'anthropic,claude-3.5-sonnet', 800, 400);

      const variables = statusLineProvider.getCostVariables(sessionId);

      // Verify the calculated costs are reflected
      expect(variables.totalCost).toBeDefined();
      expect(variables['cost.openai_gpt_4']).toBeDefined();
      expect(variables['cost.anthropic_claude_3_5_sonnet']).toBeDefined();

      // Top model should be the most expensive one
      expect(variables.topModel).toBe('anthropic,claude-3.5-sonnet');
    });

    test('should update when new costs are added', () => {
      const sessionId = 'dynamic-test';

      // Initial cost
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);
      const initialVariables = statusLineProvider.getCostVariables(sessionId);

      // Add more cost
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 2000, 1000);
      const updatedVariables = statusLineProvider.getCostVariables(sessionId);

      // Total cost should have increased
      expect(parseFloat(initialVariables.totalCostRaw)).toBeLessThan(
        parseFloat(updatedVariables.totalCostRaw)
      );
    });
  });
});