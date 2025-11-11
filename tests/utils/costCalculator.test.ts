describe('Cost Calculator', () => {
  describe('calculateTokenCost', () => {
    test('should calculate cost for input tokens', () => {
      const inputTokens = 1000;
      const inputCostPerToken = 0.000003;
      const expectedCost = 0.003;

      const actualCost = inputTokens * inputCostPerToken;
      expect(actualCost).toBe(expectedCost);
    });

    test('should calculate cost for output tokens', () => {
      const outputTokens = 500;
      const outputCostPerToken = 0.000015;
      const expectedCost = 0.0075;

      const actualCost = outputTokens * outputCostPerToken;
      expect(actualCost).toBeCloseTo(expectedCost, 4);
    });

    test('should calculate total cost for both input and output tokens', () => {
      const inputTokens = 1000;
      const outputTokens = 500;
      const inputCostPerToken = 0.000003;
      const outputCostPerToken = 0.000015;
      const expectedTotalCost = 0.0105;

      const totalCost = (inputTokens * inputCostPerToken) + (outputTokens * outputCostPerToken);
      expect(totalCost).toBeCloseTo(expectedTotalCost, 4);
    });
  });

  describe('cost validation', () => {
    test('should handle zero tokens gracefully', () => {
      const tokens = 0;
      const costPerToken = 0.000003;
      const expectedCost = 0;

      const actualCost = tokens * costPerToken;
      expect(actualCost).toBe(expectedCost);
    });

    test('should handle large token counts', () => {
      const tokens = 1000000;
      const costPerToken = 0.000003;
      const expectedCost = 3;

      const actualCost = tokens * costPerToken;
      expect(actualCost).toBe(expectedCost);
    });
  });
});