#!/usr/bin/env node

// Since the build creates a single bundle, let's test via API instead

async function debugCostTracking() {
  try {
    console.log('🔍 Debugging cost tracking...\n');

    // Read config
    const config = await readConfigFile();
    console.log('📋 Config loaded:');
    console.log('  Cost tracking enabled:', config.CostTracking?.enabled);
    console.log('  Currency:', config.CostTracking?.currency);
    console.log('  DeepSeek pricing:', config.CostTracking?.models?.['deepseek,deepseek-chat']);

    if (!config.CostTracking?.enabled) {
      console.log('❌ Cost tracking is disabled in config!');
      return;
    }

    // Initialize cost calculator
    const costCalculator = new CostCalculator(config.CostTracking);
    console.log('\n✅ Cost calculator initialized');

    // Initialize cost status line provider
    const costProvider = new CostStatusLineProvider(costCalculator, config.CostTracking);
    console.log('✅ Cost status line provider initialized');

    // Simulate the cost calculation that should happen after API call
    const sessionId = 'test-session-123';
    const model = 'deepseek,deepseek-chat';
    const inputTokens = 5;
    const outputTokens = 10;

    console.log('\n📊 Simulating cost calculation:');
    console.log('  Session ID:', sessionId);
    console.log('  Model:', model);
    console.log('  Input tokens:', inputTokens);
    console.log('  Output tokens:', outputTokens);

    const cost = costCalculator.calculateCost(sessionId, model, inputTokens, outputTokens);
    console.log('  Calculated cost:', cost);

    // Get session cost data
    const sessionCost = costCalculator.getSessionCost(sessionId);
    console.log('\n📈 Session cost data:');
    console.log('  Total cost:', sessionCost?.totalCost);
    console.log('  Model costs:', sessionCost?.modelCosts);

    // Get cost variables for status line
    const variables = costProvider.getCostVariables(sessionId);
    console.log('\n🔧 Cost variables for status line:');
    console.log('  Variables:', variables);

    // Test specific variable we care about
    console.log('\n💰 Specific status line variables:');
    console.log('  {{totalCost}} ->', variables.totalCost);
    console.log('  {{totalCostRaw}} ->', variables.totalCostRaw);
    console.log('  {{trackingStatus}} ->', variables.trackingStatus);
    console.log('  {{statusMessage}} ->', variables.statusMessage);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugCostTracking();