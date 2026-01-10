import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudFormationReader, ChaimStackOutputs } from './cloudformation-reader';
import { spawn } from 'child_process';

vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

describe('CloudFormationReader', () => {
  let reader: CloudFormationReader;

  beforeEach(() => {
    reader = new CloudFormationReader();
    vi.clearAllMocks();
  });

  it('should read stack outputs successfully', async () => {
    const mockOutputs = [
      { OutputKey: 'ChaimMode', OutputValue: 'oss' },
      { OutputKey: 'ChaimTableMetadata_Users', OutputValue: '{"tableName":"Users","tableArn":"arn:aws:dynamodb:us-east-1:123456789012:table/Users"}' },
      { OutputKey: 'ChaimSchemaData_Users', OutputValue: '{"entity":{"name":"User","primaryKey":{"partitionKey":"id"}}}' },
      { OutputKey: 'OtherOutput', OutputValue: 'some value' }
    ];

    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn()
    };

    vi.mocked(spawn).mockReturnValue(mockProcess as any);

    mockProcess.stdout.on.mockImplementation((event, callback) => {
      if (event === 'data') {
        callback(Buffer.from(JSON.stringify(mockOutputs)));
      }
    });

    mockProcess.on.mockImplementation((event, callback) => {
      if (event === 'close') {
        callback(0); // Success
      }
    });

    const result = await reader.readStackOutputs('TestStack', 'us-east-1');

    expect(result.getMode()).toBe('oss');
    expect(result.getRegion()).toBe('us-east-1');
    expect(result.getAccountId()).toBe('123456789012');
    expect(spawn).toHaveBeenCalledWith('aws', [
      'cloudformation',
      'describe-stacks',
      '--stack-name', 'TestStack',
      '--region', 'us-east-1',
      '--query', 'Stacks[0].Outputs',
      '--output', 'json'
    ], expect.any(Object));
  });

  it('should handle AWS CLI failure', async () => {
    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn()
    };

    vi.mocked(spawn).mockReturnValue(mockProcess as any);

    mockProcess.stderr.on.mockImplementation((event, callback) => {
      if (event === 'data') {
        callback(Buffer.from('Stack does not exist'));
      }
    });

    mockProcess.on.mockImplementation((event, callback) => {
      if (event === 'close') {
        callback(1); // Failure
      }
    });

    await expect(reader.readStackOutputs('NonExistentStack', 'us-east-1'))
      .rejects.toThrow('AWS CLI failed: Stack does not exist');
  });

  it('should handle AWS CLI process error', async () => {
    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn()
    };

    vi.mocked(spawn).mockReturnValue(mockProcess as any);

    mockProcess.on.mockImplementation((event, callback) => {
      if (event === 'error') {
        callback(new Error('AWS CLI not found'));
      }
    });

    await expect(reader.readStackOutputs('TestStack', 'us-east-1'))
      .rejects.toThrow('Failed to execute AWS CLI: AWS CLI not found');
  });

  it('should handle invalid JSON response', async () => {
    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn()
    };

    vi.mocked(spawn).mockReturnValue(mockProcess as any);

    mockProcess.stdout.on.mockImplementation((event, callback) => {
      if (event === 'data') {
        callback(Buffer.from('invalid json'));
      }
    });

    mockProcess.on.mockImplementation((event, callback) => {
      if (event === 'close') {
        callback(0); // Success
      }
    });

    await expect(reader.readStackOutputs('TestStack', 'us-east-1'))
      .rejects.toThrow('Failed to parse CloudFormation outputs');
  });

  it('should list Chaim tables from outputs', async () => {
    const mockOutputs = {
      getOutputs: () => ({
        'ChaimTableMetadata_Users': '{"tableName":"Users"}',
        'ChaimTableMetadata_Orders': '{"tableName":"Orders"}',
        'ChaimSchemaData_Users': '{"entity":{"name":"User"}}',
        'OtherOutput': 'value'
      })
    } as ChaimStackOutputs;

    const tables = await reader.listChaimTables(mockOutputs);

    expect(tables).toEqual(['Users', 'Orders']);
  });

  it('should return empty array when no Chaim tables found', async () => {
    const mockOutputs = {
      getOutputs: () => ({
        'OtherOutput': 'value',
        'AnotherOutput': 'another value'
      })
    } as ChaimStackOutputs;

    const tables = await reader.listChaimTables(mockOutputs);

    expect(tables).toEqual([]);
  });

  it('should extract table metadata successfully', async () => {
    const mockOutputs = {
      getOutput: vi.fn((key: string) => {
        if (key === 'ChaimSchemaData_Users') {
          return '{"entity":{"name":"User","primaryKey":{"partitionKey":"id"},"fields":[{"name":"id","type":"string","required":true}]}}';
        }
        if (key === 'ChaimTableMetadata_Users') {
          return '{"tableName":"Users","tableArn":"arn:aws:dynamodb:us-east-1:123456789012:table/Users","region":"us-east-1"}';
        }
        return undefined;
      })
    } as ChaimStackOutputs;

    const metadata = await reader.extractTableMetadata(mockOutputs, 'Users');

    expect(metadata.getTableName()).toBe('Users');
    expect(metadata.getTableArn()).toBe('arn:aws:dynamodb:us-east-1:123456789012:table/Users');
    expect(metadata.getRegion()).toBe('us-east-1');
    
    const schemaData = metadata.getSchemaData();
    expect(schemaData.entity.name).toBe('User');
    expect(schemaData.entity.primaryKey.partitionKey).toBe('id');
  });

  it('should handle missing table metadata', async () => {
    const mockOutputs = {
      getOutput: vi.fn(() => undefined)
    } as ChaimStackOutputs;

    await expect(reader.extractTableMetadata(mockOutputs, 'NonExistentTable'))
      .rejects.toThrow('Table metadata not found for table: NonExistentTable');
  });

  it('should handle missing schema data', async () => {
    const mockOutputs = {
      getOutput: vi.fn((key: string) => {
        if (key === 'ChaimTableMetadata_Users') {
          return '{"tableName":"Users"}';
        }
        return undefined; // Missing schema data
      })
    } as ChaimStackOutputs;

    await expect(reader.extractTableMetadata(mockOutputs, 'Users'))
      .rejects.toThrow('Table metadata not found for table: Users');
  });

  it('should handle invalid JSON in table metadata', async () => {
    const mockOutputs = {
      getOutput: vi.fn((key: string) => {
        if (key === 'ChaimSchemaData_Users') {
          return 'invalid json';
        }
        if (key === 'ChaimTableMetadata_Users') {
          return '{"tableName":"Users"}';
        }
        return undefined;
      })
    } as ChaimStackOutputs;

    await expect(reader.extractTableMetadata(mockOutputs, 'Users'))
      .rejects.toThrow();
  });

  it('should extract account ID from ARN in outputs', async () => {
    const mockOutputs = [
      { OutputKey: 'ChaimTableMetadata_Users', OutputValue: '{"tableArn":"arn:aws:dynamodb:us-east-1:123456789012:table/Users"}' }
    ];

    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn()
    };

    vi.mocked(spawn).mockReturnValue(mockProcess as any);

    mockProcess.stdout.on.mockImplementation((event, callback) => {
      if (event === 'data') {
        callback(Buffer.from(JSON.stringify(mockOutputs)));
      }
    });

    mockProcess.on.mockImplementation((event, callback) => {
      if (event === 'close') {
        callback(0);
      }
    });

    const result = await reader.readStackOutputs('TestStack', 'us-east-1');

    expect(result.getAccountId()).toBe('123456789012');
  });

  it('should return unknown account ID when no ARN found', async () => {
    const mockOutputs = [
      { OutputKey: 'ChaimMode', OutputValue: 'oss' }
    ];

    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn()
    };

    vi.mocked(spawn).mockReturnValue(mockProcess as any);

    mockProcess.stdout.on.mockImplementation((event, callback) => {
      if (event === 'data') {
        callback(Buffer.from(JSON.stringify(mockOutputs)));
      }
    });

    mockProcess.on.mockImplementation((event, callback) => {
      if (event === 'close') {
        callback(0);
      }
    });

    const result = await reader.readStackOutputs('TestStack', 'us-east-1');

    expect(result.getAccountId()).toBe('unknown');
  });

  it('should filter only Chaim-related outputs', async () => {
    const mockOutputs = [
      { OutputKey: 'ChaimMode', OutputValue: 'oss' },
      { OutputKey: 'ChaimTableMetadata_Users', OutputValue: '{"tableName":"Users"}' },
      { OutputKey: 'OtherOutput', OutputValue: 'should be filtered' },
      { OutputKey: 'AnotherOutput', OutputValue: 'should also be filtered' }
    ];

    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn()
    };

    vi.mocked(spawn).mockReturnValue(mockProcess as any);

    mockProcess.stdout.on.mockImplementation((event, callback) => {
      if (event === 'data') {
        callback(Buffer.from(JSON.stringify(mockOutputs)));
      }
    });

    mockProcess.on.mockImplementation((event, callback) => {
      if (event === 'close') {
        callback(0);
      }
    });

    const result = await reader.readStackOutputs('TestStack', 'us-east-1');
    const outputs = result.getOutputs();

    expect(outputs).toHaveProperty('ChaimMode');
    expect(outputs).toHaveProperty('ChaimTableMetadata_Users');
    expect(outputs).not.toHaveProperty('OtherOutput');
    expect(outputs).not.toHaveProperty('AnotherOutput');
  });
});
