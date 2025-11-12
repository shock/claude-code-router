# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code Router is a powerful tool that routes Claude Code requests to different LLM providers and models. It allows users to use Claude Code without an Anthropic account by routing requests to various model providers like OpenRouter, DeepSeek, Ollama, Gemini, and others.

## Key Commands

### Development Commands
- **Build the project:** `npm run build` - Builds both CLI and UI components using esbuild
- **Run tests:** `npm test` or `npm run test:watch` - Uses Jest with ts-jest preset
- **Test coverage:** `npm run test:coverage` - Generates coverage reports
- **Release:** `npm run release` - Builds and publishes to npm

### CLI Commands
- **Start server:** `ccr start` - Starts the routing server
- **Stop server:** `ccr stop` - Stops the running server
- **Restart server:** `ccr restart` - Restarts the server
- **Check status:** `ccr status` - Shows server status
- **Run Claude Code:** `ccr code "command"` - Executes Claude Code commands through the router
- **Model management:** `ccr model` - Interactive model selection and configuration
- **Open UI:** `ccr ui` - Opens the web-based configuration UI
- **Status line:** `ccr statusline` - Integrated status line functionality

## Architecture

### Core Components

**Main Application (`src/`)**
- `cli.ts` - CLI entry point with command handling
- `index.ts` - Main application bootstrap and server initialization
- `server.ts` - Server creation with API endpoints and middleware
- `utils/router.ts` - Request routing logic and model selection

**Configuration System**
- Configuration is stored in `~/.claude-code-router/config.json`
- Supports environment variable interpolation for API keys
- Dynamic model routing based on request context

**Providers & Transformers**
- Multiple LLM provider support (OpenRouter, DeepSeek, Ollama, Gemini, etc.)
- Transformers adapt requests/responses for different provider APIs
- Custom transformers can be loaded via configuration

**UI Component (`ui/`)**
- React-based web UI for configuration management
- Built with Vite.js and Tailwind CSS
- Produces single HTML file output for deployment

### Key Technical Details

**Build System**
- Uses esbuild for fast TypeScript compilation
- UI builds separately with Vite.js
- Final distribution includes bundled CLI and UI assets

**Testing**
- Jest with TypeScript support via ts-jest
- Test files located in `tests/` directory
- Coverage reports generated in `coverage/` directory

**Configuration Structure**
```json
{
  "APIKEY": "optional-auth-key",
  "HOST": "127.0.0.1",
  "PORT": 3456,
  "LOG": true,
  "Providers": [/* provider configurations */],
  "Router": {/* routing rules */},
  "CostTracking": {/* cost calculation settings */}
}
```

## Development Notes

### Cost Tracking Feature
- Token usage tracking and cost calculation
- Async cost calculation to avoid blocking requests
- Status line integration for real-time cost display
- Configuration via `CostTracking` section in config

### Agent System
- Extensible agent framework in `src/agents/`
- Image processing agent for handling image-related tasks
- Tool integration for enhanced functionality

### Status Line Integration
- Real-time status display for Claude Code Router
- Cost tracking integration
- Dynamic variable support

### GitHub Actions Support
- Non-interactive mode for CI/CD environments
- Automated Claude Code execution in workflows
- Environment variable configuration

## Important Implementation Details

1. **Process Management**: Uses PID files for service state tracking
2. **Stream Processing**: Handles SSE streams for real-time responses
3. **Authentication**: API key-based authentication with configurable access levels
4. **Logging**: Rotating log files with configurable levels
5. **Error Handling**: Comprehensive error handling with graceful degradation

## Configuration Examples

See `ui/config.example.json` for comprehensive configuration examples including:

### Provider Configuration
- Multiple provider setups (OpenRouter, DeepSeek, Ollama, Gemini, SiliconFlow, etc.)
- API endpoints and authentication keys
- Model lists for each provider
- Transformer configurations for API compatibility

### Router Configuration
- Default model for general tasks
- Background model for cost-effective operations
- Think model for reasoning-heavy tasks
- Long context model for large inputs
- Web search model for search-related tasks

### Cost Tracking
- Per-model pricing configuration
- Input/output token rates
- Multi-currency support (USD, CNY, etc.)
- Real-time cost calculation

### Advanced Features
- Custom transformers via plugin system
- Environment variable interpolation
- Non-interactive mode for CI/CD
- Logging configuration

Example routing configuration:
```json
{
  "Router": {
    "default": "gemini-cli,gemini-2.5-pro",
    "background": "gemini-cli,gemini-2.5-flash",
    "think": "gemini-cli,gemini-2.5-pro",
    "longContext": "gemini-cli,gemini-2.5-pro",
    "webSearch": "gemini-cli,gemini-2.5-flash"
  }
}
```