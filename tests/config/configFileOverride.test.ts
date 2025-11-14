import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Mock console.warn to track warnings
const mockWarn = jest.fn();

// Mock fs operations
jest.mock('node:fs/promises');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock JSON5 to avoid parsing issues
jest.mock('json5', () => ({
  parse: jest.fn().mockImplementation((str) => JSON.parse(str))
}));

describe('CCR_CFG_FILE Configuration Override', () => {
  const originalEnv = process.env;
  const originalWarn = console.warn;
  const originalExit = process.exit;

  beforeEach(() => {
    process.env = { ...originalEnv };
    console.warn = mockWarn;
    process.exit = jest.fn() as any;
    mockWarn.mockClear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    console.warn = originalWarn;
    process.exit = originalExit;
  });

  describe('CONFIG_FILE constant', () => {
    it('should use default path when CCR_CFG_FILE is not set', () => {
      delete process.env.CCR_CFG_FILE;
      // The constant is evaluated at import time, so we need to test it directly
      const { CONFIG_FILE } = require('../../src/constants');
      expect(CONFIG_FILE).toBe(path.join(os.homedir(), '.claude-code-router', 'config.json'));
    });

    it('should use default path when CCR_CFG_FILE is empty string', () => {
      process.env.CCR_CFG_FILE = '';
      // The constant is evaluated at import time, so we need to test it directly
      const { CONFIG_FILE } = require('../../src/constants');
      expect(CONFIG_FILE).toBe(path.join(os.homedir(), '.claude-code-router', 'config.json'));
    });
  });

  describe('readConfigFile function fallback behavior', () => {
    const defaultConfigPath = path.join(os.homedir(), '.claude-code-router', 'config.json');

    beforeEach(() => {
      // Mock successful directory operations for all tests
      mockedFs.access.mockRejectedValue(new Error('Directory does not exist'));
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.copyFile.mockRejectedValue(new Error('No file to backup'));
    });

    it('should read from default path when CCR_CFG_FILE is not set', async () => {
      delete process.env.CCR_CFG_FILE;

      // Mock successful read from default path with valid JSON5
      mockedFs.readFile.mockResolvedValueOnce(JSON.stringify({
        PORT: 3456,
        Providers: [],
        Router: {}
      }));

      const { readConfigFile } = require('../../src/utils');
      const config = await readConfigFile();

      expect(mockedFs.readFile.mock.calls[0][0]).toBe(defaultConfigPath);
      expect(config).toEqual({
        PORT: 3456,
        Providers: [],
        Router: {}
      });
      expect(mockWarn).not.toHaveBeenCalled();
    });

  /**
   * INTEGRATION TEST PATTERN FOR ENVIRONMENT VARIABLE OVERRIDES
   *
   * This pattern should be used when testing environment variable overrides that affect
   * file paths or configuration loading. It creates real temporary files and uses
   * unmocked file system operations to test the actual behavior.
   *
   * Key elements:
   * - Uses real fs (not mocked) for file operations
   * - Creates temporary files with distinctive test values
   * - Sets environment variables before module imports
   * - Clears module cache to ensure fresh evaluation
   * - Temporarily unmocks file system for integration testing
   * - Proper cleanup of temporary files
   */
  describe('Integration test with temporary config file', () => {
    let tempConfigPath: string;
    let tempDir: string;

    beforeEach(() => {
      // Use real synchronous fs for file operations (not the mocked one)
      // This ensures we're creating actual files on disk
      const realFs = require('node:fs');

      // Create a temporary directory and config file
      tempDir = realFs.mkdtempSync(path.join(os.tmpdir(), 'ccr-test-'));
      tempConfigPath = path.join(tempDir, 'test-config.json');

      // Write a test config with a distinctive value
      // Use unique values that won't conflict with default config
      realFs.writeFileSync(tempConfigPath, JSON.stringify({
        PORT: 9999,
        HOST: "test-integration-host",
        Providers: ["integration-test-provider"],
        Router: {"default": "integration-test-model"}
      }));
    });

    afterEach(() => {
      // Clean up temporary files using real fs
      const realFs = require('node:fs');
      try {
        realFs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
      // Reset environment variable
      delete process.env.CCR_CFG_FILE;
    });

    it('should read config from CCR_CFG_FILE when environment variable is set', async () => {
      // Set the environment variable to point to our temporary config
      process.env.CCR_CFG_FILE = tempConfigPath;

      // Clear module cache to ensure fresh import with new environment
      // This is critical because constants are evaluated at import time
      jest.resetModules();

      // Temporarily unmock fs for this test to use real file operations
      jest.unmock('node:fs/promises');

      try {
        // Import the utils module (which will use the new environment variable)
        // The CONFIG_FILE constant will now evaluate with the new CCR_CFG_FILE value
        const { readConfigFile } = require('../../src/utils');

        // Read the config - this should use our temporary file via real fs operations
        const config = await readConfigFile();

        // Verify the config was read from the correct file by checking distinctive values
        expect(config.PORT).toBe(9999);
        expect(config.HOST).toBe("test-integration-host");
        expect(config.Providers).toEqual(["integration-test-provider"]);
        expect(config.Router.default).toBe("integration-test-model");
        expect(mockWarn).not.toHaveBeenCalled();
      } finally {
        // Remock fs for other tests to maintain test isolation
        jest.mock('node:fs/promises');
      }
    });
  });
  });
});