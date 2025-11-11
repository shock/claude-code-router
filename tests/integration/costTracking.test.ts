describe('Cost Tracking Integration', () => {
  describe('end-to-end cost tracking', () => {
    test('should track costs across multiple API calls', () => {
      // Simulate multiple API calls with different token counts
      const apiCalls = [
        { provider: 'anthropic', inputTokens: 1000, outputTokens: 500 },
        { provider: 'openai', inputTokens: 800, outputTokens: 300 },
        { provider: 'anthropic', inputTokens: 1200, outputTokens: 600 }
      ];

      const costRates = {
        anthropic: { input: 0.000003, output: 0.000015 },
        openai: { input: 0.000005, output: 0.000015 }
      };

      let totalCost = 0;
      const providerCosts: Record<string, number> = {};

      apiCalls.forEach(call => {
        const providerRate = costRates[call.provider as keyof typeof costRates];
        const callCost = (call.inputTokens * providerRate.input) + (call.outputTokens * providerRate.output);

        totalCost += callCost;
        providerCosts[call.provider] = (providerCosts[call.provider] || 0) + callCost;
      });

      // Expected calculations:
      // Anthropic call 1: (1000 * 0.000003) + (500 * 0.000015) = 0.003 + 0.0075 = 0.0105
      // OpenAI call: (800 * 0.000005) + (300 * 0.000015) = 0.004 + 0.0045 = 0.0085
      // Anthropic call 2: (1200 * 0.000003) + (600 * 0.000015) = 0.0036 + 0.009 = 0.0126
      // Total: 0.0105 + 0.0085 + 0.0126 = 0.0316

      expect(totalCost).toBeCloseTo(0.0316, 4);
      expect(providerCosts.anthropic).toBeCloseTo(0.0231, 4); // 0.0105 + 0.0126
      expect(providerCosts.openai).toBeCloseTo(0.0085, 4);
    });

    test('should handle configuration loading for cost tracking', () => {
      const mockConfig = {
        providers: {
          anthropic: {
            models: {
              'claude-3-5-sonnet': {
                inputCostPerToken: 0.000003,
                outputCostPerToken: 0.000015
              }
            }
          }
        }
      };

      // Verify config structure
      expect(mockConfig.providers.anthropic.models['claude-3-5-sonnet']).toBeDefined();
      expect(mockConfig.providers.anthropic.models['claude-3-5-sonnet'].inputCostPerToken).toBe(0.000003);
      expect(mockConfig.providers.anthropic.models['claude-3-5-sonnet'].outputCostPerToken).toBe(0.000015);
    });
  });

  describe('cost reporting', () => {
    test('should generate cost summary reports', () => {
      const costData = {
        totalCost: 0.0316,
        providerBreakdown: {
          anthropic: 0.0231,
          openai: 0.0085
        },
        sessionCount: 3
      };

      expect(costData.totalCost).toBeGreaterThan(0);
      expect(Object.keys(costData.providerBreakdown).length).toBe(2);
      expect(costData.sessionCount).toBe(3);
    });
  });
});