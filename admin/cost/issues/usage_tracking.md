# Usage Tracking Issue: Streaming Response Token Accumulation

## Problem Description

The cost tracking system fails to properly capture token usage for streaming responses because it only stores the **last chunk's usage** instead of **accumulating usage across all chunks**.

## Root Cause Analysis

### Current Implementation Flow

1. **First `onSend` hook** (lines 235-408 in `src/index.ts`):
   - Handles streaming responses by creating background readers for `message_delta` events
   - When a `message_delta` event is found, it extracts usage data and calls:
   ```typescript
   sessionUsageCache.put(req.sessionId, message.usage);
   ```
   - **Problem**: This **overwrites** the cache with each new chunk

2. **Second `onSend` hook** (lines 409-442 in `src/index.ts`):
   - Tries to calculate cost by checking `payload?.usage`
   - **Problem**: Never checks `sessionUsageCache` where streaming usage should be stored
   - **Problem**: Even if it did check cache, it would only get the **last chunk's usage**

### The Critical Issue

For streaming responses:
- Each `message_delta` event contains **incremental usage** for that chunk
- The final `message_delta` typically has very small or zero token counts
- The **total usage** is the sum of all `message_delta` usage values
- Current implementation only stores the **last incremental usage**, losing the accumulated total

## Evidence

From `src/index.ts` lines 373-380:
```typescript
const dataStr = new TextDecoder().decode(value);
if (!dataStr.startsWith("event: message_delta")) {
  continue;
}
const str = dataStr.slice(27);
try {
  const message = JSON.parse(str);
  sessionUsageCache.put(req.sessionId, message.usage); // OVERWRITES each time!
} catch {}
```

## Proposed Solution

### 1. Fix Streaming Usage Accumulation

Modify the first `onSend` hook to **accumulate** usage instead of **overwriting**:

```typescript
// In first hook - accumulate instead of overwrite
const existingUsage = sessionUsageCache.get(req.sessionId) || { input_tokens: 0, output_tokens: 0 };
const message = JSON.parse(str);
const accumulatedUsage = {
  input_tokens: (existingUsage.input_tokens || 0) + (message.usage?.input_tokens || 0),
  output_tokens: (existingUsage.output_tokens || 0) + (message.usage?.output_tokens || 0)
};
sessionUsageCache.put(req.sessionId, accumulatedUsage);
```

### 2. Fix Cost Calculation Hook Logic

Modify the second `onSend` hook to:
- **Check `sessionUsageCache` first** (for streaming responses with accumulated usage)
- **Fallback to `payload.usage`** (for non-streaming responses)
- **Handle different provider field name conventions** (OpenAI vs Anthropic)

```typescript
let inputTokens = 0;
let outputTokens = 0;

// Check cache first (streaming responses with accumulated usage)
const cachedUsage = sessionUsageCache.get(req.sessionId);
if (cachedUsage) {
  inputTokens = cachedUsage.input_tokens || cachedUsage.prompt_tokens || 0;
  outputTokens = cachedUsage.output_tokens || cachedUsage.completion_tokens || 0;
}
// Fallback to payload (non-streaming responses)
else if (payload?.usage) {
  const usage = payload.usage as any;
  inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
  outputTokens = usage.output_tokens || usage.completion_tokens || 0;
}
```

## Expected Behavior After Fix

- **Streaming responses**: Accumulated usage from all `message_delta` events will be available in cache
- **Non-streaming responses**: Usage data from `payload.usage` will be used directly
- **Cost calculation**: Will work correctly for both response types
- **Provider compatibility**: Will handle different field name conventions (Anthropic: `input_tokens`/`output_tokens`, OpenAI: `prompt_tokens`/`completion_tokens`)

## Testing Strategy

1. **Streaming response test**: Verify that multiple `message_delta` events accumulate correctly
2. **Non-streaming response test**: Verify that direct `payload.usage` is used correctly
3. **Provider compatibility test**: Verify field name mapping works for different providers
4. **Mixed scenario test**: Verify cache is cleared/reset between requests

## Implementation Priority

**High Priority** - This is a fundamental issue preventing accurate cost tracking for streaming responses, which are commonly used in Claude Code interactions.