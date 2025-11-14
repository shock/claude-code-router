# Claude Code Router - Baseline Documentation

This document provides comprehensive baseline documentation for the current router behavior, serving as a foundation for regression testing and cost tracking integration.

## Table of Contents
1. [Current Status Line Behavior](#current-status-line-behavior)
2. [Configuration Loading Patterns](#configuration-loading-patterns)
3. [Session Management Implementation](#session-management-implementation)
4. [Token Tracking Implementation](#token-tracking-implementation)
5. [API Response Processing Flow](#api-response-processing-flow)
6. [Agent System Architecture](#agent-system-architecture)
7. [Key File References](#key-file-references)

---

## Current Status Line Behavior

### Status Line Input Interface
**File**: `/opt/local/src/claude-code-router/src/utils/statusline.ts`

```typescript
export interface StatusLineInput {
  hook_event_name: string;
  session_id: string;
  transcript_path: string;
  cwd: string;
  model: {
    id: string;
    display_name: string;
  };
  workspace: {
    current_dir: string;
    project_dir: string;
  };
}
```

### Available Variables and Data Sources

#### 1. **Work Directory Information**
- **Variable**: `{{workDirName}}`
- **Source**: `input.workspace.current_dir`
- **Processing**: Extracts last directory name from full path
- **Example**: `/opt/local/src/claude-code-router` → `claude-code-router`

#### 2. **Git Branch Information**
- **Variable**: `{{gitBranch}}`
- **Source**: Executes `git branch --show-current` in current directory
- **Error Handling**: Silently fails if not in git repository

#### 3. **Model Information**
- **Variable**: `{{model}}`
- **Sources** (in priority order):
  1. Last assistant message from transcript file
  2. Project-specific router configuration
  3. User home directory router configuration
  4. Input model display name

#### 4. **Token Usage Information**
- **Variables**: `{{inputTokens}}`, `{{outputTokens}}`
- **Source**: Last assistant message usage data from transcript
- **Formatting**: Values >1000 converted to "k" format (e.g., "1.2k")

### Theme System

#### Built-in Themes
1. **Default Theme** (Nerd Fonts icons)
2. **Powerline Theme** (segmented with arrows)
3. **Simple Theme** (fallback for unsupported terminals)

#### Theme Detection Logic
- **Nerd Fonts Support**: Checks environment variables (`NERD_FONT`, `TERM_PROGRAM`, `COLORTERM`)
- **UTF-8 Support**: Checks `LANG`, `LC_ALL`, `LC_CTYPE` environment variables
- **Manual Override**: `USE_SIMPLE_ICONS=true` environment variable

#### Custom Theme Configuration
```json
{
  "StatusLine": {
    "currentStyle": "powerline",
    "powerline": {
      "modules": [
        {
          "type": "workDir",
          "icon": "󰉋",
          "text": "{{workDirName}}",
          "color": "white",
          "background": "bg_bright_blue"
        }
      ]
    }
  }
}
```

---

## Configuration Loading Patterns

### Configuration File Location
**Primary**: `~/.claude-code-router/config.json`
**Project-specific**: `~/.claude/projects/{project}/config.json`

### Configuration Loading Flow
**File**: `/opt/local/src/claude-code-router/src/utils/index.ts`

1. **File Access Check**: Attempts to read config file
2. **JSON5 Parsing**: Supports JSON with comments and trailing commas
3. **Environment Variable Interpolation**: Processes `$VAR` and `${VAR}` patterns
4. **Fallback Creation**: Creates minimal config if file doesn't exist

### Key Configuration Structure
```json
{
  "LOG": true,
  "HOST": "127.0.0.1",
  "PORT": 3456,
  "APIKEY": "your-api-key",
  "API_TIMEOUT_MS": 600000,
  "Providers": [],
  "Router": {
    "default": "provider,model",
    "background": "provider,model",
    "think": "provider,model",
    "longContext": "provider,model",
    "webSearch": "provider,model"
  },
  "StatusLine": {
    "enabled": true,
    "currentStyle": "default"
  }
}
```

### Environment Variable Interpolation
- **Pattern**: `$VAR_NAME` or `${VAR_NAME}`
- **Scope**: All string values in configuration
- **Fallback**: Original string preserved if variable not found

---

## Session Management Implementation

### Session ID Extraction
**File**: `/opt/local/src/claude-code-router/src/utils/router.ts`

```typescript
// From metadata.user_id format: "prefix_session_{sessionId}"
if (req.body.metadata?.user_id) {
  const parts = req.body.metadata.user_id.split("_session_");
  if (parts.length > 1) {
    req.sessionId = parts[1];
  }
}
```

### Project-Specific Configuration
**File**: `/opt/local/src/claude-code-router/src/utils/router.ts`

#### Search Order
1. **Session Config**: `~/.claude/projects/{project}/{sessionId}.json`
2. **Project Config**: `~/.claude/projects/{project}/config.json`
3. **Global Config**: `~/.claude-code-router/config.json`

#### Project Discovery
- **Cache**: LRU cache with 1000 entry limit
- **Search**: Scans `~/.claude/projects` for matching `{sessionId}.jsonl` files
- **Performance**: Cached results to avoid repeated filesystem scans

### Session Usage Cache
**File**: `/opt/local/src/claude-code-router/src/utils/cache.ts`

```typescript
export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

export const sessionUsageCache = new LRUCache<string, Usage>(100);
```

---

## Token Tracking Implementation

### Token Counting Logic
**File**: `/opt/local/src/claude-code-router/src/utils/router.ts`

#### Supported Content Types
1. **Text Messages**: Direct token count of string content
2. **Tool Use**: JSON stringified input object token count
3. **Tool Results**: String or JSON stringified content token count
4. **System Prompts**: Text content token count
5. **Tools**: Name + description + input schema token count

#### Token Counter Endpoint
**File**: `/opt/local/src/claude-code-router/src/server.ts`

```typescript
server.app.post("/v1/messages/count_tokens", async (req, reply) => {
  const {messages, tools, system} = req.body;
  const tokenCount = calculateTokenCount(messages, system, tools);
  return { "input_tokens": tokenCount }
});
```

### Usage Data Collection
**File**: `/opt/local/src/claude-code-router/src/index.ts`

#### Stream Processing
- **Method**: Background stream reading for `message_delta` events
- **Storage**: Updates `sessionUsageCache` with latest usage data
- **Error Handling**: Graceful handling of stream closure

#### Non-Stream Responses
- **Method**: Direct usage data extraction from response payload
- **Storage**: Updates `sessionUsageCache` with usage data

---

## API Response Processing Flow

### Request Processing Pipeline
**File**: `/opt/local/src/claude-code-router/src/index.ts`

#### 1. Authentication Hook
- **File**: `/opt/local/src/claude-code-router/src/middleware/auth.ts`
- **Public Endpoints**: `/`, `/health`, `/ui/*`
- **API Key Validation**: Bearer token or `x-api-key` header
- **CORS Handling**: Localhost origins allowed when no API key

#### 2. Agent Processing Hook
- **Trigger**: `/v1/messages` endpoints (excluding token counting)
- **Agent Detection**: Iterates through registered agents
- **Request Modification**: Updates request body and tools
- **Agent Identification**: Sets `req.agents` array

#### 3. Router Processing Hook
- **Model Selection**: Based on token count, context, and routing rules
- **Custom Router Support**: External router scripts via `CUSTOM_ROUTER_PATH`

### Response Processing Pipeline

#### 1. Stream Processing
- **SSE Parsing**: `SSEParserTransform` for Server-Sent Events
- **Agent Tool Handling**: Intercepts tool calls for agent execution
- **Usage Tracking**: Background stream reading for token usage
- **SSE Serialization**: `SSESerializerTransform` for response formatting

#### 2. Non-Stream Processing
- **Direct Usage Storage**: Extracts usage data from response payload
- **Error Handling**: Proper error response formatting

### Router Decision Logic
**File**: `/opt/local/src/claude-code-router/src/utils/router.ts`

#### Model Selection Priority
1. **Explicit Model**: User-specified model in request
2. **Custom Router**: External router script if configured
3. **Long Context**: Token count > threshold (default: 60k)
4. **Subagent Model**: `<CCR-SUBAGENT-MODEL>` tags in system prompt
5. **Background Model**: Claude Haiku variants
6. **Web Search**: Requests with web search tools
7. **Thinking Mode**: Requests with thinking enabled
8. **Default Model**: Fallback to router default

---

## Agent System Architecture

### Agent Interface
**File**: `/opt/local/src/claude-code-router/src/agents/type.ts`

```typescript
export interface IAgent {
  name: string;
  tools: Map<string, ITool>;
  shouldHandle: (req: any, config: any) => boolean;
  reqHandler: (req: any, config: any) => void;
  resHandler?: (payload: any, config: any) => void;
}
```

### Agent Manager
**File**: `/opt/local/src/claude-code-router/src/agents/index.ts`

#### Current Agents
1. **Image Agent**: Handles image processing tasks

#### Tool Integration
- **Registration**: Tools added to request body
- **Execution**: Intercepted during stream processing
- **Response**: Tool results appended to conversation

---

## Key File References

### Core Files
- **Entry Point**: `/opt/local/src/claude-code-router/src/cli.ts`
- **Server**: `/opt/local/src/claude-code-router/src/server.ts`
- **Main Logic**: `/opt/local/src/claude-code-router/src/index.ts`

### Utility Files
- **Router**: `/opt/local/src/claude-code-router/src/utils/router.ts`
- **Status Line**: `/opt/local/src/claude-code-router/src/utils/statusline.ts`
- **Configuration**: `/opt/local/src/claude-code-router/src/utils/index.ts`
- **Cache**: `/opt/local/src/claude-code-router/src/utils/cache.ts`
- **Process Management**: `/opt/local/src/claude-code-router/src/utils/processCheck.ts`

### Stream Processing
- **SSE Parser**: `/opt/local/src/claude-code-router/src/utils/SSEParser.transform.ts`
- **SSE Serializer**: `/opt/local/src/claude-code-router/src/utils/SSESerializer.transform.ts`
- **Stream Rewriting**: `/opt/local/src/claude-code-router/src/utils/rewriteStream.ts`

### Middleware
- **Authentication**: `/opt/local/src/claude-code-router/src/middleware/auth.ts`

### Agents
- **Manager**: `/opt/local/src/claude-code-router/src/agents/index.ts`
- **Types**: `/opt/local/src/claude-code-router/src/agents/type.ts`
- **Image Agent**: `/opt/local/src/claude-code-router/src/agents/image.agent.ts`

---

## Testing Considerations for Cost Tracking Integration

### Critical Behaviors to Preserve
1. **Session Management**: Session ID extraction and project-specific routing
2. **Token Counting**: Accurate token calculation across all content types
3. **Usage Tracking**: Stream and non-stream usage data collection
4. **Router Logic**: Model selection based on context and thresholds
5. **Agent System**: Tool integration and execution flow
6. **Status Line**: Variable availability and data sources
7. **Configuration**: Environment variable interpolation and fallbacks

### Integration Points for Cost Tracking
1. **Token Counting Extension**: Add cost calculation to existing token counting
2. **Usage Data Enhancement**: Augment usage cache with cost information
3. **Router Decision Support**: Include cost considerations in model selection
4. **Status Line Integration**: Add cost display to status line variables
5. **Configuration Extension**: Add cost-related configuration options