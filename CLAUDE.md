# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code Router is a powerful tool that routes Claude Code requests to different LLM providers and models. It allows users to use Claude Code without an Anthropic account by routing requests to various model providers like OpenRouter, DeepSeek, Ollama, Gemini, and others.

**IMPORTANT**: This project uses `pnpm` as the package manager.  Use `pnpm` instead of `npm` or `yarn`.  Use `pnpm dlx` instead of `npx`.
**IMPORTANT**: Use `pnpm dlx` instead of `npx`.

## Key Commands

### Development Commands
- **Build the project:** `pnpm run build` - Builds both CLI and UI components using esbuild
- **Run tests:** `pnpm test` or `pnpm run test:watch` - Uses Jest with ts-jest preset
- **Test coverage:** `pnpm run test:coverage` - Generates coverage reports
- **Release:** `pnpm run release` - Builds and publishes to pnpm

### CLI Commands

**NOTE**: Always build the project before using the CLI

- **Start server:** `dist/cli.js start` - Starts the routing server in the foreground
- **Start server:** `dist/cli.js start --background` - Starts the routing server in the background
- **Stop server:** `dist/cli.js stop` - Stops the running server
- **Restart server:** `dist/cli.js restart` - Restarts the server in the foreground
- **Restart server:** `dist/cli.js restart --background` - Restarts the server in the background
- **Check status:** `dist/cli.js status` - Shows server status
- **Run Claude Code:** `dist/cli.js code "command"` - Executes Claude Code commands through the router
- **Model management:** `dist/cli.js model` - Interactive model selection and configuration
- **Open UI:** `dist/cli.js ui` - Opens the web-based configuration UI
- **Status line:** `dist/cli.js statusline` - Integrated status line functionality

## Architecture

### Core Components

**Main Application (`src/`)**
- `cli.ts` - CLI entry point with command handling
- `index.ts` - Main application bootstrap and server initialization
- `server.ts` - Server creation with API endpoints and middleware
- `utils/router.ts` - Request routing logic and model selection

**Configuration System**
- Configuration is stored in `~/.claude-code-router/config.json` by default
- Can be overridden with `CCR_CFG_FILE` environment variable
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

## Testing Patterns

### Integration Testing for Environment Variable Overrides

When testing environment variable overrides (like `CCR_CFG_FILE`), use the integration test pattern demonstrated in `tests/config/configFileOverride.test.ts`:

**Key Pattern Elements:**
- Use real file system operations (not mocked) for file creation
- Create temporary files with distinctive test values
- Set environment variables before module imports
- Clear module cache (`jest.resetModules()`) to ensure fresh evaluation
- Temporarily unmock file system for integration testing
- Proper cleanup of temporary files

**Example Usage:**
```typescript
// Set environment variable
process.env.CCR_CFG_FILE = tempConfigPath;

// Clear module cache for fresh import
jest.resetModules();

// Temporarily unmock fs
jest.unmock('node:fs/promises');

try {
  // Import modules (will use new environment variable)
  const { readConfigFile } = require('../../src/utils');

  // Test actual behavior
  const config = await readConfigFile();

  // Verify distinctive values
  expect(config.PORT).toBe(9999);
} finally {
  // Remock for other tests
  jest.mock('node:fs/promises');
}
```

## Important Implementation Details

1. **Process Management**: Uses PID files for service state tracking
2. **Stream Processing**: Handles SSE streams for real-time responses
3. **Authentication**: API key-based authentication with configurable access levels
4. **Logging**: Rotating log files with configurable levels
5. **Error Handling**: Comprehensive error handling with graceful degradation

## Configuration Examples

See `ui/config.example.json` for comprehensive configuration examples including:

### Environment Variables

- **`CCR_CFG_FILE`**: Override the default configuration file location
  ```shell
  export CCR_CFG_FILE="/path/to/your/custom/config.json"
  ```
  If the specified file doesn't exist, falls back to default location with warning

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
- Configuration file location override via `CCR_CFG_FILE`
- Non-interactive mode for CI/CD
- Logging configuration

**IMPORTANT**: This project uses `pnpm` as the package manager.  Use `pnpm` instead of `npm` or `yarn`.  Use `pnpm dlx` instead of `npx`.
**IMPORTANT**: Use `pnpm dlx` instead of `npx`.
