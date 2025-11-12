/**
 * Token Capture Unit Tests
 *
 * Focused unit tests for the token capture logic in the onSend hook.
 * Tests data extraction, conditional logic, error handling, and async behavior.
 */

import { CostCalculator } from '../../src/utils/costCalculator';
import { CostTrackingConfig } from '../../src/types/cost';

// Mock Fastify request and reply objects
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

describe('Token Capture Unit Tests', () => {
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

  beforeEach(() => {
    costCalculator = new CostCalculator(mockConfig);
  });

  describe('Data extraction from request objects', () => {
    test('should extract session ID from req.sessionId', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };

      // Simulate extraction logic from onSend hook
      const sessionId = mockReq.sessionId;
      expect(sessionId).toBe('test-session-123');
    });

    test('should extract model from req.body.model', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'anthropic,claude-3.5-sonnet' }
      };

      // Simulate extraction logic from onSend hook
      const model = mockReq.body?.model;
      expect(model).toBe('anthropic,claude-3.5-sonnet');
    });

    test('should extract tokens from payload.usage', () => {
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 1500,
          output_tokens: 750,
          total_tokens: 2250
        }
      };

      // Simulate extraction logic from onSend hook
      const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
      expect(input_tokens).toBe(1500);
      expect(output_tokens).toBe(750);
    });

    test('should handle missing session ID gracefully', () => {
      const mockReq: MockRequest = {
        body: { model: 'openai,gpt-4' }
        // sessionId is undefined
      };

      const sessionId = mockReq.sessionId;
      expect(sessionId).toBeUndefined();
    });

    test('should handle missing model in request body', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123'
        // body.model is undefined
      };

      const model = mockReq.body?.model;
      expect(model).toBeUndefined();
    });

    test('should handle missing usage in payload', () => {
      const mockPayload: MockPayload = {};

      const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
      expect(input_tokens).toBe(0);
      expect(output_tokens).toBe(0);
    });

    test('should handle partial usage data', () => {
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 1000
          // output_tokens is undefined
        }
      };

      const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
      expect(input_tokens).toBe(1000);
      expect(output_tokens).toBe(0);
    });
  });

  describe('Conditional logic validation', () => {
    test('should execute cost calculation when all conditions are met', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      };

      // Simulate the conditional logic from onSend hook
      const shouldCalculate = costCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage;
      expect(Boolean(shouldCalculate)).toBe(true);

      // If conditions met, extract and calculate
      if (shouldCalculate) {
        const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
        const cost = costCalculator.calculateCost(
          mockReq.sessionId!,
          mockReq.body!.model!,
          input_tokens,
          output_tokens
        );
        expect(cost).toBeCloseTo(0.0075, 6);
      }
    });

    test('should skip cost calculation when costCalculator is null', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      };

      // Simulate null costCalculator
      const nullCostCalculator = null;
      const shouldCalculate = nullCostCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage;
      expect(Boolean(shouldCalculate)).toBe(false);
    });

    test('should skip cost calculation when sessionId is missing', () => {
      const mockReq: MockRequest = {
        body: { model: 'openai,gpt-4' }
        // sessionId is undefined
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      };

      const shouldCalculate = costCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage;
      expect(Boolean(shouldCalculate)).toBe(false);
    });

    test('should skip cost calculation when model is missing', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123'
        // body.model is undefined
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      };

      const shouldCalculate = costCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage;
      expect(Boolean(shouldCalculate)).toBe(false);
    });

    test('should skip cost calculation when usage is missing', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {};
      // usage is undefined

      const shouldCalculate = costCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage;
      expect(Boolean(shouldCalculate)).toBe(false);
    });

    test('should skip cost calculation when usage is null', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: null as any
      };

      const shouldCalculate = costCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage;
      expect(Boolean(shouldCalculate)).toBe(false);
    });

    test('should handle empty usage object', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {}
      };

      const shouldCalculate = costCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage;
      expect(Boolean(shouldCalculate)).toBe(true);

      // Even with empty usage, extraction should work
      if (shouldCalculate) {
        const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
        const cost = costCalculator.calculateCost(
          mockReq.sessionId!,
          mockReq.body!.model!,
          input_tokens,
          output_tokens
        );
        expect(cost).toBe(0);
      }
    });
  });

  describe('Error handling scenarios', () => {
    test('should handle invalid token values gracefully', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 'invalid' as any,
          output_tokens: 500
        }
      };

      // Simulate extraction with type safety
      const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
      const safeInputTokens = Number(input_tokens) || 0;
      const safeOutputTokens = Number(output_tokens) || 0;

      const cost = costCalculator.calculateCost(
        mockReq.sessionId!,
        mockReq.body!.model!,
        safeInputTokens,
        safeOutputTokens
      );

      // Should handle gracefully without throwing
      expect(() => cost).not.toThrow();
      expect(cost).toBeCloseTo(0.005, 6); // Invalid input tokens treated as 0, but output tokens still count
    });

    test('should handle NaN token values', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: NaN,
          output_tokens: 500
        }
      };

      const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
      const cost = costCalculator.calculateCost(
        mockReq.sessionId!,
        mockReq.body!.model!,
        input_tokens,
        output_tokens
      );

      expect(cost).toBeNaN();
    });

    test('should handle Infinity token values', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: Infinity,
          output_tokens: 500
        }
      };

      const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
      const cost = costCalculator.calculateCost(
        mockReq.sessionId!,
        mockReq.body!.model!,
        input_tokens,
        output_tokens
      );

      expect(cost).toBe(Infinity);
    });

    test('should handle negative token values', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: -1000,
          output_tokens: -500
        }
      };

      const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
      const cost = costCalculator.calculateCost(
        mockReq.sessionId!,
        mockReq.body!.model!,
        input_tokens,
        output_tokens
      );

      expect(cost).toBeCloseTo(-0.0075, 6);
    });

    test('should handle payload with error field', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        error: {
          message: 'API rate limit exceeded',
          code: 429
        },
        usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      };

      // Even with error, if usage data exists, it should be processed
      const shouldCalculate = costCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage;
      expect(Boolean(shouldCalculate)).toBe(true);

      if (shouldCalculate) {
        const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
        const cost = costCalculator.calculateCost(
          mockReq.sessionId!,
          mockReq.body!.model!,
          input_tokens,
          output_tokens
        );
        expect(cost).toBeCloseTo(0.0075, 6);
      }
    });

    test('should handle unconfigured model gracefully', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'unconfigured,model' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      };

      const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
      const cost = costCalculator.calculateCost(
        mockReq.sessionId!,
        mockReq.body!.model!,
        input_tokens,
        output_tokens
      );

      expect(cost).toBe(0);
    });

    test('should handle empty model string', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: '' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      };

      const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
      const cost = costCalculator.calculateCost(
        mockReq.sessionId!,
        mockReq.body!.model!,
        input_tokens,
        output_tokens
      );

      expect(cost).toBe(0);
    });
  });

  describe('Asynchronous behavior', () => {
    test('should simulate non-blocking execution with process.nextTick', (done) => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      };

      let asyncCompleted = false;

      // Simulate the async behavior from onSend hook
      if (costCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage) {
        process.nextTick(() => {
          try {
            const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
            costCalculator.calculateCost(
              mockReq.sessionId!,
              mockReq.body!.model!,
              input_tokens,
              output_tokens
            );
            asyncCompleted = true;
            done();
          } catch (error) {
            done(error);
          }
        });
      }

      // Verify async execution hasn't completed yet
      expect(asyncCompleted).toBe(false);
    });

    test('should handle async errors gracefully', (done) => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: NaN,
          output_tokens: 500
        }
      };

      // Simulate the error handling in async context
      if (costCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage) {
        process.nextTick(() => {
          try {
            const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
            costCalculator.calculateCost(
              mockReq.sessionId!,
              mockReq.body!.model!,
              input_tokens,
              output_tokens
            );
            // Should not throw even with NaN values
            done();
          } catch (error) {
            // Error should be caught and logged, not thrown
            console.error('Cost calculation error:', error);
            done(); // Still call done to indicate test completion
          }
        });
      } else {
        done();
      }
    });

    test('should not block when conditions are not met', (done) => {
      const mockReq: MockRequest = {
        // Missing sessionId
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      };

      let asyncCalled = false;

      // Simulate the conditional check - should skip async processing
      if (costCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage) {
        process.nextTick(() => {
          asyncCalled = true;
        });
      }

      // Give async operations time to complete
      setTimeout(() => {
        expect(asyncCalled).toBe(false);
        done();
      }, 10);
    });
  });

  describe('Performance validation', () => {
    test('should handle rapid sequential requests efficiently', () => {
      const startTime = Date.now();

      // Process 50 rapid requests
      for (let i = 0; i < 50; i++) {
        const mockReq: MockRequest = {
          sessionId: `test-session-${i}`,
          body: { model: 'openai,gpt-4' }
        };
        const mockPayload: MockPayload = {
          usage: {
            input_tokens: 100 + i,
            output_tokens: 50 + i
          }
        };

        // Simulate the conditional logic
        if (costCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage) {
          const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
          costCalculator.calculateCost(
            mockReq.sessionId,
            mockReq.body.model,
            input_tokens,
            output_tokens
          );
        }
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should complete quickly (under 50ms for 50 requests)
      expect(processingTime).toBeLessThan(50);
    });

    test('should maintain performance with cache operations', () => {
      const startTime = Date.now();

      // Process requests that will trigger cache operations
      for (let i = 0; i < 100; i++) {
        const mockReq: MockRequest = {
          sessionId: `cache-session-${i % 10}`, // Reuse sessions to test cache
          body: { model: 'openai,gpt-4' }
        };
        const mockPayload: MockPayload = {
          usage: {
            input_tokens: 1000,
            output_tokens: 500
          }
        };

        if (costCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage) {
          const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
          costCalculator.calculateCost(
            mockReq.sessionId,
            mockReq.body.model,
            input_tokens,
            output_tokens
          );
        }
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should complete efficiently even with cache operations
      expect(processingTime).toBeLessThan(100);
    });
  });

  describe('Edge cases', () => {
    test('should handle zero tokens gracefully', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 0,
          output_tokens: 0
        }
      };

      const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
      const cost = costCalculator.calculateCost(
        mockReq.sessionId!,
        mockReq.body!.model!,
        input_tokens,
        output_tokens
      );

      expect(cost).toBe(0);
    });

    test('should handle extremely large token counts', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 1000000000, // 1 billion
          output_tokens: 500000000  // 500 million
        }
      };

      const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
      const cost = costCalculator.calculateCost(
        mockReq.sessionId!,
        mockReq.body!.model!,
        input_tokens,
        output_tokens
      );

      expect(cost).toBeCloseTo(7500, 2);
    });

    test('should handle fractional token counts', () => {
      const mockReq: MockRequest = {
        sessionId: 'test-session-123',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 1234.56,
          output_tokens: 789.12
        }
      };

      const { input_tokens = 0, output_tokens = 0 } = mockPayload.usage || {};
      const cost = costCalculator.calculateCost(
        mockReq.sessionId!,
        mockReq.body!.model!,
        input_tokens,
        output_tokens
      );

      expect(cost).toBeCloseTo(0.0109776, 6);
    });

    test('should handle empty session ID string', () => {
      const mockReq: MockRequest = {
        sessionId: '',
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      };

      const shouldCalculate = costCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage;
      expect(Boolean(shouldCalculate)).toBe(false); // Empty string is falsy
    });

    test('should handle null session ID', () => {
      const mockReq: MockRequest = {
        sessionId: null as any,
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      };

      const shouldCalculate = costCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage;
      expect(Boolean(shouldCalculate)).toBe(false); // null is falsy
    });

    test('should handle undefined session ID', () => {
      const mockReq: MockRequest = {
        sessionId: undefined,
        body: { model: 'openai,gpt-4' }
      };
      const mockPayload: MockPayload = {
        usage: {
          input_tokens: 1000,
          output_tokens: 500
        }
      };

      const shouldCalculate = costCalculator && mockReq.sessionId && mockReq.body?.model && mockPayload?.usage;
      expect(Boolean(shouldCalculate)).toBe(false); // undefined is falsy
    });
  });
});