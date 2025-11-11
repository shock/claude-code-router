/**
 * Cost Calculator service for Claude Code Router
 *
 * This module provides comprehensive cost calculation functionality
 * for tracking LLM API usage costs across different models and sessions.
 */

import { LRUCache } from './cache';
import { CostTrackingConfig, SessionCostData, ModelCostBreakdown } from '../types/cost';

/**
 * Cost Calculator service for tracking and calculating LLM API costs
 */
export class CostCalculator {
  private config: CostTrackingConfig;
  private costCache: LRUCache<string, SessionCostData>;
  private calculationCache: Map<string, number>;

  /**
   * Creates a new CostCalculator instance
   * @param config Cost tracking configuration
   */
  constructor(config: CostTrackingConfig) {
    this.config = config;
    // Use same capacity as sessionUsageCache for consistency (100 entries)
    this.costCache = new LRUCache<string, SessionCostData>(100);
    // Cache for cost calculations to avoid redundant computations
    this.calculationCache = new Map<string, number>();
  }

  /**
   * Calculates the cost for a given token usage
   * @param sessionId Unique session identifier
   * @param model Model name in format "<provider>,<model>"
   * @param inputTokens Number of input tokens used
   * @param outputTokens Number of output tokens used
   * @returns Calculated cost in the configured currency
   */
  calculateCost(
    sessionId: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing = this.config.model_pricing[model];
    if (!pricing) {
      // Return 0 cost for unconfigured models (no runtime warnings)
      return 0;
    }

    // Check calculation cache first
    const cacheKey = `${sessionId}:${model}:${inputTokens}:${outputTokens}`;
    const cachedCost = this.calculationCache.get(cacheKey);
    if (cachedCost !== undefined) {
      return cachedCost;
    }

    const inputCost = (inputTokens * pricing.input_tokens_per_million) / 1000000;
    const outputCost = (outputTokens * pricing.output_tokens_per_million) / 1000000;
    const totalCost = inputCost + outputCost;

    // Cache the calculation
    this.calculationCache.set(cacheKey, totalCost);

    // Limit calculation cache size to prevent memory leaks
    if (this.calculationCache.size > 1000) {
      const firstKey = this.calculationCache.keys().next().value;
      if (firstKey) {
        this.calculationCache.delete(firstKey);
      }
    }

    this.updateSessionCost(sessionId, model, inputTokens, outputTokens, totalCost);
    return totalCost;
  }

  /**
   * Updates session cost data with new token usage
   * @param sessionId Unique session identifier
   * @param model Model name in format "<provider>,<model>"
   * @param inputTokens Number of input tokens used
   * @param outputTokens Number of output tokens used
   * @param cost Calculated cost for this usage
   */
  private updateSessionCost(
    sessionId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    cost: number
  ): void {
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
      modelCost.inputCost = (modelCost.inputTokens * pricing.input_tokens_per_million) / 1000000;
      modelCost.outputCost = (modelCost.outputTokens * pricing.output_tokens_per_million) / 1000000;
      modelCost.totalCost = modelCost.inputCost + modelCost.outputCost;
    }

    // Update total session cost
    sessionCost.totalCost += cost;

    // Store in cache using same session ID as sessionUsageCache
    this.costCache.put(sessionId, sessionCost);
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
   * Clears the calculation cache to free memory
   */
  clearCalculationCache(): void {
    this.calculationCache.clear();
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