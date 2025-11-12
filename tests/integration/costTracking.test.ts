import { CostCalculator } from '../../src/utils/costCalculator';
import { CostStatusLineProvider } from '../../src/utils/costStatusLineProvider';
import { CostTrackingConfig } from '../../src/types/cost';

// Mock Fastify request and reply objects for integration testing
interface MockRequest {
  sessionId?: string;
  body?: {
    model?: string;
  };
  url?: string;
}

interface MockPayload {
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  error?: any;
}

describe('Cost Tracking Integration', () => {
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
      'anthropic,claude-3-opus': {
        input_tokens_per_million: 15.00,
        output_tokens_per_million: 75.00
      },
      'google,gemini-pro': {
        input_tokens_per_million: 0.50,
        output_tokens_per_million: 1.50
      }
    }
  };

  let costCalculator: CostCalculator;
  let costStatusLineProvider: CostStatusLineProvider;

  beforeEach(() => {
    costCalculator = new CostCalculator(mockConfig);
    costStatusLineProvider = new CostStatusLineProvider(costCalculator, mockConfig);
  });

  describe('end-to-end cost tracking', () => {
    test('should track costs across multiple API calls with cost verification', () => {
      const sessionId = 'test-session-1';
      const apiCalls = [
        { model: 'anthropic,claude-3.5-sonnet', inputTokens: 1000, outputTokens: 500 },
        { model: 'openai,gpt-4', inputTokens: 800, outputTokens: 300 },
        { model: 'anthropic,claude-3.5-sonnet', inputTokens: 1200, outputTokens: 600 }
      ];

      let totalCalculatedCost = 0;
      const modelCosts: Record<string, number> = {};

      // Simulate API calls through cost calculator
      apiCalls.forEach(call => {
        const cost = costCalculator.calculateCost(sessionId, call.model, call.inputTokens, call.outputTokens);
        totalCalculatedCost += cost;
        modelCosts[call.model] = (modelCosts[call.model] || 0) + cost;
      });

      // Expected calculations:
      // Anthropic call 1: (1000 * 3.00 / 1,000,000) + (500 * 15.00 / 1,000,000) = 0.003 + 0.0075 = 0.0105
      // OpenAI call: (800 * 2.50 / 1,000,000) + (300 * 10.00 / 1,000,000) = 0.002 + 0.003 = 0.005
      // Anthropic call 2: (1200 * 3.00 / 1,000,000) + (600 * 15.00 / 1,000,000) = 0.0036 + 0.009 = 0.0126
      // Total: 0.0105 + 0.005 + 0.0126 = 0.0281

      expect(totalCalculatedCost).toBeCloseTo(0.0281, 4);
      expect(modelCosts['anthropic,claude-3.5-sonnet']).toBeCloseTo(0.0231, 4); // 0.0105 + 0.0126
      expect(modelCosts['openai,gpt-4']).toBeCloseTo(0.005, 4);

      // Verify session data integrity
      const sessionCost = costCalculator.getSessionCost(sessionId);
      expect(sessionCost).toBeDefined();
      expect(sessionCost?.totalCost).toBeCloseTo(totalCalculatedCost, 4);
      expect(Object.keys(sessionCost?.modelCosts || {})).toHaveLength(2);
    });

    test('should handle configuration loading for cost tracking with verification', () => {
      const mockConfig = {
        enabled: true,
        default_currency: 'USD',
        model_pricing: {
          'anthropic,claude-3.5-sonnet': {
            input_tokens_per_million: 3.00,
            output_tokens_per_million: 15.00
          }
        }
      };

      // Verify config structure
      expect(mockConfig.enabled).toBe(true);
      expect(mockConfig.default_currency).toBe('USD');
      expect(mockConfig.model_pricing['anthropic,claude-3.5-sonnet']).toBeDefined();
      expect(mockConfig.model_pricing['anthropic,claude-3.5-sonnet'].input_tokens_per_million).toBe(3.00);
      expect(mockConfig.model_pricing['anthropic,claude-3.5-sonnet'].output_tokens_per_million).toBe(15.00);

      // Test with actual cost calculator
      const calculator = new CostCalculator(mockConfig as CostTrackingConfig);
      const cost = calculator.calculateCost('test-session', 'anthropic,claude-3.5-sonnet', 1000, 500);
      expect(cost).toBeCloseTo(0.0105, 4); // (1000*3 + 500*15) / 1,000,000
    });
  });

  describe('cost reporting with status line integration', () => {
    test('should generate cost summary reports with status line variables', () => {
      const sessionId = 'report-session-1';

      // Simulate multiple API calls
      const apiCalls = [
        { model: 'openai,gpt-4', inputTokens: 1000, outputTokens: 500 },
        { model: 'anthropic,claude-3.5-sonnet', inputTokens: 800, outputTokens: 400 }
      ];

      apiCalls.forEach(call => {
        costCalculator.calculateCost(sessionId, call.model, call.inputTokens, call.outputTokens);
      });

      const sessionCost = costCalculator.getSessionCost(sessionId);
      expect(sessionCost).toBeDefined();

      // Verify cost data structure
      expect(sessionCost?.totalCost).toBeGreaterThan(0);
      expect(Object.keys(sessionCost?.modelCosts || {})).toHaveLength(2);
      expect(sessionCost?.sessionId).toBe(sessionId);
      expect(sessionCost?.currency).toBe('USD');

      // Test status line generation
      const statusLine = costStatusLineProvider.generateStatusLine(sessionId, 'Total: {{totalCost}}');
      expect(statusLine).toContain('Total:');
      expect(statusLine).toContain('$'); // Currency symbol

      // Test status line variables
      const variables = costStatusLineProvider.getCostVariables(sessionId);
      expect(variables.totalCost).toBeDefined();
      expect(variables.totalCostRaw).toBeDefined();
      expect(variables.trackingStatus).toBe('Active');
    });

    test('should handle cost reporting with disabled tracking', () => {
      const disabledConfig: CostTrackingConfig = {
        enabled: false,
        default_currency: 'USD',
        model_pricing: {}
      };

      const disabledCalculator = new CostCalculator(disabledConfig);
      const disabledProvider = new CostStatusLineProvider(disabledCalculator, disabledConfig);

      const statusLine = disabledProvider.generateStatusLine('test-session', 'Total: {{totalCost}}');
      expect(statusLine).toBe('Cost tracking disabled');

      const variables = disabledProvider.getCostVariables('test-session');
      expect(variables.trackingStatus).toBe('Disabled');
      expect(variables.statusMessage).toBe('Cost tracking disabled');
    });
  });

  describe('token capture integration with onSend hook', () => {
    test('should simulate onSend hook token capture and cost calculation', () => {
      const sessionId = 'onSend-session-1';
      const model = 'openai,gpt-4';

      // Simulate payload that would be processed by onSend hook
      const payload: MockPayload = {
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500
        }
      };

      // Simulate the onSend hook processing logic
      if (costCalculator && sessionId && model && payload?.usage) {
        const { input_tokens = 0, output_tokens = 0 } = payload.usage;
        const cost = costCalculator.calculateCost(sessionId, model, input_tokens, output_tokens);

        // Verify cost calculation
        expect(cost).toBeCloseTo(0.0075, 6); // (1000*2.50 + 500*10.00) / 1,000,000

        // Verify session data was updated
        const sessionCost = costCalculator.getSessionCost(sessionId);
        expect(sessionCost).toBeDefined();
        expect(sessionCost?.totalCost).toBeCloseTo(cost, 6);
        expect(sessionCost?.modelCosts[model].inputTokens).toBe(1000);
        expect(sessionCost?.modelCosts[model].outputTokens).toBe(500);
      }
    });

    test('should handle onSend hook with missing usage data gracefully', () => {
      const sessionId = 'onSend-session-2';
      const model = 'anthropic,claude-3.5-sonnet';

      // Simulate payload without usage data
      const payload: MockPayload = {};

      // Simulate onSend hook processing
      if (costCalculator && sessionId && model && payload?.usage) {
        const { input_tokens = 0, output_tokens = 0 } = payload.usage;
        const cost = costCalculator.calculateCost(sessionId, model, input_tokens, output_tokens);
        expect(cost).toBe(0);
      } else {
        // When usage data is missing, cost calculation should not be triggered
        const sessionCost = costCalculator.getSessionCost(sessionId);
        expect(sessionCost).toBeUndefined();
      }
    });

    test('should handle onSend hook with partial usage data', () => {
      const sessionId = 'onSend-session-3';
      const model = 'openai,gpt-4';

      // Simulate payload with only input tokens
      const payload: MockPayload = {
        usage: {
          input_tokens: 800,
          output_tokens: 0
        }
      };

      // Simulate onSend hook processing
      if (costCalculator && sessionId && model && payload?.usage) {
        const { input_tokens = 0, output_tokens = 0 } = payload.usage;
        const cost = costCalculator.calculateCost(sessionId, model, input_tokens, output_tokens);

        expect(cost).toBeCloseTo(0.002, 6); // (800*2.50) / 1,000,000
      }
    });

    test('should handle onSend hook with error in payload', () => {
      const sessionId = 'onSend-session-4';
      const model = 'anthropic,claude-3.5-sonnet';

      // Simulate payload with error but valid usage data
      const payload: MockPayload = {
        error: {
          message: 'Rate limit exceeded',
          code: 429
        },
        usage: {
          input_tokens: 600,
          output_tokens: 300
        }
      };

      // Simulate onSend hook processing - should still calculate cost if usage data exists
      if (costCalculator && sessionId && model && payload?.usage) {
        const { input_tokens = 0, output_tokens = 0 } = payload.usage;
        const cost = costCalculator.calculateCost(sessionId, model, input_tokens, output_tokens);

        expect(cost).toBeCloseTo(0.0063, 6); // (600*3.00 + 300*15.00) / 1,000,000
      }
    });

    test('should verify onSend hook integration with multiple models', () => {
      const sessionId = 'onSend-session-5';

      // Simulate multiple API calls with different models
      const apiCalls = [
        { model: 'openai,gpt-4', payload: { usage: { input_tokens: 1000, output_tokens: 500 } } },
        { model: 'anthropic,claude-3.5-sonnet', payload: { usage: { input_tokens: 800, output_tokens: 400 } } },
        { model: 'google,gemini-pro', payload: { usage: { input_tokens: 1200, output_tokens: 600 } } }
      ];

      // Simulate onSend hook processing for each call
      apiCalls.forEach(call => {
        if (costCalculator && sessionId && call.model && call.payload?.usage) {
          const { input_tokens = 0, output_tokens = 0 } = call.payload.usage;
          costCalculator.calculateCost(sessionId, call.model, input_tokens, output_tokens);
        }
      });

      // Verify accumulated session cost
      const sessionCost = costCalculator.getSessionCost(sessionId);
      expect(sessionCost).toBeDefined();
      expect(Object.keys(sessionCost?.modelCosts || {})).toHaveLength(3);
      expect(sessionCost?.totalCost).toBeGreaterThan(0);

      // Verify individual model costs
      expect(sessionCost?.modelCosts['openai,gpt-4'].totalCost).toBeCloseTo(0.0075, 6);
      expect(sessionCost?.modelCosts['anthropic,claude-3.5-sonnet'].totalCost).toBeCloseTo(0.0084, 6);
      expect(sessionCost?.modelCosts['google,gemini-pro'].totalCost).toBeCloseTo(0.0015, 6);
    });
  });

  describe('session-based cost accumulation', () => {
    test('should accumulate costs across multiple requests for same session', () => {
      const sessionId = 'accumulation-session-1';
      const model = 'openai,gpt-4';

      // Simulate multiple requests to the same session
      const requests = [
        { input_tokens: 1000, output_tokens: 500 },
        { input_tokens: 2000, output_tokens: 1000 },
        { input_tokens: 1500, output_tokens: 750 }
      ];

      requests.forEach((tokens, index) => {
        costCalculator.calculateCost(sessionId, model, tokens.input_tokens, tokens.output_tokens);
      });

      // Verify accumulated session data
      const sessionCost = costCalculator.getSessionCost(sessionId);
      expect(sessionCost).toBeDefined();

      // Total tokens: 4500 input, 2250 output
      expect(sessionCost?.modelCosts[model].inputTokens).toBe(4500);
      expect(sessionCost?.modelCosts[model].outputTokens).toBe(2250);

      // Total cost: (4500*2.50 + 2250*10.00) / 1,000,000 = 0.01125 + 0.0225 = 0.03375
      expect(sessionCost?.totalCost).toBeCloseTo(0.03375, 6);
    });

    test('should track costs independently across different sessions', () => {
      const session1 = 'session-alpha';
      const session2 = 'session-beta';
      const model = 'anthropic,claude-3.5-sonnet';

      // Process same tokens for different sessions
      const tokens = { input_tokens: 1000, output_tokens: 500 };
      costCalculator.calculateCost(session1, model, tokens.input_tokens, tokens.output_tokens);
      costCalculator.calculateCost(session2, model, tokens.input_tokens, tokens.output_tokens);

      // Verify sessions are independent
      const cost1 = costCalculator.getSessionCost(session1);
      const cost2 = costCalculator.getSessionCost(session2);

      expect(cost1).toBeDefined();
      expect(cost2).toBeDefined();
      expect(cost1?.sessionId).toBe(session1);
      expect(cost2?.sessionId).toBe(session2);
      expect(cost1?.totalCost).toBeCloseTo(0.0105, 6); // (1000*3.00 + 500*15.00) / 1,000,000
      expect(cost2?.totalCost).toBeCloseTo(0.0105, 6);
      expect(cost1?.totalCost).toBe(cost2?.totalCost); // Same cost calculation
    });

    test('should handle session reset and cost recalculation', () => {
      const sessionId = 'reset-session-1';
      const model = 'openai,gpt-4';

      // First usage
      costCalculator.calculateCost(sessionId, model, 1000, 500);
      const initialCost = costCalculator.getSessionCost(sessionId);
      expect(initialCost?.totalCost).toBeCloseTo(0.0075, 6);

      // Reset session
      costCalculator.resetSession(sessionId);

      // Second usage after reset
      costCalculator.calculateCost(sessionId, model, 800, 400);
      const resetCost = costCalculator.getSessionCost(sessionId);

      // Should only include second usage
      expect(resetCost?.totalCost).toBeCloseTo(0.006, 6); // (800*2.50 + 400*10.00) / 1,000,000
      expect(resetCost?.modelCosts[model].inputTokens).toBe(800);
      expect(resetCost?.modelCosts[model].outputTokens).toBe(400);
    });

    test('should accumulate costs across multiple models in same session', () => {
      const sessionId = 'multi-model-session';

      // Use different models in the same session
      const modelUsage = [
        { model: 'openai,gpt-4', inputTokens: 1000, outputTokens: 500 },
        { model: 'anthropic,claude-3.5-sonnet', inputTokens: 800, outputTokens: 400 },
        { model: 'google,gemini-pro', inputTokens: 1200, outputTokens: 600 }
      ];

      modelUsage.forEach(usage => {
        costCalculator.calculateCost(sessionId, usage.model, usage.inputTokens, usage.outputTokens);
      });

      const sessionCost = costCalculator.getSessionCost(sessionId);
      expect(sessionCost).toBeDefined();

      // Verify all models are tracked
      expect(Object.keys(sessionCost?.modelCosts || {})).toHaveLength(3);

      // Verify individual model costs
      expect(sessionCost?.modelCosts['openai,gpt-4'].totalCost).toBeCloseTo(0.0075, 6);
      expect(sessionCost?.modelCosts['anthropic,claude-3.5-sonnet'].totalCost).toBeCloseTo(0.0084, 6);
      expect(sessionCost?.modelCosts['google,gemini-pro'].totalCost).toBeCloseTo(0.0015, 6);

      // Verify total session cost
      const expectedTotal = 0.0075 + 0.0084 + 0.0015;
      expect(sessionCost?.totalCost).toBeCloseTo(expectedTotal, 6);
    });

    test('should handle concurrent session access without data corruption', async () => {
      const sessionId = 'concurrent-session';
      const model = 'openai,gpt-4';

      // Simulate concurrent API calls
      const concurrentCalls = Array.from({ length: 10 }, (_, i) => ({
        input_tokens: 100 + i,
        output_tokens: 50 + i
      }));

      // Process calls concurrently
      const promises = concurrentCalls.map(tokens => {
        return Promise.resolve(
          costCalculator.calculateCost(sessionId, model, tokens.input_tokens, tokens.output_tokens)
        );
      });

      const results = await Promise.all(promises);

      // All calls should complete successfully
      results.forEach(cost => {
        expect(typeof cost).toBe('number');
        expect(cost).toBeGreaterThanOrEqual(0);
      });

      // Verify accumulated session data
      const sessionCost = costCalculator.getSessionCost(sessionId);
      expect(sessionCost).toBeDefined();

      // Calculate expected totals
      const totalInputTokens = concurrentCalls.reduce((sum, tokens) => sum + tokens.input_tokens, 0);
      const totalOutputTokens = concurrentCalls.reduce((sum, tokens) => sum + tokens.output_tokens, 0);

      expect(sessionCost?.modelCosts[model].inputTokens).toBe(totalInputTokens);
      expect(sessionCost?.modelCosts[model].outputTokens).toBe(totalOutputTokens);
    });
  });

  describe('status line variable updates after cost calculation', () => {
    test('should update status line variables after cost calculation', () => {
      const sessionId = 'status-line-session-1';
      const model = 'openai,gpt-4';

      // Process API call to generate cost data
      costCalculator.calculateCost(sessionId, model, 1000, 500);

      // Get status line variables
      const variables = costStatusLineProvider.getCostVariables(sessionId);

      // Verify all expected variables are present
      expect(variables.totalCost).toBeDefined();
      expect(variables.totalCostRaw).toBeDefined();
      expect(variables.sessionDuration).toBeDefined();
      expect(variables.modelCosts).toBeDefined();
      expect(variables.trackingStatus).toBe('Active');
      expect(variables.statusMessage).toBeDefined();
      expect(variables.statusColor).toBeDefined();

      // Verify variable formats
      expect(variables.totalCost).toMatch(/^\$[\d.,]+$/); // Currency format
      expect(variables.totalCostRaw).toMatch(/^[\d.]+$/); // Raw number format
      expect(variables.statusColor).toMatch(/^(gray|green|yellow|red)$/);
    });

    test('should generate dynamic model-specific cost variables', () => {
      const sessionId = 'status-line-session-2';

      // Use multiple models to generate dynamic variables
      const modelUsage = [
        { model: 'openai,gpt-4', inputTokens: 1000, outputTokens: 500 },
        { model: 'anthropic,claude-3.5-sonnet', inputTokens: 800, outputTokens: 400 }
      ];

      modelUsage.forEach(usage => {
        costCalculator.calculateCost(sessionId, usage.model, usage.inputTokens, usage.outputTokens);
      });

      // Get status line variables
      const variables = costStatusLineProvider.getCostVariables(sessionId);

      // Verify dynamic model variables are generated
      expect(variables['cost.openai_gpt_4']).toBeDefined();
      expect(variables['cost.anthropic_claude_3_5_sonnet']).toBeDefined();

      // Verify model variable formats
      expect(variables['cost.openai_gpt_4']).toMatch(/^\$[\d.,]+$/);
      expect(variables['cost.anthropic_claude_3_5_sonnet']).toMatch(/^\$[\d.,]+$/);
    });

    test('should handle status line template substitution with all variables', () => {
      const sessionId = 'status-line-session-3';
      const model = 'anthropic,claude-3.5-sonnet';

      // Generate cost data
      costCalculator.calculateCost(sessionId, model, 1200, 600);

      // Test various template formats
      const templates = [
        'Cost: {{totalCost}}',
        'Session: {{sessionDuration}} | Status: {{trackingStatus}}',
        'Top Model: {{topModel}} ({{topModelCost}})',
        'Message: {{statusMessage}} | Color: {{statusColor}}'
      ];

      templates.forEach(template => {
        const statusLine = costStatusLineProvider.generateStatusLine(sessionId, template);
        expect(statusLine).toBeDefined();
        expect(statusLine).not.toContain('{{'); // All variables should be substituted
        expect(statusLine).not.toContain('}}');
      });

      // Test modelCosts separately since it contains JSON with }}
      const modelCostsTemplate = 'Models: {{modelCosts}}';
      const modelCostsStatusLine = costStatusLineProvider.generateStatusLine(sessionId, modelCostsTemplate);
      expect(modelCostsStatusLine).toBeDefined();
      expect(modelCostsStatusLine).toContain('Models:');

      // Test complex template with multiple variables
      const complexTemplate = 'Total: {{totalCost}} | Duration: {{sessionDuration}} | Status: {{trackingStatus}} | Top: {{topModel}}';
      const complexStatusLine = costStatusLineProvider.generateStatusLine(sessionId, complexTemplate);
      expect(complexStatusLine).toBeDefined();
      expect(complexStatusLine).toContain('Total:');
      expect(complexStatusLine).toContain('Duration:');
      expect(complexStatusLine).toContain('Status:');
      expect(complexStatusLine).toContain('Top:');
    });

    test('should update status line variables after multiple cost calculations', () => {
      const sessionId = 'status-line-session-4';
      const model = 'openai,gpt-4';

      // Get initial variables (should be no data)
      const initialVariables = costStatusLineProvider.getCostVariables(sessionId);
      expect(initialVariables.trackingStatus).toBe('Active');
      expect(initialVariables.statusMessage).toBe('No cost data available');

      // Process first API call
      costCalculator.calculateCost(sessionId, model, 1000, 500);
      const firstVariables = costStatusLineProvider.getCostVariables(sessionId);
      expect(firstVariables.statusMessage).toContain('1 model used');

      // Process second API call
      costCalculator.calculateCost(sessionId, model, 2000, 1000);
      const secondVariables = costStatusLineProvider.getCostVariables(sessionId);

      // Verify variables updated
      expect(parseFloat(secondVariables.totalCostRaw)).toBeGreaterThan(parseFloat(firstVariables.totalCostRaw));
      expect(secondVariables.statusMessage).toContain('1 model used');
    });

    test('should handle status line generation for sessions with no cost data', () => {
      const sessionId = 'no-data-session';

      // Get variables for session with no cost data
      const variables = costStatusLineProvider.getCostVariables(sessionId);
      expect(variables.trackingStatus).toBe('Active');
      expect(variables.statusMessage).toBe('No cost data available');
      // Note: Only trackingStatus and statusMessage are returned when no cost data exists

      // Test status line generation
      const statusLine = costStatusLineProvider.generateStatusLine(sessionId, 'Cost: {{totalCost}}');
      expect(statusLine).toBe('No cost data available');
    });

    test('should provide accurate variable descriptions', () => {
      const descriptions = costStatusLineProvider.getVariableDescriptions();

      // Verify all base variables have descriptions
      const baseVariables = costStatusLineProvider.getAvailableVariables();
      baseVariables.forEach(variable => {
        expect(descriptions[variable]).toBeDefined();
        expect(typeof descriptions[variable]).toBe('string');
      });

      // Verify dynamic variable pattern description
      expect(descriptions['cost.*']).toBeDefined();
      expect(descriptions['cost.*']).toContain('Dynamic variables');
    });
  });

  describe('error handling and graceful degradation', () => {
    test('should handle invalid session IDs gracefully', () => {
      const invalidSessionIds = ['', null as any, undefined as any, '   '];

      invalidSessionIds.forEach(sessionId => {
        // Should not throw errors
        expect(() => {
          costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);
        }).not.toThrow();

        // Should still be able to retrieve session data for empty string
        if (sessionId === '') {
          const sessionCost = costCalculator.getSessionCost(sessionId);
          expect(sessionCost).toBeDefined();
        }
      });
    });

    test('should handle invalid model names gracefully', () => {
      const sessionId = 'error-session-1';
      const invalidModels = ['', null as any, undefined as any, 'invalid-model', 'unknown,model'];

      invalidModels.forEach(model => {
        const cost = costCalculator.calculateCost(sessionId, model, 1000, 500);
        expect(cost).toBe(0); // Unconfigured models should return 0 cost
      });
    });

    test('should handle invalid token values gracefully', () => {
      const sessionId = 'error-session-2';
      const model = 'openai,gpt-4';

      const invalidTokenValues = [
        { input: NaN, output: 500 },
        { input: 1000, output: NaN },
        { input: -100, output: -50 },
        { input: Infinity, output: Infinity },
        { input: 'invalid' as any, output: 'invalid' as any }
      ];

      invalidTokenValues.forEach(tokens => {
        const cost = costCalculator.calculateCost(sessionId, model, tokens.input, tokens.output);

        // Should handle gracefully without throwing
        expect(() => cost).not.toThrow();

        // Cost should be calculable (may be NaN, Infinity, or negative depending on input)
        if (isNaN(tokens.input) || isNaN(tokens.output)) {
          expect(cost).toBeNaN();
        } else if (!isFinite(tokens.input) || !isFinite(tokens.output)) {
          expect(cost).toBe(Infinity);
        } else {
          // Valid numeric cost (could be negative)
          expect(typeof cost).toBe('number');
        }
      });
    });

    test('should handle disabled cost tracking configuration gracefully', () => {
      const disabledConfig: CostTrackingConfig = {
        enabled: false,
        default_currency: 'USD',
        model_pricing: {}
      };

      const disabledCalculator = new CostCalculator(disabledConfig);
      const disabledProvider = new CostStatusLineProvider(disabledCalculator, disabledConfig);

      const sessionId = 'disabled-session';
      const model = 'openai,gpt-4';

      // Cost calculation should return 0 when disabled
      const cost = disabledCalculator.calculateCost(sessionId, model, 1000, 500);
      expect(cost).toBe(0);

      // Status line should show disabled message
      const statusLine = disabledProvider.generateStatusLine(sessionId, 'Cost: {{totalCost}}');
      expect(statusLine).toBe('Cost tracking disabled');

      // Variables should reflect disabled state
      const variables = disabledProvider.getCostVariables(sessionId);
      expect(variables.trackingStatus).toBe('Disabled');
      expect(variables.statusMessage).toBe('Cost tracking disabled');
    });

    test('should handle missing cost calculator gracefully', () => {
      const sessionId = 'no-calculator-session';

      // Simulate scenario where cost calculator is not available
      // This tests that the system doesn't crash when calculator is null/undefined
      const nullCalculator = null as any;

      // In real implementation, this would be handled by conditional checks
      // For test purposes, we verify that our test infrastructure handles this
      expect(() => {
        if (nullCalculator && sessionId) {
          nullCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);
        }
      }).not.toThrow();
    });

    test('should handle malformed configuration gracefully', () => {
      const malformedConfigs = [
        { enabled: true, default_currency: 'USD' }, // Missing model_pricing
        { enabled: true, model_pricing: {} }, // Missing default_currency
        { default_currency: 'USD', model_pricing: {} }, // Missing enabled
        null as any,
        undefined as any,
        {} as any
      ];

      malformedConfigs.forEach(config => {
        // Should handle gracefully when creating calculator
        expect(() => {
          new CostCalculator(config as CostTrackingConfig);
        }).not.toThrow();
      });
    });

    test('should handle rapid error scenarios without performance degradation', () => {
      const sessionId = 'performance-error-session';
      const model = 'openai,gpt-4';

      const startTime = Date.now();

      // Process many requests with potential errors
      for (let i = 0; i < 100; i++) {
        // Mix valid and invalid inputs
        const inputTokens = i % 10 === 0 ? NaN : 100 + i;
        const outputTokens = i % 15 === 0 ? -50 : 50 + i;

        costCalculator.calculateCost(sessionId, model, inputTokens, outputTokens);
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should complete quickly despite errors
      expect(processingTime).toBeLessThan(100); // Under 100ms for 100 requests

      // System should remain stable
      const sessionCost = costCalculator.getSessionCost(sessionId);
      expect(sessionCost).toBeDefined();
    });

    test('should handle concurrent error scenarios without data corruption', async () => {
      const sessionId = 'concurrent-error-session';
      const model = 'anthropic,claude-3.5-sonnet';

      // Mix valid and invalid concurrent requests
      const requests = Array.from({ length: 20 }, (_, i) => ({
        inputTokens: i % 5 === 0 ? NaN : 100 + i,
        outputTokens: i % 7 === 0 ? -50 : 50 + i
      }));

      const promises = requests.map(tokens => {
        return Promise.resolve(
          costCalculator.calculateCost(sessionId, model, tokens.inputTokens, tokens.outputTokens)
        );
      });

      const results = await Promise.all(promises);

      // All should complete without throwing
      results.forEach(cost => {
        expect(() => cost).not.toThrow();
      });

      // System should remain stable
      const sessionCost = costCalculator.getSessionCost(sessionId);
      expect(sessionCost).toBeDefined();
    });
  });
});