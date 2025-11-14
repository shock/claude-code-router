/**
 * Cost Tracking Functions for Claude Code Router
 *
 * Extracted from src/index.ts to provide clean separation of cost tracking logic
 * while keeping complex stream processing logic in the main file.
 */

import { CostCalculator } from './costCalculator';
import { CostStatusLineProvider } from './costStatusLineProvider';
import { registerCostStatusLineProvider } from './statusline';
import { LRUCache, sessionUsageCache, Usage } from './cache';

export class CostTracker {
  costTrackingEnabled: boolean = false;
  costCalculator: CostCalculator;

  constructor(config: any) {

    this.costCalculator = initializeCostCalculator(config)!;
    if (this.costCalculator) {
      this.costTrackingEnabled = true;
    }
  }

  updateSessionCost(req: any, usage: Usage): void {
    if (!this.costTrackingEnabled) return;
    const model = req.body?.model;
    // Asynchronous cost calculation - don't await to avoid blocking
    if (req.sessionId && model) {
      const { input_tokens, output_tokens } = usage;
      process.nextTick(() => {
        try {
          this.costCalculator.updateSessionCost(
            req.sessionId,
            model,
            input_tokens || 0,
            output_tokens || 0
          );
        } catch (error) {
          // Log error but don't fail the request
          console.error('Cost calculation error:', error);
        }
      });
    } else {
      // log specific reason why the logic is skipped
      const failedReasons: string[] = [];
      if (!req.sessionId) failedReasons.push('sessionId not found in request');
      if (!req.body?.model) failedReasons.push('Model not specified in request body');

      console.log('Cost calculation skipped for URL:', req.url);
      console.log('Reasons:', failedReasons.join(', '));
    }
  }


}

/**
 * Initializes cost calculator if enabled in configuration
 * @param config Application configuration
 * @returns CostCalculator instance or null if disabled/failed
 */
export function initializeCostCalculator(config: any): CostCalculator | null {
  if (!config.CostTracking?.enabled) {
    console.log("ℹ️  Cost tracking is disabled.");
    return null;
  }

  try {
    const costCalculator = new CostCalculator(config.CostTracking);
    console.log("✅ Cost tracking enabled and initialized successfully.");

    // Register cost status line provider for status line integration
    const costStatusLineProvider = new CostStatusLineProvider(costCalculator, config.CostTracking);
    registerCostStatusLineProvider(costStatusLineProvider);
    console.log("✅ Cost status line provider registered successfully.");

    return costCalculator;
  } catch (error) {
    console.error("❌ Failed to initialize cost calculator:", error);
    console.warn("⚠️  Cost tracking will be disabled for this session.");

    return null;
  }
}
