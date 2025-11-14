import { getServiceInfo } from './processCheck';
import { readConfigFile } from './index';

export async function showStatus() {
    const info = await getServiceInfo();
    const config = await readConfigFile();

    console.log('\n📊 Claude Code Router Status');
    console.log('═'.repeat(40));

    if (info.running) {
        console.log('✅ Status: Running');
        console.log(`🆔 Process ID: ${info.pid}`);
        console.log(`🌐 Port: ${info.port}`);
        console.log(`📡 API Endpoint: ${info.endpoint}`);
        console.log(`📄 PID File: ${info.pidFile}`);

        // Try to get cost status from API
        try {
            const headers: Record<string, string> = {};
            if (config.APIKEY) {
                headers['Authorization'] = `Bearer ${config.APIKEY}`;
            }

            const response = await fetch(`${info.endpoint}/api/cost-status`, { headers });
            if (response.ok) {
                const costStatus = await response.json();
                console.log(`💰 Cost Tracking: ${costStatus.costTrackingEnabled ? '✅ Enabled' : '❌ Disabled in Config'}`);
                console.log(`💰 Cost Provider Status: ${costStatus.costProviderRegistered ? '✅ Registered' : '❌ Not Registered'}`);
                if (costStatus.costProviderRegistered && costStatus.costTrackingEnabled) {
                    console.log(`💰 Currency: ${costStatus.currency}`);
                    console.log(`💰 Models Configured: ${costStatus.modelsConfigured}`);
                }
            } else {
                // Fallback to local config if API fails
                const costTrackingEnabled = config?.CostTracking?.enabled || false;
                console.log(`💰 Cost Tracking: ❓ Unknown (API unavailable) ${costTrackingEnabled ? '(enabled in config)' : '(disabled in config)'}`);
                console.log(`💰 Cost Provider Status: ❓ Unknown (API unavailable)`);
            }
        } catch (error) {
            // Fallback to local config if API call fails
            const costTrackingEnabled = config?.CostTracking?.enabled || false;
            console.log(`💰 Cost Tracking: ❓ Unknown (API unavailable) ${costTrackingEnabled ? '(enabled in config)' : '(disabled in config)'}`);
            console.log(`💰 Cost Provider Status: ❓ Unknown (API unavailable)`);
        }

        console.log('');
        console.log('🚀 Ready to use! Run the following commands:');
        console.log('   ccr code    # Start coding with Claude');
        console.log('   ccr stop   # Stop the service');
    } else {
        console.log('❌ Status: Not Running');
        console.log('');
        console.log('💡 To start the service:');
        console.log('   ccr start');
    }

    console.log('');
}
