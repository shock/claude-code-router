/**
 * Enhanced Cost Status Line Provider for Claude Code Router
 *
 * This module provides comprehensive cost status line generation with
 * dynamic variable substitution for session cost tracking display.
 */

import { CostCalculator } from './costCalculator';
import { SessionCostData, CostTrackingConfig } from '../types/cost';

/**
 * Status line provider for cost tracking display
 */
export class CostStatusLineProvider {
  private calculator: CostCalculator;
  private config: CostTrackingConfig;

  /**
   * Creates a new CostStatusLineProvider instance
   * @param calculator Cost calculator instance
   * @param config Cost tracking configuration
   */
  constructor(calculator: CostCalculator, config: CostTrackingConfig) {
    this.calculator = calculator;
    this.config = config;
  }

  /**
   * Generates a status line with cost information
   * @param sessionId Session identifier
   * @param template Template string with variable placeholders
   * @returns Formatted status line or empty string if disabled
   */
  generateStatusLine(sessionId: string, template: string): string {
    if (!this.config.enabled) {
      return this.getDisabledMessage();
    }

    const sessionCost = this.calculator.getSessionCost(sessionId);
    if (!sessionCost) {
      return this.getNoDataMessage();
    }

    const variables = this.generateVariables(sessionCost);
    return this.substituteVariables(template, variables);
  }

  /**
   * Generates all available variables for substitution
   * @param sessionCost Session cost data
   * @returns Object containing all available variables
   */
  private generateVariables(sessionCost: SessionCostData): Record<string, string> {
    const variables: Record<string, string> = {};

    // Base variables
    variables['totalCost'] = this.formatCurrency(sessionCost.totalCost, sessionCost.currency);
    variables['totalCostRaw'] = sessionCost.totalCost.toFixed(6);
    variables['sessionDuration'] = this.formatDuration(sessionCost.startTime);
    variables['modelCosts'] = JSON.stringify(sessionCost.modelCosts);
    variables['trackingStatus'] = this.getTrackingStatus();
    variables['statusMessage'] = this.getStatusMessage(sessionCost);
    variables['statusColor'] = this.getStatusColor(sessionCost.totalCost);

    // Top model analysis
    const topModel = this.getTopModel(sessionCost.modelCosts);
    if (topModel) {
      variables['topModel'] = topModel.name;
      variables['topModelCost'] = this.formatCurrency(topModel.cost, sessionCost.currency);
    } else {
      variables['topModel'] = 'None';
      variables['topModelCost'] = this.formatCurrency(0, sessionCost.currency);
    }

    // Dynamic model-specific variables
    this.generateModelSpecificVariables(sessionCost, variables);

    return variables;
  }

  /**
   * Generates dynamic model-specific cost variables
   * @param sessionCost Session cost data
   * @param variables Variables object to populate
   */
  private generateModelSpecificVariables(
    sessionCost: SessionCostData,
    variables: Record<string, string>
  ): void {
    for (const [modelName, costData] of Object.entries(sessionCost.modelCosts)) {
      // Convert model name to variable-friendly format
      const variableName = this.normalizeModelName(modelName);
      const variableKey = `cost.${variableName}`;

      variables[variableKey] = this.formatCurrency(costData.totalCost, sessionCost.currency);
    }
  }

  /**
   * Normalizes model names for variable usage
   * @param modelName Original model name
   * @returns Normalized model name for variable substitution
   */
  private normalizeModelName(modelName: string): string {
    // Convert to lowercase and replace special characters with underscores
    return modelName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
  }

  /**
   * Substitutes variables in a template string
   * @param template Template string with {{variable}} placeholders
   * @param variables Object containing variable values
   * @returns Template with variables substituted
   */
  private substituteVariables(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, variableName) => {
      return variables[variableName] !== undefined ? variables[variableName] : match;
    });
  }

  /**
   * Formats currency amount with proper locale and precision
   * @param amount Amount to format
   * @param currency Currency code
   * @returns Formatted currency string
   */
  private formatCurrency(amount: number, currency: string): string {
    // Use Intl.NumberFormat for proper currency formatting
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: amount < 0.01 ? 4 : 2,
      maximumFractionDigits: amount < 0.01 ? 6 : 2
    });

    return formatter.format(amount);
  }

  /**
   * Formats session duration from start time
   * @param startTime Session start time
   * @returns Formatted duration string
   */
  private formatDuration(startTime: Date): string {
    const now = new Date();
    const durationMs = now.getTime() - startTime.getTime();

    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Gets the top (most expensive) model from cost breakdown
   * @param modelCosts Model cost breakdown
   * @returns Top model info or null if no models
   */
  private getTopModel(modelCosts: Record<string, any>): { name: string; cost: number } | null {
    let topModel: { name: string; cost: number } | null = null;

    for (const [modelName, costData] of Object.entries(modelCosts)) {
      if (costData.totalCost > 0 && (!topModel || costData.totalCost > topModel.cost)) {
        topModel = {
          name: modelName,
          cost: costData.totalCost
        };
      }
    }

    return topModel;
  }

  /**
   * Gets the current tracking status
   * @returns Tracking status string
   */
  private getTrackingStatus(): string {
    return this.config.enabled ? 'Active' : 'Disabled';
  }

  /**
   * Generates a detailed status message
   * @param sessionCost Session cost data
   * @returns Status message
   */
  private getStatusMessage(sessionCost: SessionCostData): string {
    const modelCount = Object.keys(sessionCost.modelCosts).length;

    if (modelCount === 0) {
      return 'No model usage tracked';
    }

    const topModel = this.getTopModel(sessionCost.modelCosts);
    if (topModel) {
      return `${modelCount} model${modelCount > 1 ? 's' : ''} used, ${topModel.name} highest cost`;
    }

    return `${modelCount} model${modelCount > 1 ? 's' : ''} used`;
  }

  /**
   * Gets status color based on cost amount
   * @param totalCost Total session cost
   * @returns Color indicator
   */
  private getStatusColor(totalCost: number): string {
    if (totalCost === 0) {
      return 'gray';
    } else if (totalCost < 0.01) {
      return 'green';
    } else if (totalCost < 0.1) {
      return 'yellow';
    } else {
      return 'red';
    }
  }

  /**
   * Gets message when cost tracking is disabled
   * @returns Disabled status message
   */
  private getDisabledMessage(): string {
    return 'Cost tracking disabled';
  }

  /**
   * Gets message when no cost data is available
   * @returns No data status message
   */
  private getNoDataMessage(): string {
    return 'No cost data available';
  }

  /**
   * Gets all available variable names for documentation
   * @returns Array of available variable names
   */
  getAvailableVariables(): string[] {
    const baseVariables = [
      'totalCost',
      'totalCostRaw',
      'sessionDuration',
      'modelCosts',
      'topModel',
      'topModelCost',
      'trackingStatus',
      'statusMessage',
      'statusColor'
    ];

    // Note: Dynamic model variables are generated at runtime
    // based on actual model usage in the session
    return baseVariables;
  }

  /**
   * Gets cost variables for a specific session
   * @param sessionId Session identifier
   * @returns Object containing all cost variables for the session
   */
  getCostVariables(sessionId: string): Record<string, string> {
    if (!this.config.enabled) {
      return { trackingStatus: 'Disabled', statusMessage: 'Cost tracking disabled' };
    }

    const sessionCost = this.calculator.getSessionCost(sessionId);
    if (!sessionCost) {
      return { trackingStatus: 'Active', statusMessage: 'No cost data available' };
    }

    return this.generateVariables(sessionCost);
  }

  /**
   * Gets a description of all available variables
   * @returns Object mapping variable names to descriptions
   */
  getVariableDescriptions(): Record<string, string> {
    return {
      'totalCost': 'Formatted total session cost with currency symbol',
      'totalCostRaw': 'Raw numeric total cost (6 decimal places)',
      'sessionDuration': 'Session duration in human-readable format',
      'modelCosts': 'JSON string of per-model cost breakdowns',
      'topModel': 'Name of the most expensive model used',
      'topModelCost': 'Formatted cost of the most expensive model',
      'trackingStatus': 'Current tracking state (Active/Disabled)',
      'statusMessage': 'Detailed status message with model count',
      'statusColor': 'Color indicator for status (gray/green/yellow/red)',
      'cost.*': 'Dynamic variables for specific model costs (e.g., cost.openai_gpt_4)'
    };
  }
}