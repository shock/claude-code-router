# Configuration File Override Feature

## Overview

The configuration file override feature allows users to specify an alternative location for the Claude Code Router configuration file using the `CCR_CFG_FILE` environment variable. This provides flexibility for users who want to:

- Use different configurations for different environments
- Store configuration files in version control or shared locations
- Test configurations without affecting the default setup

## Implementation Details

### Files Modified

#### 1. `src/constants.ts`
**Line 6**: Updated the `CONFIG_FILE` constant to support environment variable override:
```typescript
// Before:
export const CONFIG_FILE = path.join(HOME_DIR, "config.json");

// After:
export const CONFIG_FILE = process.env.CCR_CFG_FILE || path.join(HOME_DIR, "config.json");
```

#### 2. `src/utils/index.ts`
**Lines 71-101**: Enhanced the `readConfigFile()` function to handle fallback logic:
- Added logic to detect when `CCR_CFG_FILE` is set but the file doesn't exist
- Implemented non-recursive fallback to default location
- Added warning message when fallback occurs

Key changes:
```typescript
// Check if CCR_CFG_FILE is set but file doesn't exist
if (process.env.CCR_CFG_FILE && configPath !== defaultConfigPath) {
  console.warn(`Config file not found at CCR_CFG_FILE=${configPath}, falling back to default location: ${defaultConfigPath}`);

  // Try to read from default location directly without recursion
  try {
    const defaultConfig = await fs.readFile(defaultConfigPath, "utf-8");
    const parsedConfig = JSON5.parse(defaultConfig);
    return interpolateEnvVars(parsedConfig);
  } catch {
    // If default location also fails, continue with normal setup flow
  }
}
```

### Behavior

1. **Default Behavior**: Uses `~/.claude-code-router/config.json`
2. **With CCR_CFG_FILE**: Uses the specified path if the file exists
3. **Fallback**: If CCR_CFG_FILE is set but the file doesn't exist, falls back to default location with warning
4. **Error Handling**: If both locations fail, continues with normal setup flow (creates default config)

## TODO: Testing Strategy

### Unit Tests Needed

#### 1. Configuration File Path Resolution
- **Test**: Verify `CONFIG_FILE` constant resolves correctly
- **Scenarios**:
  - No CCR_CFG_FILE environment variable → uses default path
  - CCR_CFG_FILE set → uses specified path
  - CCR_CFG_FILE set to empty string → uses default path

#### 2. File Reading Logic
- **Test**: `readConfigFile()` function behavior
- **Scenarios**:
  - File exists at CCR_CFG_FILE path → reads successfully
  - File doesn't exist at CCR_CFG_FILE path → falls back to default
  - Neither file exists → creates default configuration
  - File exists but is invalid JSON → shows parse error

#### 3. Fallback Behavior
- **Test**: Warning message and fallback logic
- **Scenarios**:
  - CCR_CFG_FILE set but file missing → shows warning once
  - Default location file exists → reads successfully after fallback
  - Default location file missing → creates default config

### Integration Tests

#### 1. CLI Command Tests
- **Test**: Various CLI commands with CCR_CFG_FILE
- **Commands**: `ccr start`, `ccr status`, `ccr model`
- **Verify**: Commands work correctly with custom config location

#### 2. Server Startup Tests
- **Test**: Server initialization with custom config
- **Verify**: Server starts successfully with CCR_CFG_FILE
- **Verify**: Server falls back gracefully when custom config missing

### Test Implementation Approach

#### Mock Environment Variables
```typescript
// Use jest.spyOn to mock process.env
const originalEnv = process.env;
beforeEach(() => {
  process.env = { ...originalEnv };
});
afterEach(() => {
  process.env = originalEnv;
});
```

#### Mock File System
```typescript
// Use jest.mock for fs operations
jest.mock('node:fs/promises');
import fs from 'node:fs/promises';
```

#### Test File Locations
- Create temporary test directories
- Use `os.tmpdir()` for test files
- Clean up test files after each test

### Test Coverage Goals

- **Path Resolution**: 100% coverage for CONFIG_FILE constant
- **File Reading**: All branches in readConfigFile() function
- **Error Cases**: File not found, parse errors, permission errors
- **Edge Cases**: Empty environment variables, invalid paths

### Example Test Structure

```typescript
describe('CCR_CFG_FILE override', () => {
  describe('CONFIG_FILE constant', () => {
    it('should use default path when CCR_CFG_FILE not set', () => {
      delete process.env.CCR_CFG_FILE;
      expect(CONFIG_FILE).toBe(path.join(HOME_DIR, 'config.json'));
    });

    it('should use CCR_CFG_FILE when set', () => {
      process.env.CCR_CFG_FILE = '/custom/path/config.json';
      expect(CONFIG_FILE).toBe('/custom/path/config.json');
    });
  });

  describe('readConfigFile function', () => {
    it('should fall back to default when CCR_CFG_FILE file missing', async () => {
      process.env.CCR_CFG_FILE = '/nonexistent/config.json';
      // Mock fs.readFile to simulate file not found at custom path
      // but existing at default path
      // Verify warning is logged and default config is returned
    });
  });
});
```