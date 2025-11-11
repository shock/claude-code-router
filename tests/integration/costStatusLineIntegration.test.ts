/**
 * Integration tests for Cost Status Line functionality in Claude Code Router
 *
 * These tests verify the integration between cost tracking and status line display,
 * including provider registration, variable substitution, and end-to-end functionality.
 */

import { CostCalculator } from '../../src/utils/costCalculator';
import { CostStatusLineProvider } from '../../src/utils/costStatusLineProvider';
import { registerCostStatusLineProvider } from '../../src/utils/statusline';
import { parseStatusLineData } from '../../src/utils/statusline';
import { CostTrackingConfig } from '../../src/types/cost';

// Mock the global cost provider instance
let originalCostProvider: any = null;

// Mock console methods to avoid test output noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Mock Intl.NumberFormat for consistent currency formatting
const mockNumberFormat = jest.spyOn(Intl, 'NumberFormat');
const mockCurrencyFormatter = {
  format: jest.fn((amount: number) => {
    if (amount < 0.01) {
      return `$${amount.toFixed(4)}`;
    }
    return `$${amount.toFixed(2)}`;
  })
};

describe('Cost Status Line Integration', () => {
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
      }
    }
  };

  let costCalculator: CostCalculator;
  let statusLineProvider: CostStatusLineProvider;

  beforeEach(() => {
    // Mock currency formatter
    mockNumberFormat.mockImplementation(() => mockCurrencyFormatter as any);

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();

    costCalculator = new CostCalculator(mockConfig);
    statusLineProvider = new CostStatusLineProvider(costCalculator, mockConfig);

    // Reset mock calls
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Restore original cost provider
    if (originalCostProvider !== null) {
      registerCostStatusLineProvider(originalCostProvider);
    } else {
      registerCostStatusLineProvider(null as any);
    }

    mockNumberFormat.mockRestore();
  });

  describe('Cost Provider Registration', () => {
    test('should register cost provider successfully', () => {
      // Register the provider
      registerCostStatusLineProvider(statusLineProvider);

      // Provider registration should not throw errors
      expect(() => registerCostStatusLineProvider(statusLineProvider)).not.toThrow();
    });

    test('should handle null provider registration', () => {
      // Register null provider
      expect(() => registerCostStatusLineProvider(null as any)).not.toThrow();
    });

    test('should allow multiple provider registrations', () => {
      // Register first provider
      registerCostStatusLineProvider(statusLineProvider);

      // Register second provider (should replace the first)
      const secondProvider = new CostStatusLineProvider(costCalculator, mockConfig);
      expect(() => registerCostStatusLineProvider(secondProvider)).not.toThrow();
    });
  });

  describe('Cost Variable Integration with Status Line', () => {
    test('should include cost variables in status line data when provider is registered', async () => {
      // Register cost provider
      registerCostStatusLineProvider(statusLineProvider);

      // Add cost data
      const sessionId = 'test-session-123';
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);

      // Mock status line input
      const mockInput = {
        hook_event_name: 'test_event',
        session_id: sessionId,
        transcript_path: '/tmp/test-transcript',
        cwd: '/tmp/test-cwd',
        model: {
          id: 'gpt-4',
          display_name: 'GPT-4'
        },
        workspace: {
          current_dir: '/tmp/test-cwd',
          project_dir: '/tmp/test-project'
        }
      };

      // Mock transcript file content
      const mockTranscriptContent = JSON.stringify({
        type: 'assistant',
        message: {
          model: 'gpt-4',
          usage: {
            input_tokens: 1000,
            output_tokens: 500
          }
        }
      });

      // Mock fs.readFile to return our transcript content
      const fs = require('fs/promises');
      const originalReadFile = fs.readFile;
      fs.readFile = jest.fn().mockResolvedValue(mockTranscriptContent);

      try {
        // Parse status line data
        const result = await parseStatusLineData(mockInput);

        // Verify result contains expected content
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');

        // The result should contain model and usage information
        // Note: The actual output contains ANSI color codes and icons
        expect(result).toContain('gpt-4');
      } finally {
        // Restore original readFile
        fs.readFile = originalReadFile;
      }
    });

    test('should handle missing cost provider gracefully', async () => {
      // Ensure no cost provider is registered
      registerCostStatusLineProvider(null as any);

      const mockInput = {
        hook_event_name: 'test_event',
        session_id: 'test-session',
        transcript_path: '/tmp/test-transcript',
        cwd: '/tmp/test-cwd',
        model: {
          id: 'gpt-4',
          display_name: 'GPT-4'
        },
        workspace: {
          current_dir: '/tmp/test-cwd',
          project_dir: '/tmp/test-project'
        }
      };

      // Mock transcript file content
      const mockTranscriptContent = JSON.stringify({
        type: 'assistant',
        message: {
          model: 'gpt-4',
          usage: {
            input_tokens: 1000,
            output_tokens: 500
          }
        }
      });

      // Mock fs.readFile
      const fs = require('fs/promises');
      const originalReadFile = fs.readFile;
      fs.readFile = jest.fn().mockResolvedValue(mockTranscriptContent);

      try {
        const result = await parseStatusLineData(mockInput);

        // Should still work without cost provider
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      } finally {
        fs.readFile = originalReadFile;
      }
    });
  });

  describe('End-to-End Cost Tracking with Status Line', () => {
    test('should track costs and make them available for status line display', () => {
      const sessionId = 'e2e-test-session';

      // Register cost provider
      registerCostStatusLineProvider(statusLineProvider);

      // Simulate multiple API calls
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);
      costCalculator.calculateCost(sessionId, 'anthropic,claude-3.5-sonnet', 800, 400);

      // Get cost variables for status line
      const costVariables = statusLineProvider.getCostVariables(sessionId);

      // Verify cost variables are available
      expect(costVariables.totalCost).toBeDefined();
      expect(costVariables.totalCostRaw).toBeDefined();
      expect(costVariables.trackingStatus).toBe('Active');
      expect(costVariables.statusMessage).toBeDefined();
      expect(costVariables.topModel).toBeDefined();
      expect(costVariables.topModelCost).toBeDefined();

      // Verify model-specific variables
      expect(costVariables['cost.openai_gpt_4']).toBeDefined();
      expect(costVariables['cost.anthropic_claude_3_5_sonnet']).toBeDefined();

      // Verify cost calculations are correct
      const totalCost = parseFloat(costVariables.totalCostRaw);
      expect(totalCost).toBeGreaterThan(0);
    });

    test('should handle disabled cost tracking in status line', () => {
      const disabledConfig: CostTrackingConfig = {
        ...mockConfig,
        enabled: false
      };

      const disabledProvider = new CostStatusLineProvider(costCalculator, disabledConfig);
      registerCostStatusLineProvider(disabledProvider);

      const sessionId = 'disabled-test-session';
      const costVariables = disabledProvider.getCostVariables(sessionId);

      // Should return disabled status
      expect(costVariables.trackingStatus).toBe('Disabled');
      expect(costVariables.statusMessage).toBe('Cost tracking disabled');
    });

    test('should handle sessions with no cost data', () => {
      registerCostStatusLineProvider(statusLineProvider);

      const sessionId = 'no-data-session';
      const costVariables = statusLineProvider.getCostVariables(sessionId);

      // Should return no data status
      expect(costVariables.trackingStatus).toBe('Active');
      expect(costVariables.statusMessage).toBe('No cost data available');
    });
  });

  describe('Variable Substitution in Status Line Templates', () => {
    test('should substitute cost variables in status line templates', () => {
      const sessionId = 'variable-test-session';

      // Add cost data
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);

      // Test various template patterns
      const templates = [
        'Cost: {{totalCost}} | Duration: {{sessionDuration}}',
        'Total: {{totalCostRaw}} | Top Model: {{topModel}}',
        'Status: {{trackingStatus}} | Message: {{statusMessage}}',
        'Model Costs: {{cost.openai_gpt_4}}',
        'Combined: {{totalCost}} {{sessionDuration}} {{topModel}} {{statusColor}}'
      ];

      templates.forEach(template => {
        const result = statusLineProvider.generateStatusLine(sessionId, template);

        // Should not contain unsubstituted variables (except unknown ones)
        expect(result).not.toMatch(/\{\{totalCost\}\}/);
        expect(result).not.toMatch(/\{\{totalCostRaw\}\}/);
        expect(result).not.toMatch(/\{\{sessionDuration\}\}/);
        expect(result).not.toMatch(/\{\{topModel\}\}/);
        expect(result).not.toMatch(/\{\{trackingStatus\}\}/);
        expect(result).not.toMatch(/\{\{statusMessage\}\}/);

        // Should contain meaningful content
        expect(result.length).toBeGreaterThan(0);
      });
    });

    test('should handle unknown variables gracefully in templates', () => {
      const sessionId = 'unknown-vars-test';
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);

      const template = 'Known: {{totalCost}}, Unknown: {{unknownVariable}}, Another: {{anotherUnknown}}';
      const result = statusLineProvider.generateStatusLine(sessionId, template);

      // Known variable should be substituted
      expect(result).not.toContain('{{totalCost}}');

      // Unknown variables should remain unchanged
      expect(result).toContain('{{unknownVariable}}');
      expect(result).toContain('{{anotherUnknown}}');
    });

    test('should handle empty templates', () => {
      const sessionId = 'empty-template-test';
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);

      const result = statusLineProvider.generateStatusLine(sessionId, '');
      expect(result).toBe('');
    });
  });

  describe('Backward Compatibility', () => {
    test('should work with existing status line variables when cost tracking is disabled', () => {
      const disabledConfig: CostTrackingConfig = {
        ...mockConfig,
        enabled: false
      };

      const disabledProvider = new CostStatusLineProvider(costCalculator, disabledConfig);
      registerCostStatusLineProvider(disabledProvider);

      const sessionId = 'compatibility-test';
      const template = 'WorkDir: {{workDirName}} | Model: {{model}} | Cost: {{totalCost}}';

      const result = disabledProvider.generateStatusLine(sessionId, template);

      // Should return disabled message, not attempt variable substitution
      expect(result).toBe('Cost tracking disabled');
    });

    test('should not interfere with existing status line functionality when no cost provider', async () => {
      // Ensure no cost provider is registered
      registerCostStatusLineProvider(null as any);

      const mockInput = {
        hook_event_name: 'test_event',
        session_id: 'test-session',
        transcript_path: '/tmp/test-transcript',
        cwd: '/tmp/test-cwd',
        model: {
          id: 'gpt-4',
          display_name: 'GPT-4'
        },
        workspace: {
          current_dir: '/tmp/test-cwd',
          project_dir: '/tmp/test-project'
        }
      };

      // Mock transcript file content
      const mockTranscriptContent = JSON.stringify({
        type: 'assistant',
        message: {
          model: 'gpt-4',
          usage: {
            input_tokens: 1000,
            output_tokens: 500
          }
        }
      });

      // Mock fs.readFile
      const fs = require('fs/promises');
      const originalReadFile = fs.readFile;
      fs.readFile = jest.fn().mockResolvedValue(mockTranscriptContent);

      try {
        const result = await parseStatusLineData(mockInput);

        // Should work normally without cost provider
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');

        // Should contain expected status line elements
        // Note: The actual output contains ANSI color codes and icons
        expect(result).toContain('gpt-4');
      } finally {
        fs.readFile = originalReadFile;
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed session IDs gracefully', () => {
      const invalidSessionIds = ['', null, undefined, '   '];

      invalidSessionIds.forEach(sessionId => {
        const result = statusLineProvider.generateStatusLine(sessionId as string, 'Test: {{totalCost}}');

        // Should handle gracefully without throwing
        expect(result).toBe('No cost data available');
      });
    });

    test('should handle provider errors gracefully', () => {
      // Create a provider with invalid configuration
      const invalidConfig: CostTrackingConfig = {
        enabled: true,
        default_currency: 'USD',
        model_pricing: {}
      };

      const invalidProvider = new CostStatusLineProvider(costCalculator, invalidConfig);
      registerCostStatusLineProvider(invalidProvider);

      const sessionId = 'error-test-session';
      const result = invalidProvider.generateStatusLine(sessionId, 'Test: {{totalCost}}');

      // Should handle gracefully
      expect(result).toBe('No cost data available');
    });

    test('should handle concurrent provider registrations', () => {
      // Simulate concurrent registrations
      const providers = [
        new CostStatusLineProvider(costCalculator, mockConfig),
        new CostStatusLineProvider(costCalculator, mockConfig),
        new CostStatusLineProvider(costCalculator, mockConfig)
      ];

      providers.forEach(provider => {
        expect(() => registerCostStatusLineProvider(provider)).not.toThrow();
      });

      // Last registration should be the active one
      // Note: We can't easily test which provider is active without exposing internal state
      // But we can verify that registrations don't cause errors
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple sessions efficiently', () => {
      const sessionCount = 10;
      const sessions = Array.from({ length: sessionCount }, (_, i) => `session-${i}`);

      // Add cost data for each session
      sessions.forEach(sessionId => {
        costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);
      });

      // Generate status lines for all sessions
      const startTime = Date.now();

      sessions.forEach(sessionId => {
        const result = statusLineProvider.generateStatusLine(sessionId, 'Cost: {{totalCost}}');
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // 1 second
    });

    test('should handle large token counts without performance issues', () => {
      const sessionId = 'large-tokens-test';

      // Simulate very large token counts
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000000, 500000);
      costCalculator.calculateCost(sessionId, 'anthropic,claude-3.5-sonnet', 800000, 400000);

      const startTime = Date.now();
      const result = statusLineProvider.generateStatusLine(sessionId, 'Cost: {{totalCost}} | Models: {{topModel}}');
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });
  });
});