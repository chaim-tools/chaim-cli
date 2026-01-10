import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateCommand } from './validate';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
vi.mock('fs');
vi.mock('path');
vi.mock('@chaim-tools/chaim-bprint-spec', () => ({
  validateSchema: vi.fn()
}));

describe('validateCommand', () => {
  let originalExit: (code?: number) => never;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    // Store original functions
    originalExit = process.exit;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    
    // Mock console methods to avoid output during tests
    console.log = vi.fn();
    console.error = vi.fn();
    
    // Mock process.exit to prevent actual exit
    process.exit = vi.fn() as any;
  });

  afterEach(() => {
    // Restore original functions
    process.exit = originalExit;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  it('should validate a valid schema file', async () => {
    const mockSchema = {
      schemaVersion: 'v1',
      entity: {
        primaryKey: { partitionKey: 'id' },
        fields: [{ name: 'id', type: 'string', required: true }]
      }
    };

    const mockValidatedSchema = {
      ...mockSchema,
      entity: {
        ...mockSchema.entity,
        primaryKey: { partitionKey: 'id' }
      }
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSchema));
    vi.mocked(path.resolve).mockReturnValue('/path/to/schema.bprint');
    
    const { validateSchema } = await import('@chaim-tools/chaim-bprint-spec');
    vi.mocked(validateSchema).mockReturnValue(mockValidatedSchema);

    await validateCommand('/path/to/schema.bprint');
    
    expect(fs.existsSync).toHaveBeenCalledWith('/path/to/schema.bprint');
    expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/schema.bprint', 'utf-8');
    expect(validateSchema).toHaveBeenCalledWith(mockSchema);
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('should handle non-existent file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await validateCommand('/nonexistent/schema.bprint');
    
    expect(fs.existsSync).toHaveBeenCalledWith('/nonexistent/schema.bprint');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should handle invalid JSON', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('invalid json');
    vi.mocked(path.resolve).mockReturnValue('/path/to/schema.bprint');

    await validateCommand('/path/to/schema.bprint');
    
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should handle schema validation failure', async () => {
    const mockSchema = { invalid: 'schema' };
    
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSchema));
    vi.mocked(path.resolve).mockReturnValue('/path/to/schema.bprint');
    
    const { validateSchema } = await import('@chaim-tools/chaim-bprint-spec');
    vi.mocked(validateSchema).mockImplementation(() => {
      throw new Error('Schema validation failed');
    });

    await validateCommand('/path/to/schema.bprint');
    
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should handle file read errors', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });
    vi.mocked(path.resolve).mockReturnValue('/path/to/schema.bprint');

    await validateCommand('/path/to/schema.bprint');
    
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should display validation success information', async () => {
    const mockSchema = {
      schemaVersion: 'v1',
      entity: {
        primaryKey: { partitionKey: 'userId' },
        fields: [
          { name: 'userId', type: 'string', required: true },
          { name: 'email', type: 'string', required: true }
        ]
      }
    };

    const mockValidatedSchema = {
      ...mockSchema,
      entity: {
        ...mockSchema.entity,
        primaryKey: { partitionKey: 'userId' }
      }
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSchema));
    vi.mocked(path.resolve).mockReturnValue('/path/to/schema.bprint');
    
    const { validateSchema } = await import('@chaim-tools/chaim-bprint-spec');
    vi.mocked(validateSchema).mockReturnValue(mockValidatedSchema);

    await validateCommand('/path/to/schema.bprint');

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Schema is valid'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Entity:'), 'userId');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Version:'), 'v1');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Fields:'), 2);
  });
});