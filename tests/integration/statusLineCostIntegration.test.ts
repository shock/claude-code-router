/**
 * End-to-End Integration Tests for Status Line Cost Display
 *
 * This test suite verifies the complete integration flow from cost calculation
 * through status line display, including variable substitution, formatting,
 * and real-world usage scenarios.
 */

import { CostCalculator } from '../../src/utils/costCalculator';
import { CostStatusLineProvider } from '../../src/utils/costStatusLineProvider';
import {
  registerCostStatusLineProvider,
  parseStatusLineData,
  formatCostValue,
  renderCostModuleText,
  renderDefaultStyle,
  renderPowerlineStyle,
  CostModule,
  StatusLineThemeConfig
} from '../../src/utils/statusline';
import { CostTrackingConfig } from '../../src/types/cost';

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

describe('End-to-End Status Line Cost Integration', () => {
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
      },
      'google,gemini-pro': {
        input_cost_per_million: 1.50,
        output_cost_per_million: 6.00
      },
      'deepseek,deepseek-chat': {
        input_cost_per_million: 0.14,
        output_cost_per_million: 0.28
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

    // Unregister cost provider
    registerCostStatusLineProvider(null as any);

    mockNumberFormat.mockRestore();
  });

  describe('Complete Integration Flow', () => {
    test('should process complete flow from cost calculation to status line display', async () => {
      const sessionId = 'complete-flow-test';

      // Step 1: Register cost provider
      registerCostStatusLineProvider(statusLineProvider);

      // Step 2: Simulate multiple API calls with different models
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1500, 800);
      costCalculator.calculateCost(sessionId, 'anthropic,claude-3.5-sonnet', 1200, 600);
      costCalculator.calculateCost(sessionId, 'google,gemini-pro', 2000, 1000);

      // Step 3: Get cost variables for status line
      const costVariables = statusLineProvider.getCostVariables(sessionId);

      // Step 4: Verify cost variables are populated correctly
      expect(costVariables.totalCost).toBeDefined();
      expect(costVariables.totalCostRaw).toBeDefined();
      expect(costVariables.trackingStatus).toBe('Active');
      expect(costVariables.topModel).toBeDefined();
      expect(costVariables.topModelCost).toBeDefined();

      // Step 5: Test variable substitution in status line templates
      const templates = [
        'Cost: {{totalCost}} | Duration: {{sessionDuration}}',
        'Total: {{totalCostRaw}} | Top Model: {{topModel}}',
        'Status: {{trackingStatus}} | Message: {{statusMessage}}',
        'Models: {{cost.openai_gpt_4}} {{cost.anthropic_claude_3_5_sonnet}} {{cost.google_gemini_pro}}'
      ];

      templates.forEach(template => {
        const result = statusLineProvider.generateStatusLine(sessionId, template);
        expect(result).not.toMatch(/\{\{totalCost\}\}/);
        expect(result).not.toMatch(/\{\{totalCostRaw\}\}/);
        expect(result).not.toMatch(/\{\{sessionDuration\}\}/);
        expect(result).not.toMatch(/\{\{topModel\}\}/);
        expect(result).not.toMatch(/\{\{trackingStatus\}\}/);
        expect(result).not.toMatch(/\{\{statusMessage\}\}/);
      });

      // Step 6: Test cost module rendering
      const costModule: CostModule = {
        type: 'cost',
        text: '{{totalCost}}',
        icon: '💰',
        precision: 4,
        format: 'currency'
      };

      const renderedCost = renderCostModuleText(costModule, costVariables);
      // The mock formatter uses 2 decimal places for amounts >= 0.01
      expect(renderedCost).toMatch(/\$\d+\.\d{2}/);
    });

    test('should handle real status line configuration with cost module', async () => {
      const sessionId = 'real-config-test';
      registerCostStatusLineProvider(statusLineProvider);

      // Add realistic cost data
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 2500, 1200);
      costCalculator.calculateCost(sessionId, 'deepseek,deepseek-chat', 5000, 2000);

      // Real-world status line configuration with cost module
      const theme: StatusLineThemeConfig = {
        modules: [
          {
            type: 'workDir',
            icon: '📁',
            text: '{{workDirName}}',
            color: 'bright_blue'
          },
          {
            type: 'gitBranch',
            icon: '🌿',
            text: '{{gitBranch}}',
            color: 'bright_magenta'
          },
          {
            type: 'model',
            icon: '🤖',
            text: '{{model}}',
            color: 'bright_cyan'
          },
          {
            type: 'cost',
            icon: '💰',
            text: '{{totalCost}}',
            color: 'bright_green',
            precision: 2,
            format: 'currency'
          } as CostModule
        ]
      };

      const costVariables = statusLineProvider.getCostVariables(sessionId);
      const variables = {
        workDirName: 'test-project',
        gitBranch: 'main',
        model: 'gpt-4',
        ...costVariables
      };

      // Test both default and Powerline styles
      const defaultResult = await renderDefaultStyle(theme, variables);
      const powerlineResult = await renderPowerlineStyle(theme, variables);

      expect(defaultResult).toContain('📁 test-project');
      expect(defaultResult).toContain('🌿 main');
      expect(defaultResult).toContain('🤖 gpt-4');
      expect(defaultResult).toContain('💰');

      expect(powerlineResult).toContain('test-project');
      expect(powerlineResult).toContain('main');
      expect(powerlineResult).toContain('gpt-4');
      expect(powerlineResult).toContain('💰');
    });
  });

  describe('Variable Substitution in Real Configurations', () => {
    test('should substitute cost variables in complex status line templates', () => {
      const sessionId = 'variable-substitution-test';
      registerCostStatusLineProvider(statusLineProvider);

      // Add diverse cost data
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1800, 900);
      costCalculator.calculateCost(sessionId, 'anthropic,claude-3.5-sonnet', 2200, 1100);

      const costVariables = statusLineProvider.getCostVariables(sessionId);

      // Complex templates with mixed variables
      const complexTemplates = [
        '💸 {{totalCost}} | ⏱️ {{sessionDuration}} | 🏆 {{topModel}}',
        '📊 Cost: {{totalCost}} ({{topModel}}: {{topModelCost}}) | 🔄 {{trackingStatus}}',
        '💰 Total: {{totalCostRaw}} | 📈 Status: {{statusMessage}} | 🎨 {{statusColor}}',
        '🤖 Models: GPT-4: {{cost.openai_gpt_4}} | Claude: {{cost.anthropic_claude_3_5_sonnet}}'
      ];

      complexTemplates.forEach(template => {
        const result = statusLineProvider.generateStatusLine(sessionId, template);

        // Verify all known variables are substituted
        expect(result).not.toContain('{{totalCost}}');
        expect(result).not.toContain('{{totalCostRaw}}');
        expect(result).not.toContain('{{sessionDuration}}');
        expect(result).not.toContain('{{topModel}}');
        expect(result).not.toContain('{{topModelCost}}');
        expect(result).not.toContain('{{trackingStatus}}');
        expect(result).not.toContain('{{statusMessage}}');
        expect(result).not.toContain('{{statusColor}}');

        // Verify model-specific variables are substituted
        expect(result).not.toContain('{{cost.openai_gpt_4}}');
        expect(result).not.toContain('{{cost.anthropic_claude_3_5_sonnet}}');
      });
    });

    test('should handle model-specific cost variables correctly', () => {
      const sessionId = 'model-variables-test';
      registerCostStatusLineProvider(statusLineProvider);

      // Add cost data for multiple models
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);
      costCalculator.calculateCost(sessionId, 'anthropic,claude-3.5-sonnet', 800, 400);
      costCalculator.calculateCost(sessionId, 'google,gemini-pro', 1200, 600);

      const costVariables = statusLineProvider.getCostVariables(sessionId);

      // Verify all model-specific variables are generated
      expect(costVariables['cost.openai_gpt_4']).toBeDefined();
      expect(costVariables['cost.anthropic_claude_3_5_sonnet']).toBeDefined();
      expect(costVariables['cost.google_gemini_pro']).toBeDefined();

      // Test template with multiple model variables
      const template = 'GPT-4: {{cost.openai_gpt_4}} | Claude: {{cost.anthropic_claude_3_5_sonnet}} | Gemini: {{cost.google_gemini_pro}}';
      const result = statusLineProvider.generateStatusLine(sessionId, template);

      expect(result).not.toContain('{{cost.openai_gpt_4}}');
      expect(result).not.toContain('{{cost.anthropic_claude_3_5_sonnet}}');
      expect(result).not.toContain('{{cost.google_gemini_pro}}');
      expect(result).toContain('GPT-4:');
      expect(result).toContain('Claude:');
      expect(result).toContain('Gemini:');
    });
  });

  describe('Multiple Cost Modules Integration', () => {
    test('should handle multiple cost modules in single status line', async () => {
      const sessionId = 'multiple-modules-test';
      registerCostStatusLineProvider(statusLineProvider);

      // Add cost data
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1500, 750);
      costCalculator.calculateCost(sessionId, 'anthropic,claude-3.5-sonnet', 1000, 500);

      const costVariables = statusLineProvider.getCostVariables(sessionId);

      // Theme with multiple cost modules
      const theme: StatusLineThemeConfig = {
        modules: [
          {
            type: 'workDir',
            icon: '📁',
            text: '{{workDirName}}',
            color: 'bright_blue'
          },
          {
            type: 'cost',
            icon: '💰',
            text: 'Total: {{totalCost}}',
            color: 'bright_green',
            precision: 2,
            format: 'currency'
          } as CostModule,
          {
            type: 'cost',
            icon: '📊',
            text: 'Top: {{topModel}}',
            color: 'bright_yellow'
          } as CostModule,
          {
            type: 'cost',
            icon: '⏱️',
            text: '{{sessionDuration}}',
            color: 'bright_cyan'
          } as CostModule
        ]
      };

      const variables = {
        workDirName: 'multi-module-project',
        ...costVariables
      };

      const result = await renderDefaultStyle(theme, variables);

      // Verify all modules are rendered
      expect(result).toContain('📁 multi-module-project');
      expect(result).toContain('💰');
      expect(result).toContain('📊');
      expect(result).toContain('⏱️');
      expect(result).toContain('Total:');
      expect(result).toContain('Top:');
    });

    test('should handle cost modules with different formatting options', async () => {
      const sessionId = 'formatting-test';
      registerCostStatusLineProvider(statusLineProvider);

      // Add cost data with small amounts to test precision
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 100, 50);

      const costVariables = statusLineProvider.getCostVariables(sessionId);

      const theme: StatusLineThemeConfig = {
        modules: [
          {
            type: 'cost',
            icon: '💰',
            text: 'Currency: {{totalCost}}',
            precision: 4,
            format: 'currency'
          } as CostModule,
          {
            type: 'cost',
            icon: '📊',
            text: 'Decimal: {{totalCostRaw}}',
            precision: 6,
            format: 'decimal'
          } as CostModule,
          {
            type: 'cost',
            icon: '🔬',
            text: 'Scientific: {{totalCostRaw}}',
            precision: 2,
            format: 'scientific'
          } as CostModule,
          {
            type: 'cost',
            icon: '📈',
            text: 'Compact: {{totalCostRaw}}',
            precision: 3,
            format: 'compact'
          } as CostModule
        ]
      };

      const result = await renderDefaultStyle(theme, costVariables);

      // Verify different formatting is applied
      expect(result).toContain('Currency:');
      expect(result).toContain('Decimal:');
      expect(result).toContain('Scientific:');
      expect(result).toContain('Compact:');
    });
  });

  describe('Session-Based Cost Tracking Integration', () => {
    test('should maintain cost tracking across multiple sessions', () => {
      const sessions = ['session-1', 'session-2', 'session-3'];
      registerCostStatusLineProvider(statusLineProvider);

      // Add cost data for each session
      sessions.forEach((sessionId, index) => {
        costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000 + index * 500, 500 + index * 250);
      });

      // Verify each session has independent cost tracking
      sessions.forEach((sessionId, index) => {
        const costVariables = statusLineProvider.getCostVariables(sessionId);
        expect(costVariables.trackingStatus).toBe('Active');
        expect(costVariables.totalCost).toBeDefined();
        expect(costVariables.sessionDuration).toBeDefined();
      });

      // Verify sessions don't interfere with each other
      const session1Vars = statusLineProvider.getCostVariables(sessions[0]);
      const session2Vars = statusLineProvider.getCostVariables(sessions[1]);
      const session3Vars = statusLineProvider.getCostVariables(sessions[2]);

      expect(session1Vars.totalCostRaw).not.toBe(session2Vars.totalCostRaw);
      expect(session2Vars.totalCostRaw).not.toBe(session3Vars.totalCostRaw);
    });

    test('should handle session reset and cost tracking continuity', () => {
      const sessionId = 'reset-test';
      registerCostStatusLineProvider(statusLineProvider);

      // Add initial cost data
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);
      const initialVariables = statusLineProvider.getCostVariables(sessionId);

      // Reset session
      costCalculator.resetSession(sessionId);

      // Add new cost data after reset
      costCalculator.calculateCost(sessionId, 'anthropic,claude-3.5-sonnet', 800, 400);
      const resetVariables = statusLineProvider.getCostVariables(sessionId);

      // Verify cost tracking continues with new data
      expect(resetVariables.trackingStatus).toBe('Active');
      expect(resetVariables.totalCost).toBeDefined();
      expect(resetVariables.topModel).toBe('anthropic,claude-3.5-sonnet');

      // Note: Session duration might be the same if tests run quickly
      // We can't reliably test duration difference in unit tests
      expect(resetVariables.sessionDuration).toBeDefined();
    });
  });

  describe('Configuration Validation Integration', () => {
    test('should handle disabled cost tracking in status line', () => {
      const disabledConfig: CostTrackingConfig = {
        ...mockConfig,
        enabled: false
      };

      const disabledCalculator = new CostCalculator(disabledConfig);
      const disabledProvider = new CostStatusLineProvider(disabledCalculator, disabledConfig);
      registerCostStatusLineProvider(disabledProvider);

      const sessionId = 'disabled-test';
      const template = 'Cost: {{totalCost}} | Duration: {{sessionDuration}}';

      const result = disabledProvider.generateStatusLine(sessionId, template);

      // Should return disabled message
      expect(result).toBe('Cost tracking disabled');

      // Even with cost data, should still show disabled
      disabledCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);
      const resultWithData = disabledProvider.generateStatusLine(sessionId, template);
      expect(resultWithData).toBe('Cost tracking disabled');
    });

    test('should handle missing model pricing configuration', () => {
      const partialConfig: CostTrackingConfig = {
        enabled: true,
        default_currency: 'USD',
        model_pricing: {
          // Only configure some models
          'openai,gpt-4': {
            input_cost_per_million: 2.50,
            output_cost_per_million: 10.00
          }
        }
      };

      const partialCalculator = new CostCalculator(partialConfig);
      const partialProvider = new CostStatusLineProvider(partialCalculator, partialConfig);
      registerCostStatusLineProvider(partialProvider);

      const sessionId = 'partial-config-test';

      // Add cost for configured model
      partialCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);

      // Add cost for unconfigured model (should return 0 cost)
      partialCalculator.calculateCost(sessionId, 'unknown-model', 1000, 500);

      const costVariables = partialProvider.getCostVariables(sessionId);

      // Should still track configured model
      expect(costVariables.trackingStatus).toBe('Active');
      expect(costVariables.totalCost).toBeDefined();
      expect(costVariables['cost.openai_gpt_4']).toBeDefined();
    });
  });

  describe('Backward Compatibility with Existing Status Line', () => {
    test('should work with existing status line variables when cost tracking is disabled', async () => {
      const disabledConfig: CostTrackingConfig = {
        ...mockConfig,
        enabled: false
      };

      const disabledCalculator = new CostCalculator(disabledConfig);
      const disabledProvider = new CostStatusLineProvider(disabledCalculator, disabledConfig);
      registerCostStatusLineProvider(disabledProvider);

      const sessionId = 'compatibility-test';

      // Test with existing status line configuration
      const theme: StatusLineThemeConfig = {
        modules: [
          {
            type: 'workDir',
            icon: '📁',
            text: '{{workDirName}}',
            color: 'bright_blue'
          },
          {
            type: 'gitBranch',
            icon: '🌿',
            text: '{{gitBranch}}',
            color: 'bright_magenta'
          },
          {
            type: 'model',
            icon: '🤖',
            text: '{{model}}',
            color: 'bright_cyan'
          },
          {
            type: 'cost',
            icon: '💰',
            text: '{{totalCost}}',
            color: 'bright_green'
          }
        ]
      };

      const variables = {
        workDirName: 'compat-project',
        gitBranch: 'feature-branch',
        model: 'claude-3.5-sonnet'
      };

      const result = await renderDefaultStyle(theme, variables);

      // Should render existing modules normally
      expect(result).toContain('📁 compat-project');
      expect(result).toContain('🌿 feature-branch');
      expect(result).toContain('🤖 claude-3.5-sonnet');

      // Cost module should show no cost data when disabled
      expect(result).toContain('unknown');
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
        expect(result).toContain('gpt-4');
        expect(result).toContain('1000');
        expect(result).toContain('500');
      } finally {
        fs.readFile = originalReadFile;
      }
    });
  });

  describe('Real-World Cost Scenarios', () => {
    test('should handle realistic token usage patterns', () => {
      const sessionId = 'realistic-usage-test';
      registerCostStatusLineProvider(statusLineProvider);

      // Simulate realistic conversation with multiple models
      const conversationPatterns = [
        { model: 'openai,gpt-4', input: 1200, output: 800 }, // Initial query
        { model: 'anthropic,claude-3.5-sonnet', input: 1500, output: 1000 }, // Follow-up
        { model: 'openai,gpt-4', input: 800, output: 600 }, // Clarification
        { model: 'google,gemini-pro', input: 2000, output: 1200 }, // Detailed response
        { model: 'deepseek,deepseek-chat', input: 3000, output: 1500 } // Final summary
      ];

      conversationPatterns.forEach(pattern => {
        costCalculator.calculateCost(sessionId, pattern.model, pattern.input, pattern.output);
      });

      const costVariables = statusLineProvider.getCostVariables(sessionId);

      // Verify realistic cost tracking
      expect(costVariables.trackingStatus).toBe('Active');
      expect(costVariables.totalCost).toBeDefined();
      expect(costVariables.topModel).toBeDefined();
      expect(costVariables.statusMessage).toMatch(/\d+ models used/);

      // Verify all model-specific variables are available
      conversationPatterns.forEach(pattern => {
        const normalizedModel = pattern.model.replace(/[^\w]/g, '_');
        expect(costVariables[`cost.${normalizedModel}`]).toBeDefined();
      });
    });

    test('should handle edge cases with very small and large costs', () => {
      const sessionId = 'edge-case-costs-test';
      registerCostStatusLineProvider(statusLineProvider);

      // Very small cost (cheap model)
      costCalculator.calculateCost(sessionId, 'deepseek,deepseek-chat', 100, 50);

      // Moderate cost
      costCalculator.calculateCost(sessionId, 'google,gemini-pro', 5000, 2500);

      // Large cost (expensive model)
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 10000, 5000);

      const costVariables = statusLineProvider.getCostVariables(sessionId);

      // Should handle all cost ranges
      expect(costVariables.trackingStatus).toBe('Active');
      expect(costVariables.totalCost).toBeDefined();
      expect(costVariables.statusColor).toBeDefined();

      // Top model should be the most expensive one
      expect(costVariables.topModel).toBe('openai,gpt-4');
    });
  });

  describe('Performance and Scalability Integration', () => {
    test('should handle multiple concurrent sessions efficiently', () => {
      const sessionCount = 20;
      const sessions = Array.from({ length: sessionCount }, (_, i) => `session-${i}`);
      registerCostStatusLineProvider(statusLineProvider);

      const startTime = Date.now();

      // Add cost data for each session
      sessions.forEach((sessionId, index) => {
        costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000 + index * 100, 500 + index * 50);
      });

      // Generate status lines for all sessions
      sessions.forEach(sessionId => {
        const result = statusLineProvider.generateStatusLine(sessionId, 'Cost: {{totalCost}} | Duration: {{sessionDuration}}');
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(500); // 500ms for 20 sessions
    });

    test('should handle large token counts without performance degradation', () => {
      const sessionId = 'large-tokens-performance-test';
      registerCostStatusLineProvider(statusLineProvider);

      // Simulate very large token counts
      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000000, 500000);
      costCalculator.calculateCost(sessionId, 'anthropic,claude-3.5-sonnet', 800000, 400000);

      const startTime = Date.now();

      // Generate multiple status lines
      for (let i = 0; i < 10; i++) {
        const result = statusLineProvider.generateStatusLine(sessionId, 'Cost: {{totalCost}} | Models: {{topModel}}');
        expect(result).toBeDefined();
      }

      const endTime = Date.now();

      // Should complete quickly even with large numbers
      expect(endTime - startTime).toBeLessThan(100); // 100ms for 10 generations
    });
  });

  describe('Error Handling and Graceful Degradation', () => {
    test('should handle malformed session IDs gracefully', () => {
      registerCostStatusLineProvider(statusLineProvider);

      const invalidSessionIds = ['', null, undefined, '   '];

      invalidSessionIds.forEach(sessionId => {
        const result = statusLineProvider.generateStatusLine(sessionId as string, 'Test: {{totalCost}}');
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

      const invalidCalculator = new CostCalculator(invalidConfig);
      const invalidProvider = new CostStatusLineProvider(invalidCalculator, invalidConfig);
      registerCostStatusLineProvider(invalidProvider);

      const sessionId = 'error-test-session';
      const result = invalidProvider.generateStatusLine(sessionId, 'Test: {{totalCost}}');

      // Should handle gracefully
      expect(result).toBe('No cost data available');
    });

    test('should handle malformed templates gracefully', () => {
      const sessionId = 'malformed-template-test';
      registerCostStatusLineProvider(statusLineProvider);

      costCalculator.calculateCost(sessionId, 'openai,gpt-4', 1000, 500);

      const malformedTemplates = [
        'Cost: {{totalCost} | Unclosed: {{sessionDuration',
        '{{totalCost}} {{',
        '}} {{totalCost}}',
        '{{{{totalCost}}}}'
      ];

      malformedTemplates.forEach(template => {
        const result = statusLineProvider.generateStatusLine(sessionId, template);
        // Should not throw error, should handle malformed template gracefully
        expect(typeof result).toBe('string');
      });
    });
  });
});