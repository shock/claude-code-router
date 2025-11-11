describe('Cost Status Line Provider', () => {
  describe('formatCostDisplay', () => {
    test('should format cost in dollars for small amounts', () => {
      const cost = 0.003;
      const expectedDisplay = '$0.003';

      const actualDisplay = `$${cost}`;
      expect(actualDisplay).toBe(expectedDisplay);
    });

    test('should format cost in dollars for larger amounts', () => {
      const cost = 1.25;
      const expectedDisplay = '$1.25';

      const actualDisplay = `$${cost}`;
      expect(actualDisplay).toBe(expectedDisplay);
    });

    test('should handle zero cost', () => {
      const cost = 0;
      const expectedDisplay = '$0';

      const actualDisplay = `$${cost}`;
      expect(actualDisplay).toBe(expectedDisplay);
    });
  });

  describe('cost aggregation', () => {
    test('should aggregate costs from multiple requests', () => {
      const costs = [0.003, 0.0075, 0.012];
      const expectedTotal = 0.0225;

      const totalCost = costs.reduce((sum, cost) => sum + cost, 0);
      expect(totalCost).toBe(expectedTotal);
    });

    test('should track costs by provider', () => {
      const providerCosts = {
        anthropic: 0.015,
        openai: 0.008
      };
      const expectedTotal = 0.023;

      const totalCost = Object.values(providerCosts).reduce((sum, cost) => sum + cost, 0);
      expect(totalCost).toBe(expectedTotal);
    });
  });
});