import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  listSnapshots,
  listSnapshotsForStack,
  getLatestSnapshot,
  hasSnapshots,
  resolveSnapshot,
  getSnapshotDirPath,
  DEFAULT_SNAPSHOT_DIR,
} from './snapshot-discovery';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

describe('snapshot-discovery', () => {
  const mockCwd = '/mock/project';
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSnapshotDirPath', () => {
    it('should return absolute path for relative directory', () => {
      const result = getSnapshotDirPath('cdk.out/chaim/snapshots');
      expect(result).toBe(path.join(mockCwd, 'cdk.out/chaim/snapshots'));
    });

    it('should return absolute path unchanged', () => {
      const result = getSnapshotDirPath('/absolute/path/to/snapshots');
      expect(result).toBe('/absolute/path/to/snapshots');
    });

    it('should use default directory when not specified', () => {
      const result = getSnapshotDirPath();
      expect(result).toBe(path.join(mockCwd, DEFAULT_SNAPSHOT_DIR));
    });
  });

  describe('listSnapshots', () => {
    it('should return empty array when directory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const result = listSnapshots('/snapshots', 'preview');
      
      expect(result).toEqual([]);
    });

    it('should list preview snapshots correctly', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['MyStack.json', 'OtherStack.json'] as any);
      vi.mocked(fs.statSync).mockImplementation((filePath: any) => ({
        isFile: () => true,
        mtime: new Date('2024-01-15'),
      } as any));
      
      const result = listSnapshots('/snapshots', 'preview');
      
      expect(result).toHaveLength(2);
      expect(result[0].stackName).toBe('MyStack');
      expect(result[0].mode).toBe('preview');
      expect(result[1].stackName).toBe('OtherStack');
    });

    it('should list registered snapshots with eventId', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'MyStack-550e8400-e29b-41d4-a716-446655440000.json',
      ] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        mtime: new Date('2024-01-15'),
      } as any);
      
      const result = listSnapshots('/snapshots', 'registered');
      
      expect(result).toHaveLength(1);
      expect(result[0].stackName).toBe('MyStack');
      expect(result[0].mode).toBe('registered');
      expect(result[0].eventId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should sort by mtime descending (newest first)', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['Old.json', 'New.json'] as any);
      vi.mocked(fs.statSync).mockImplementation((filePath: any) => {
        const isNew = (filePath as string).includes('New');
        return {
          isFile: () => true,
          mtime: isNew ? new Date('2024-01-20') : new Date('2024-01-10'),
        } as any;
      });
      
      const result = listSnapshots('/snapshots', 'preview');
      
      expect(result[0].stackName).toBe('New');
      expect(result[1].stackName).toBe('Old');
    });

    it('should ignore non-json files', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['MyStack.json', 'readme.txt', '.hidden'] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        mtime: new Date('2024-01-15'),
      } as any);
      
      const result = listSnapshots('/snapshots', 'preview');
      
      expect(result).toHaveLength(1);
      expect(result[0].stackName).toBe('MyStack');
    });
  });

  describe('listSnapshotsForStack', () => {
    it('should filter snapshots by stack name', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['StackA.json', 'StackB.json'] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        mtime: new Date('2024-01-15'),
      } as any);
      
      const result = listSnapshotsForStack('/snapshots', 'preview', 'StackA');
      
      expect(result).toHaveLength(1);
      expect(result[0].stackName).toBe('StackA');
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return the most recent snapshot', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['Old.json', 'New.json'] as any);
      vi.mocked(fs.statSync).mockImplementation((filePath: any) => {
        const isNew = (filePath as string).includes('New');
        return {
          isFile: () => true,
          mtime: isNew ? new Date('2024-01-20') : new Date('2024-01-10'),
        } as any;
      });
      
      const result = getLatestSnapshot('/snapshots', 'preview');
      
      expect(result?.stackName).toBe('New');
    });

    it('should return undefined when no snapshots exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const result = getLatestSnapshot('/snapshots', 'preview');
      
      expect(result).toBeUndefined();
    });

    it('should filter by stack name when provided', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['StackA.json', 'StackB.json'] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        mtime: new Date('2024-01-15'),
      } as any);
      
      const result = getLatestSnapshot('/snapshots', 'preview', 'StackB');
      
      expect(result?.stackName).toBe('StackB');
    });
  });

  describe('hasSnapshots', () => {
    it('should return true when snapshots exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['MyStack.json'] as any);
      
      const result = hasSnapshots('/snapshots', 'preview');
      
      expect(result).toBe(true);
    });

    it('should return false when directory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const result = hasSnapshots('/snapshots', 'preview');
      
      expect(result).toBe(false);
    });

    it('should return false when no json files exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['readme.txt'] as any);
      
      const result = hasSnapshots('/snapshots', 'preview');
      
      expect(result).toBe(false);
    });
  });

  describe('resolveSnapshot', () => {
    const mockSnapshot = {
      snapshotMode: 'PREVIEW',
      appId: 'test-app',
      schema: { entity: { name: 'User' } },
      dataStore: { type: 'dynamodb' },
    };

    it('should use preview when mode is preview', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['MyStack.json'] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        mtime: new Date('2024-01-15'),
      } as any);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSnapshot));
      
      const result = resolveSnapshot('/snapshots', 'preview');
      
      expect(result?.modeUsed).toBe('preview');
    });

    it('should use registered when mode is registered', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'MyStack-550e8400-e29b-41d4-a716-446655440000.json',
      ] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        mtime: new Date('2024-01-15'),
      } as any);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ ...mockSnapshot, snapshotMode: 'REGISTERED' }));
      
      const result = resolveSnapshot('/snapshots', 'registered');
      
      expect(result?.modeUsed).toBe('registered');
    });

    it('should prefer registered over preview in auto mode', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockImplementation((dir: any) => {
        if ((dir as string).includes('registered')) {
          return ['MyStack-550e8400-e29b-41d4-a716-446655440000.json'] as any;
        }
        return ['MyStack.json'] as any;
      });
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        mtime: new Date('2024-01-15'),
      } as any);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ ...mockSnapshot, snapshotMode: 'REGISTERED' }));
      
      const result = resolveSnapshot('/snapshots', 'auto');
      
      expect(result?.modeUsed).toBe('registered');
    });

    it('should fall back to preview when registered is empty in auto mode', () => {
      vi.mocked(fs.existsSync).mockImplementation((dir: any) => {
        return (dir as string).includes('preview');
      });
      vi.mocked(fs.readdirSync).mockReturnValue(['MyStack.json'] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        mtime: new Date('2024-01-15'),
      } as any);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSnapshot));
      
      const result = resolveSnapshot('/snapshots', 'auto');
      
      expect(result?.modeUsed).toBe('preview');
    });

    it('should return undefined when no snapshots found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const result = resolveSnapshot('/snapshots', 'auto');
      
      expect(result).toBeUndefined();
    });

    it('should parse and return snapshot content', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['MyStack.json'] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        mtime: new Date('2024-01-15'),
      } as any);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSnapshot));
      
      const result = resolveSnapshot('/snapshots', 'preview');
      
      expect(result?.snapshot).toEqual(mockSnapshot);
      expect(result?.stackName).toBe('MyStack');
    });

    it('should filter by stack name when provided', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['StackA.json', 'StackB.json'] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        isFile: () => true,
        mtime: new Date('2024-01-15'),
      } as any);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSnapshot));
      
      const result = resolveSnapshot('/snapshots', 'preview', 'StackB');
      
      expect(result?.stackName).toBe('StackB');
    });
  });
});

