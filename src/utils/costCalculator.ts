/**
 * Cost Calculator service for Claude Code Router
 *
 * This module provides comprehensive cost calculation functionality
 * for tracking LLM API usage costs across different models and sessions.
 */

import { LRUCache } from './cache';
import { CostTrackingConfig, SessionCostData } from '../types/cost';

/**
 * Cost Calculator service for tracking and calculating LLM API costs
 */
export class CostCalculator {
  private config: CostTrackingConfig;
  private costCache: LRUCache<string, SessionCostData>;

  /**
   * Creates a new CostCalculator instance
   * @param config Cost tracking configuration
   */
  constructor(config: CostTrackingConfig) {
    this.config = config;
    // Use same capacity as sessionUsageCache for consistency (100 entries)
    this.costCache = new LRUCache<string, SessionCostData>(100);
  }

  /**
   * Calculates the cost for a given token usage
   * @param sessionId Unique session identifier
   * @param model Model name
   * @param inputTokens Number of input tokens used
   * @param outputTokens Number of output tokens used
   * @returns Calculated cost in the configured currency
   */
  calculateCost(
    sessionId: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): void {
    const pricing = this.config.model_pricing[model];
    if (!pricing) {
      // console.warn(`No pricing information found for model: ${model}`);
      return;
    }

    this.updateSessionCost(sessionId, model, inputTokens, outputTokens);
  }

  /**
   * Updates session cost data with new token usage
   * @param sessionId Unique session identifier
   * @param model Model name
   * @param inputTokens Number of input tokens used
   * @param outputTokens Number of output tokens used
   * @param cost Calculated cost for this usage
   */
  updateSessionCost(
    sessionId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): void {
    // console.log(`Updating cost for session ${sessionId}, model ${model}: ${inputTokens} input tokens, ${outputTokens} output tokens.`);
    // Get existing session cost or create new one
    let sessionCost = this.costCache.get(sessionId);
    if (!sessionCost) {
      sessionCost = {
        sessionId,
        startTime: new Date(),
        totalCost: 0,
        modelCosts: {},
        currency: this.config.default_currency || 'USD'
      };
    }

    // Update model-specific costs
    if (!sessionCost.modelCosts[model]) {
      sessionCost.modelCosts[model] = {
        inputTokens: 0,
        outputTokens: 0,
        inputCost: 0,
        outputCost: 0,
        totalCost: 0
      };
    }

    const modelCost = sessionCost.modelCosts[model];
    modelCost.inputTokens += inputTokens;
    modelCost.outputTokens += outputTokens;

    // Recalculate model costs to ensure accuracy
    const pricing = this.config.model_pricing[model];
    if (pricing) {
      const inputCost = (inputTokens * pricing.input_cost_per_million) / 1000000;
      // console.log(modelCost.inputTokens, pricing.input_cost_per_million);
      // console.log(`Calculated input cost for model ${model} : $${inputCost.toFixed(6)}`);
      const outputCost = (outputTokens * pricing.output_cost_per_million) / 1000000;
      // console.log(`Calculated output cost for model ${model} : $${outputCost.toFixed(6)}`);
      const totalCost = inputCost + outputCost;
      modelCost.inputCost += inputCost;
      modelCost.outputCost += outputCost;
      // console.log(`Calculated cost for model ${model} in session ${sessionId}: $${totalCost.toFixed(6)} added to $${modelCost.totalCost.toFixed(6)} total.`);
      modelCost.totalCost += totalCost;
      // Update total session cost
      sessionCost.totalCost += totalCost;
      // Store in cache using same session ID as sessionUsageCache
      this.costCache.put(sessionId, sessionCost);
    } else {
      console.warn(`Configuration missing for model: ${model}.  Cost not updated.`);
      console.warn(this.config.model_pricing);
    }
  }

  /**
   * Retrieves cost data for a specific session
   * @param sessionId Unique session identifier
   * @returns Session cost data or undefined if session not found
   */
  getSessionCost(sessionId: string): SessionCostData | undefined {
    return this.costCache.get(sessionId);
  }

  /**
   * Resets cost tracking for a specific session
   * @param sessionId Unique session identifier
   */
  resetSession(sessionId: string): void {
    this.costCache.put(sessionId, {
      sessionId,
      startTime: new Date(),
      totalCost: 0,
      modelCosts: {},
      currency: this.config.default_currency || 'USD'
    });
  }

  /**
   * Gets the current configuration
   * @returns Current cost tracking configuration
   */
  getConfig(): CostTrackingConfig {
    return this.config;
  }

  /**
   * Gets all active session IDs
   * @returns Array of active session IDs
   */
  getActiveSessionIds(): string[] {
    // Note: LRUCache doesn't expose keys directly, so we need to work around this
    // For now, return empty array as session management is handled by the router
    return [];
  }

  /**
   * Gets total cost across all sessions
   * @returns Total cost across all tracked sessions
   */
  getTotalCost(): number {
    // Note: LRUCache doesn't expose values directly, so we need to work around this
    // For now, return 0 as session management is handled by the router
    return 0;
  }
}