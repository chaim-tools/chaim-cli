import * as fs from 'fs';
import * as path from 'path';

/**
 * Snapshot mode enum.
 */
export type SnapshotMode = 'preview' | 'registered';

/**
 * Auto mode: automatically select the best available snapshot mode.
 */
export type SnapshotModeOption = SnapshotMode | 'auto';

/**
 * Default base directory for Chaim snapshots.
 */
export const DEFAULT_SNAPSHOT_DIR = 'cdk.out/chaim/snapshots';

/**
 * Information about a discovered snapshot file.
 */
export interface SnapshotFileInfo {
  /** Full path to the snapshot file */
  filePath: string;
  /** Stack name extracted from filename */
  stackName: string;
  /** Snapshot mode (preview or registered) */
  mode: SnapshotMode;
  /** Last modification time */
  mtime: Date;
  /** Event ID (only for registered snapshots) */
  eventId?: string;
}

/**
 * Result of resolving a snapshot.
 */
export interface ResolvedSnapshot {
  /** The mode that was ultimately used */
  modeUsed: SnapshotMode;
  /** Full path to the snapshot file */
  filePath: string;
  /** Parsed snapshot content */
  snapshot: any;
  /** Stack name */
  stackName: string;
}

/**
 * Parse a preview snapshot filename.
 * Format: <stackName>.json
 */
function parsePreviewFilename(filename: string): { stackName: string } | null {
  if (!filename.endsWith('.json')) {
    return null;
  }
  const stackName = filename.slice(0, -5); // Remove .json
  if (!stackName) {
    return null;
  }
  return { stackName };
}

/**
 * Parse a registered snapshot filename.
 * Format: <stackName>-<eventId>.json
 */
function parseRegisteredFilename(filename: string): { stackName: string; eventId: string } | null {
  if (!filename.endsWith('.json')) {
    return null;
  }
  const baseName = filename.slice(0, -5); // Remove .json
  
  // UUID v4 pattern: 8-4-4-4-12 hex chars
  const uuidPattern = /^(.+)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
  const match = baseName.match(uuidPattern);
  
  if (!match) {
    return null;
  }
  
  return {
    stackName: match[1],
    eventId: match[2],
  };
}

/**
 * List all snapshot files in a specific mode directory.
 * 
 * @param snapshotDir - Base snapshot directory (e.g., cdk.out/chaim/snapshots)
 * @param mode - Snapshot mode to list (preview or registered)
 * @returns Array of snapshot file info, sorted by mtime descending (newest first)
 */
export function listSnapshots(snapshotDir: string, mode: SnapshotMode): SnapshotFileInfo[] {
  const modeDir = path.join(snapshotDir, mode);
  
  if (!fs.existsSync(modeDir)) {
    return [];
  }
  
  const files = fs.readdirSync(modeDir);
  const snapshots: SnapshotFileInfo[] = [];
  
  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }
    
    const filePath = path.join(modeDir, file);
    const stat = fs.statSync(filePath);
    
    if (!stat.isFile()) {
      continue;
    }
    
    if (mode === 'preview') {
      const parsed = parsePreviewFilename(file);
      if (parsed) {
        snapshots.push({
          filePath,
          stackName: parsed.stackName,
          mode: 'preview',
          mtime: stat.mtime,
        });
      }
    } else {
      const parsed = parseRegisteredFilename(file);
      if (parsed) {
        snapshots.push({
          filePath,
          stackName: parsed.stackName,
          mode: 'registered',
          mtime: stat.mtime,
          eventId: parsed.eventId,
        });
      }
    }
  }
  
  // Sort by mtime descending (newest first)
  snapshots.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  
  return snapshots;
}

/**
 * List all snapshots for a specific stack.
 * 
 * @param snapshotDir - Base snapshot directory
 * @param mode - Snapshot mode to list
 * @param stackName - Stack name to filter by
 * @returns Array of snapshot file info for the stack, sorted by mtime descending
 */
export function listSnapshotsForStack(
  snapshotDir: string,
  mode: SnapshotMode,
  stackName: string
): SnapshotFileInfo[] {
  const allSnapshots = listSnapshots(snapshotDir, mode);
  return allSnapshots.filter(s => s.stackName === stackName);
}

/**
 * Get the latest snapshot for a specific mode.
 * 
 * @param snapshotDir - Base snapshot directory
 * @param mode - Snapshot mode
 * @param stackName - Optional stack name to filter by
 * @returns The latest snapshot file info, or undefined if none found
 */
export function getLatestSnapshot(
  snapshotDir: string,
  mode: SnapshotMode,
  stackName?: string
): SnapshotFileInfo | undefined {
  const snapshots = stackName
    ? listSnapshotsForStack(snapshotDir, mode, stackName)
    : listSnapshots(snapshotDir, mode);
  
  return snapshots[0]; // Already sorted by mtime descending
}

/**
 * Check if a snapshot directory has any snapshots for a mode.
 * 
 * @param snapshotDir - Base snapshot directory
 * @param mode - Snapshot mode to check
 * @returns True if at least one snapshot exists
 */
export function hasSnapshots(snapshotDir: string, mode: SnapshotMode): boolean {
  const modeDir = path.join(snapshotDir, mode);
  
  if (!fs.existsSync(modeDir)) {
    return false;
  }
  
  const files = fs.readdirSync(modeDir);
  return files.some(f => f.endsWith('.json'));
}

/**
 * Resolve which snapshot to use based on the requested mode.
 * 
 * Auto mode logic:
 * 1. If registered/ has snapshots -> use registered
 * 2. Else if preview/ has snapshots -> use preview
 * 3. Else -> return undefined (fall back to CloudFormation)
 * 
 * @param snapshotDir - Base snapshot directory
 * @param requestedMode - Requested mode (preview, registered, or auto)
 * @param stackName - Optional stack name to filter by
 * @returns Resolved snapshot info, or undefined if no snapshot found
 */
export function resolveSnapshot(
  snapshotDir: string,
  requestedMode: SnapshotModeOption,
  stackName?: string
): ResolvedSnapshot | undefined {
  let modeToUse: SnapshotMode;
  
  if (requestedMode === 'auto') {
    // Auto: prefer registered, fall back to preview
    if (stackName) {
      // If stack name provided, check for that specific stack
      if (listSnapshotsForStack(snapshotDir, 'registered', stackName).length > 0) {
        modeToUse = 'registered';
      } else if (listSnapshotsForStack(snapshotDir, 'preview', stackName).length > 0) {
        modeToUse = 'preview';
      } else {
        return undefined;
      }
    } else {
      // No stack name, check if any snapshots exist
      if (hasSnapshots(snapshotDir, 'registered')) {
        modeToUse = 'registered';
      } else if (hasSnapshots(snapshotDir, 'preview')) {
        modeToUse = 'preview';
      } else {
        return undefined;
      }
    }
  } else {
    modeToUse = requestedMode;
  }
  
  const snapshotInfo = getLatestSnapshot(snapshotDir, modeToUse, stackName);
  
  if (!snapshotInfo) {
    return undefined;
  }
  
  // Read and parse the snapshot file
  const content = fs.readFileSync(snapshotInfo.filePath, 'utf-8');
  const snapshot = JSON.parse(content);
  
  return {
    modeUsed: modeToUse,
    filePath: snapshotInfo.filePath,
    snapshot,
    stackName: snapshotInfo.stackName,
  };
}

/**
 * Get the full path to the snapshot directory.
 * 
 * @param snapshotDir - Snapshot directory (relative or absolute)
 * @returns Absolute path to the snapshot directory
 */
export function getSnapshotDirPath(snapshotDir: string = DEFAULT_SNAPSHOT_DIR): string {
  if (path.isAbsolute(snapshotDir)) {
    return snapshotDir;
  }
  return path.join(process.cwd(), snapshotDir);
}

