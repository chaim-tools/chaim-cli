import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateCommand } from './generate';
import { CloudFormationReader } from './cloudformation-reader';
import { doctorCommand } from './doctor';
import * as snapshotDiscovery from '../services/snapshot-discovery';

// Mock dependencies
vi.mock('./cloudformation-reader');
vi.mock('./doctor');
vi.mock('../services/snapshot-discovery');
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
    
    // Default: no snapshots found
    vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue(undefined);
    vi.mocked(snapshotDiscovery.getSnapshotDirPath).mockImplementation((dir) => 
      dir || '/mock/cdk.out/chaim/snapshots'
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parameter validation', () => {
    it('should require package parameter', async () => {
      await expect(generateCommand({ stack: 'TestStack' } as any))
        .rejects.toThrow('process.exit called');
    });

    it('should require either snapshot or stack', async () => {
      // No snapshot found and no stack provided
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue(undefined);
      
      await expect(generateCommand({ package: 'com.test' } as any))
        .rejects.toThrow('process.exit called');
    });
  });

  describe('snapshot-based generation', () => {
    const mockSnapshot = {
      snapshotMode: 'PREVIEW',
      appId: 'test-app',
      schema: { entity: { name: 'User', primaryKey: { partitionKey: 'id' } } },
      dataStore: {
        type: 'dynamodb',
        tableName: 'Users',
        tableArn: 'arn:aws:dynamodb:us-east-1:123456789012:table/Users',
        region: 'us-east-1',
        partitionKey: 'id',
      },
      context: {
        stackName: 'TestStack',
        region: 'us-east-1',
        account: '123456789012',
      },
      capturedAt: '2024-01-15T10:00:00.000Z',
    };

    it('should generate from preview snapshot when available', async () => {
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue({
        modeUsed: 'preview',
        filePath: '/mock/snapshots/preview/TestStack.json',
        snapshot: mockSnapshot,
        stackName: 'TestStack',
      });

      const consoleLogSpy = vi.spyOn(console, 'log');

      const options = {
        package: 'com.test',
        output: './output',
        skipChecks: true,
      };

      await generateCommand(options);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Generating from PREVIEW snapshot')
      );
    });

    it('should generate from registered snapshot when available', async () => {
      const registeredSnapshot = {
        ...mockSnapshot,
        snapshotMode: 'REGISTERED',
        eventId: '550e8400-e29b-41d4-a716-446655440000',
        contentHash: 'sha256:abc123',
      };

      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue({
        modeUsed: 'registered',
        filePath: '/mock/snapshots/registered/TestStack-550e8400.json',
        snapshot: registeredSnapshot,
        stackName: 'TestStack',
      });

      const consoleLogSpy = vi.spyOn(console, 'log');

      const options = {
        package: 'com.test',
        output: './output',
        skipChecks: true,
      };

      await generateCommand(options);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Generating from REGISTERED snapshot')
      );
    });

    it('should use specified mode when --mode is provided', async () => {
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue({
        modeUsed: 'preview',
        filePath: '/mock/snapshots/preview/TestStack.json',
        snapshot: mockSnapshot,
        stackName: 'TestStack',
      });

      const options = {
        package: 'com.test',
        output: './output',
        mode: 'preview',
        skipChecks: true,
      };

      await generateCommand(options);

      expect(snapshotDiscovery.resolveSnapshot).toHaveBeenCalledWith(
        expect.any(String),
        'preview',
        undefined
      );
    });

    it('should use auto mode by default', async () => {
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue({
        modeUsed: 'registered',
        filePath: '/mock/snapshots/registered/TestStack.json',
        snapshot: { ...mockSnapshot, snapshotMode: 'REGISTERED' },
        stackName: 'TestStack',
      });

      const options = {
        package: 'com.test',
        output: './output',
        skipChecks: true,
      };

      await generateCommand(options);

      expect(snapshotDiscovery.resolveSnapshot).toHaveBeenCalledWith(
        expect.any(String),
        'auto',
        undefined
      );
    });

    it('should filter by stack name when --stack is provided', async () => {
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue({
        modeUsed: 'preview',
        filePath: '/mock/snapshots/preview/MyStack.json',
        snapshot: mockSnapshot,
        stackName: 'MyStack',
      });

      const options = {
        stack: 'MyStack',
        package: 'com.test',
        output: './output',
        skipChecks: true,
      };

      await generateCommand(options);

      expect(snapshotDiscovery.resolveSnapshot).toHaveBeenCalledWith(
        expect.any(String),
        'auto',
        'MyStack'
      );
    });

    it('should use custom snapshot directory when --snapshot-dir is provided', async () => {
      vi.mocked(snapshotDiscovery.getSnapshotDirPath).mockReturnValue('/custom/snapshots');
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue({
        modeUsed: 'preview',
        filePath: '/custom/snapshots/preview/TestStack.json',
        snapshot: mockSnapshot,
        stackName: 'TestStack',
      });

      const options = {
        package: 'com.test',
        output: './output',
        snapshotDir: '/custom/snapshots',
        skipChecks: true,
      };

      await generateCommand(options);

      expect(snapshotDiscovery.getSnapshotDirPath).toHaveBeenCalledWith('/custom/snapshots');
    });
  });

  describe('CloudFormation fallback', () => {
    it('should fall back to CloudFormation when no snapshot found', async () => {
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue(undefined);

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

      await generateCommand(options);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('No snapshot found, falling back to CloudFormation')
      );
      expect(mockReader.readStackOutputs).toHaveBeenCalled();
    });

    it('should run pre-generation checks by default', async () => {
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue(undefined);

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

      await generateCommand(options);

      expect(doctorCommand).toHaveBeenCalled();
    });

    it('should skip pre-generation checks when skipChecks is true', async () => {
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue(undefined);

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

      await generateCommand(options);

      expect(doctorCommand).not.toHaveBeenCalled();
    });

    it('should generate SDK for all tables from CloudFormation', async () => {
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue(undefined);

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

      await generateCommand(options);
      
      expect(mockReader.readStackOutputs).toHaveBeenCalledWith('TestStack', 'us-east-1');
      expect(mockReader.listChaimTables).toHaveBeenCalledWith(mockStackOutputs);
    });

    it('should generate SDK for specific table from CloudFormation', async () => {
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue(undefined);

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

      await generateCommand(options);
      
      expect(mockReader.extractTableMetadata).toHaveBeenCalledWith(mockStackOutputs, 'Users');
    });

    it('should handle table not found in stack', async () => {
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue(undefined);

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
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue(undefined);

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
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue(undefined);

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

    it('should use custom region when provided', async () => {
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue(undefined);

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

      await generateCommand(options);
      
      expect(mockReader.readStackOutputs).toHaveBeenCalledWith('TestStack', 'us-west-2');
    });
  });

  describe('error handling', () => {
    it('should handle pre-generation checks failure', async () => {
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue(undefined);
      vi.mocked(doctorCommand).mockRejectedValue(new Error('Environment check failed'));

      const options = {
        stack: 'TestStack',
        package: 'com.test',
        output: './output'
      };

      await expect(generateCommand(options)).rejects.toThrow('process.exit called');
    });

    it('should handle Java generator failure', async () => {
      vi.mocked(snapshotDiscovery.resolveSnapshot).mockReturnValue(undefined);

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

    it('should reject invalid mode option', async () => {
      const options = {
        package: 'com.test',
        output: './output',
        mode: 'invalid',
        skipChecks: true
      };

      await expect(generateCommand(options)).rejects.toThrow('process.exit called');
    });
  });
});
