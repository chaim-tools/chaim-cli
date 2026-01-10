import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateCommand } from './generate';
import { CloudFormationReader } from './cloudformation-reader';
import { doctorCommand } from './doctor';

// Mock dependencies
vi.mock('./cloudformation-reader');
vi.mock('./doctor');
vi.mock('@chaim-tools/client-java', () => ({
  JavaGenerator: vi.fn().mockImplementation(() => ({
    generate: vi.fn()
  }))
}));

describe('generateCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should require stack parameter', async () => {
    await expect(generateCommand({ package: 'com.test' } as any))
      .rejects.toThrow('process.exit called');
  });

  it('should require package parameter', async () => {
    await expect(generateCommand({ stack: 'TestStack' } as any))
      .rejects.toThrow('process.exit called');
  });

  it('should run pre-generation checks by default', async () => {
    const mockStackOutputs = {
      getMode: () => 'oss',
      getRegion: () => 'us-east-1',
      getAccountId: () => '123456789012'
    };

    const mockReader = {
      readStackOutputs: vi.fn().mockResolvedValue(mockStackOutputs),
      listChaimTables: vi.fn().mockResolvedValue(['Users']),
      extractTableMetadata: vi.fn().mockResolvedValue({
        getSchemaData: () => ({ entity: { name: 'User', primaryKey: { partitionKey: 'id' } } }),
        getTableName: () => 'Users',
        getTableArn: () => 'arn:aws:dynamodb:us-east-1:123456789012:table/Users',
        getRegion: () => 'us-east-1'
      })
    };

    vi.mocked(CloudFormationReader).mockImplementation(() => mockReader as any);
    vi.mocked(doctorCommand).mockResolvedValue();

    const options = {
      stack: 'TestStack',
      package: 'com.test',
      output: './output'
    };

    // The generate command will call process.exit() on success, so we expect it to throw
    await expect(generateCommand(options)).rejects.toThrow('process.exit called');
    expect(doctorCommand).toHaveBeenCalled();
  });

  it('should skip pre-generation checks when skipChecks is true', async () => {
    const mockStackOutputs = {
      getMode: () => 'oss',
      getRegion: () => 'us-east-1',
      getAccountId: () => '123456789012'
    };

    const mockReader = {
      readStackOutputs: vi.fn().mockResolvedValue(mockStackOutputs),
      listChaimTables: vi.fn().mockResolvedValue(['Users']),
      extractTableMetadata: vi.fn().mockResolvedValue({
        getSchemaData: () => ({ entity: { name: 'User', primaryKey: { partitionKey: 'id' } } }),
        getTableName: () => 'Users',
        getTableArn: () => 'arn:aws:dynamodb:us-east-1:123456789012:table/Users',
        getRegion: () => 'us-east-1'
      })
    };

    vi.mocked(CloudFormationReader).mockImplementation(() => mockReader as any);

    const options = {
      stack: 'TestStack',
      package: 'com.test',
      output: './output',
      skipChecks: true
    };

    // The generate command will call process.exit() on success, so we expect it to throw
    await expect(generateCommand(options)).rejects.toThrow('process.exit called');
    expect(doctorCommand).not.toHaveBeenCalled();
  });

  it('should generate SDK for all tables', async () => {
    const mockStackOutputs = {
      getMode: () => 'oss',
      getRegion: () => 'us-east-1',
      getAccountId: () => '123456789012'
    };

    const mockReader = {
      readStackOutputs: vi.fn().mockResolvedValue(mockStackOutputs),
      listChaimTables: vi.fn().mockResolvedValue(['Users', 'Orders']),
      extractTableMetadata: vi.fn().mockResolvedValue({
        getSchemaData: () => ({ entity: { name: 'User', primaryKey: { partitionKey: 'id' } } }),
        getTableName: () => 'Users',
        getTableArn: () => 'arn:aws:dynamodb:us-east-1:123456789012:table/Users',
        getRegion: () => 'us-east-1'
      })
    };

    vi.mocked(CloudFormationReader).mockImplementation(() => mockReader as any);

    const options = {
      stack: 'TestStack',
      package: 'com.test',
      output: './output',
      skipChecks: true
    };

    await expect(generateCommand(options)).rejects.toThrow('process.exit called');
    
    expect(mockReader.readStackOutputs).toHaveBeenCalledWith('TestStack', 'us-east-1');
    expect(mockReader.listChaimTables).toHaveBeenCalledWith(mockStackOutputs);
    expect(mockReader.extractTableMetadata).toHaveBeenCalledTimes(1);
  });

  it('should generate SDK for specific table', async () => {
    const mockStackOutputs = {
      getMode: () => 'oss',
      getRegion: () => 'us-east-1',
      getAccountId: () => '123456789012'
    };

    const mockReader = {
      readStackOutputs: vi.fn().mockResolvedValue(mockStackOutputs),
      listChaimTables: vi.fn().mockResolvedValue(['Users', 'Orders']),
      extractTableMetadata: vi.fn().mockResolvedValue({
        getSchemaData: () => ({ entity: { name: 'User', primaryKey: { partitionKey: 'id' } } }),
        getTableName: () => 'Users',
        getTableArn: () => 'arn:aws:dynamodb:us-east-1:123456789012:table/Users',
        getRegion: () => 'us-east-1'
      })
    };

    vi.mocked(CloudFormationReader).mockImplementation(() => mockReader as any);

    const options = {
      stack: 'TestStack',
      package: 'com.test',
      output: './output',
      table: 'Users',
      skipChecks: true
    };

    await expect(generateCommand(options)).rejects.toThrow('process.exit called');
    
    expect(mockReader.extractTableMetadata).toHaveBeenCalledWith(mockStackOutputs, 'Users');
  });

  it('should handle table not found in stack', async () => {
    const mockStackOutputs = {
      getMode: () => 'oss',
      getRegion: () => 'us-east-1',
      getAccountId: () => '123456789012'
    };

    const mockReader = {
      readStackOutputs: vi.fn().mockResolvedValue(mockStackOutputs),
      listChaimTables: vi.fn().mockResolvedValue(['Users', 'Orders']),
      extractTableMetadata: vi.fn()
    };

    vi.mocked(CloudFormationReader).mockImplementation(() => mockReader as any);

    const options = {
      stack: 'TestStack',
      package: 'com.test',
      output: './output',
      table: 'NonExistentTable',
      skipChecks: true
    };

    await expect(generateCommand(options)).rejects.toThrow('process.exit called');
  });

  it('should handle no tables found in stack', async () => {
    const mockStackOutputs = {
      getMode: () => 'oss',
      getRegion: () => 'us-east-1',
      getAccountId: () => '123456789012'
    };

    const mockReader = {
      readStackOutputs: vi.fn().mockResolvedValue(mockStackOutputs),
      listChaimTables: vi.fn().mockResolvedValue([]),
      extractTableMetadata: vi.fn()
    };

    vi.mocked(CloudFormationReader).mockImplementation(() => mockReader as any);

    const options = {
      stack: 'TestStack',
      package: 'com.test',
      output: './output',
      skipChecks: true
    };

    await expect(generateCommand(options)).rejects.toThrow('process.exit called');
  });

  it('should handle CloudFormation reader failure', async () => {
    const mockReader = {
      readStackOutputs: vi.fn().mockRejectedValue(new Error('Stack not found')),
      listChaimTables: vi.fn(),
      extractTableMetadata: vi.fn()
    };

    vi.mocked(CloudFormationReader).mockImplementation(() => mockReader as any);

    const options = {
      stack: 'NonExistentStack',
      package: 'com.test',
      output: './output',
      skipChecks: true
    };

    await expect(generateCommand(options)).rejects.toThrow('process.exit called');
  });

  it('should handle pre-generation checks failure', async () => {
    vi.mocked(doctorCommand).mockRejectedValue(new Error('Environment check failed'));

    const options = {
      stack: 'TestStack',
      package: 'com.test',
      output: './output'
    };

    await expect(generateCommand(options)).rejects.toThrow('process.exit called');
  });

  it('should use custom region when provided', async () => {
    const mockStackOutputs = {
      getMode: () => 'oss',
      getRegion: () => 'us-west-2',
      getAccountId: () => '123456789012'
    };

    const mockReader = {
      readStackOutputs: vi.fn().mockResolvedValue(mockStackOutputs),
      listChaimTables: vi.fn().mockResolvedValue(['Users']),
      extractTableMetadata: vi.fn().mockResolvedValue({
        getSchemaData: () => ({ entity: { name: 'User', primaryKey: { partitionKey: 'id' } } }),
        getTableName: () => 'Users',
        getTableArn: () => 'arn:aws:dynamodb:us-west-2:123456789012:table/Users',
        getRegion: () => 'us-west-2'
      })
    };

    vi.mocked(CloudFormationReader).mockImplementation(() => mockReader as any);

    const options = {
      stack: 'TestStack',
      package: 'com.test',
      output: './output',
      region: 'us-west-2',
      skipChecks: true
    };

    await expect(generateCommand(options)).rejects.toThrow('process.exit called');
    
    expect(mockReader.readStackOutputs).toHaveBeenCalledWith('TestStack', 'us-west-2');
  });

  it('should use default region when not provided', async () => {
    const mockStackOutputs = {
      getMode: () => 'oss',
      getRegion: () => 'us-east-1',
      getAccountId: () => '123456789012'
    };

    const mockReader = {
      readStackOutputs: vi.fn().mockResolvedValue(mockStackOutputs),
      listChaimTables: vi.fn().mockResolvedValue(['Users']),
      extractTableMetadata: vi.fn().mockResolvedValue({
        getSchemaData: () => ({ entity: { name: 'User', primaryKey: { partitionKey: 'id' } } }),
        getTableName: () => 'Users',
        getTableArn: () => 'arn:aws:dynamodb:us-east-1:123456789012:table/Users',
        getRegion: () => 'us-east-1'
      })
    };

    vi.mocked(CloudFormationReader).mockImplementation(() => mockReader as any);

    const options = {
      stack: 'TestStack',
      package: 'com.test',
      output: './output',
      skipChecks: true
    };

    await expect(generateCommand(options)).rejects.toThrow('process.exit called');
    
    expect(mockReader.readStackOutputs).toHaveBeenCalledWith('TestStack', 'us-east-1');
  });

  it('should handle Java generator failure', async () => {
    const mockStackOutputs = {
      getMode: () => 'oss',
      getRegion: () => 'us-east-1',
      getAccountId: () => '123456789012'
    };

    const mockReader = {
      readStackOutputs: vi.fn().mockResolvedValue(mockStackOutputs),
      listChaimTables: vi.fn().mockResolvedValue(['Users']),
      extractTableMetadata: vi.fn().mockResolvedValue({
        getSchemaData: () => ({ entity: { name: 'User', primaryKey: { partitionKey: 'id' } } }),
        getTableName: () => 'Users',
        getTableArn: () => 'arn:aws:dynamodb:us-east-1:123456789012:table/Users',
        getRegion: () => 'us-east-1'
      })
    };

    vi.mocked(CloudFormationReader).mockImplementation(() => mockReader as any);

    const { JavaGenerator } = await import('@chaim-tools/client-java');
    const mockGenerator = {
      generate: vi.fn().mockRejectedValue(new Error('Java generation failed'))
    };
    vi.mocked(JavaGenerator).mockImplementation(() => mockGenerator as any);

    const options = {
      stack: 'TestStack',
      package: 'com.test',
      output: './output',
      skipChecks: true
    };

    await expect(generateCommand(options)).rejects.toThrow('process.exit called');
  });

  it('should display generation success information', async () => {
    const mockStackOutputs = {
      getMode: () => 'oss',
      getRegion: () => 'us-east-1',
      getAccountId: () => '123456789012'
    };

    const mockReader = {
      readStackOutputs: vi.fn().mockResolvedValue(mockStackOutputs),
      listChaimTables: vi.fn().mockResolvedValue(['Users']),
      extractTableMetadata: vi.fn().mockResolvedValue({
        getSchemaData: () => ({ entity: { name: 'User', primaryKey: { partitionKey: 'id' } } }),
        getTableName: () => 'Users',
        getTableArn: () => 'arn:aws:dynamodb:us-east-1:123456789012:table/Users',
        getRegion: () => 'us-east-1'
      })
    };

    vi.mocked(CloudFormationReader).mockImplementation(() => mockReader as any);

    const consoleLogSpy = vi.spyOn(console, 'log');

    const options = {
      stack: 'TestStack',
      package: 'com.test',
      output: './output',
      skipChecks: true
    };

    await expect(generateCommand(options)).rejects.toThrow('process.exit called');

    expect(consoleLogSpy).toHaveBeenCalledWith('  Mode:', 'oss');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Region:', 'us-east-1');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Account:', '123456789012');
    expect(consoleLogSpy).toHaveBeenCalledWith('  Available tables:', 'Users');
  });
});
