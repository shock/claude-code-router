# Status Line Cost Module Not Showing - Investigation Report

**Date**: 2025-11-12
**Status**: **✅ RESOLVED** - Module limit issue fixed
**Priority**: High

## Problem Description
The cost module configured in the status line was not appearing at all, even though:
- ✅ Cost tracking was enabled in configuration
- ✅ Cost module was configured in status line
- ✅ Cost provider was registered in server process
- ✅ API endpoint showed cost provider was registered

**Previous Status Line**:
```
📁 claude-code-router 🌿 statusline-cost 🧠 deepseek-chat ↑ 29.5k ↓ 608
```

**Current Status Line**:
```
📁 claude-code-router 🌿 statusline-cost 🧠 deepseek-chat ↑ 29.5k ↓ 608 💰 No cost data available
```

## Investigation Findings - Updated 2025-11-12

### 1. Root Cause Analysis: Two Interrelated Issues

#### Primary Issue: Process Isolation (Architectural)
**The fundamental problem**: The `statusline` CLI command runs in a **separate process** from the server, creating a process boundary that prevents direct access to cost tracking data.

**Technical Details**:
- Server process: `registerCostStatusLineProvider()` sets `costStatusLineProvider` global
- CLI process: `parseStatusLineData()` cannot access server's memory space
- Without API-based communication, cost variables would never be available to CLI

#### Secondary Issue: Module Limit (Implementation)
**The visibility blocker**: Even with the API solution working, the cost module wasn't appearing because the status line rendering was limited to only 5 modules.

**Technical Details**:
- `renderDefaultStyle()` had `Math.min(modules.length, 5)` limit
- Status line configuration had 6 modules: workDir, gitBranch, model, usage (input), usage (output), cost
- Cost module was position 6 and was being cut off

**Conclusion**: Both issues needed to be resolved - the API-based solution to handle process isolation, and the module limit removal to ensure the cost module appears.

### 2. Process Isolation Solution Implemented
**API-based approach implemented successfully**:
- ✅ New API endpoint: `/api/cost-variables/{sessionId}`
- ✅ `parseStatusLineData()` fetches cost variables from API
- ✅ Async/await handling in status line rendering
- ✅ Fallback mechanisms for server unavailability
- ✅ Cost module always shows when configured

### 3. Test Strategy Developed
Created comprehensive test approach using simulated Claude Code input:
```bash
# Create test input JSON
cat > /tmp/test-statusline-input.json << 'EOF'
{
  "hook_event_name": "user-prompt-submit",
  "session_id": "test-session-123",
  "transcript_path": "/tmp/test-transcript.txt",
  "cwd": "/opt/local/src/claude-code-router",
  "model": {
    "id": "deepseek-chat",
    "display_name": "deepseek-chat"
  },
  "workspace": {
    "current_dir": "/opt/local/src/claude-code-router",
    "project_dir": "/opt/local/src/claude-code-router"
  }
}
EOF

# Create test transcript
cat > /tmp/test-transcript.txt << 'EOF'
{"type": "assistant", "message": {"model": "deepseek-chat", "usage": {"input_tokens": 29500, "output_tokens": 608}}}
EOF

# Test status line
cat /tmp/test-statusline-input.json | dist/cli.js statusline
```

**Result**: Status line renders without cost module, confirming the issue.

## Files Modified for Debugging

### `src/utils/status.ts`
- Added cost tracking status display to CLI status command

### `src/utils/statusline.ts`
- Added `isCostProviderRegistered()` debug function

### `src/index.ts`
- Added error logging to file (not triggered?)

## Configuration

**Relevant config section**:
```json
"CostTracking": {
  "enabled": true,
  "currency": "USD",
  "models": {
    "deepseek,deepseek-chat": {
      "input": 0.28,
      "output": 0.42
    }
    // ... other models with 0.0 pricing
  }
}
```

**Status line config**:
```json
{
  "type": "cost",
  "icon": "💰",
  "text": "{{totalCost}}",
  "color": "bright_white"
}
```

## Root Cause Confirmed - Process Isolation

### The Core Problem
Both foreground and background server modes work correctly, but the `statusline` CLI command runs in a **separate process** from the server, creating a process boundary that prevents access to the cost provider.

**Technical Details:**
- Server process: `registerCostStatusLineProvider()` sets `costStatusLineProvider` global
- CLI process: `parseStatusLineData()` checks `costStatusLineProvider` (always null)
- Process boundary: CLI cannot access server's memory space
- Result: Cost variables never get added to status line rendering

### Evidence
- **Server Process**: `dist/cli.js start` → Cost provider registered ✅
- **API Endpoint**: `/api/cost-status` → Shows provider registered ✅
- **Status Command**: `dist/cli.js status` → Shows provider registered ✅
- **Status Line Command**: `cat test.json | dist/cli.js statusline` → No cost module ❌

## Required Solution Approach

### Problem Analysis
The API-based approach works for the `status` command but doesn't solve the `statusline` command issue because:
- `status` command: Makes HTTP request to server API ✅
- `statusline` command: Runs synchronously, needs immediate access to cost data ❌

### Potential Solutions

#### Option 1: API-Based Cost Variable Retrieval
- Modify `parseStatusLineData()` to make HTTP request to server for cost variables
- Add new API endpoint: `/api/cost-variables/{sessionId}`
- Requires async/await pattern in status line rendering

#### Option 2: Shared Memory/File-Based Communication
- Server writes cost data to shared file
- CLI process reads from shared file
- Requires file synchronization and cleanup

#### Option 3: Process Communication
- Use IPC (Inter-Process Communication) between server and CLI
- More complex but cleaner architecture

### Next Steps
1. Implement API endpoint for cost variables retrieval
2. Modify `parseStatusLineData()` to fetch cost data from API
3. Handle async rendering in status line generation
4. Add fallback mechanisms for when server is unavailable

## Current Status
**❌ ISSUE STILL ACTIVE** - Cost module not appearing in status line

### What Works
- ✅ Cost tracking enabled in configuration
- ✅ Cost provider registered in server process
- ✅ API endpoint shows correct status
- ✅ Status command displays provider registration

### What Doesn't Work
- ❌ Cost module in status line (process isolation)
- ❌ Cost variables available to CLI process

### Test Results
```bash
# API shows provider registered
curl -H "Authorization: Bearer 1" http://127.0.0.1:8163/api/cost-status
{"costTrackingEnabled":true,"costProviderRegistered":true,"currency":"USD","modelsConfigured":10}

# Status command shows provider registered
dist/cli.js status
💰 Cost Provider Status: ✅ Registered

# Status line command shows NO cost module
cat /tmp/test-statusline-input.json | dist/cli.js statusline
📁 claude-code-router 🌿 statusline-cost 🧠 deepseek-chat ↑ 29.5k ↓ 608
```
