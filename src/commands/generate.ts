import chalk from 'chalk';
import ora from 'ora';
import { JavaGenerator } from '@chaim-tools/client-java';
import { doctorCommand } from './doctor';
import {
  resolveSnapshot,
  getSnapshotDirPath,
  SnapshotModeOption,
  DEFAULT_SNAPSHOT_DIR,
  listSnapshots,
} from '../services/snapshot-discovery';
import * as path from 'path';

interface GenerateOptions {
  stack?: string;
  table?: string;
  package: string;
  output: string;
  snapshotDir?: string;
  mode?: string;
  skipChecks?: boolean;
}

export async function generateCommand(options: GenerateOptions): Promise<void> {
  try {
    // Validation
    if (!options.package) {
      console.error(chalk.red('Error: --package is required'));
      process.exit(1);
    }

    // Pre-generation checks (unless skipped)
    if (!options.skipChecks) {
      await runPreGenerationChecks();
    }

    // Normalize mode option
    const requestedMode = normalizeMode(options.mode);
    const snapshotDir = getSnapshotDirPath(options.snapshotDir || DEFAULT_SNAPSHOT_DIR);

    // Resolve snapshot - snapshots are REQUIRED
    const resolvedSnapshot = resolveSnapshot(snapshotDir, requestedMode, options.stack);

    if (resolvedSnapshot) {
      // Generate from snapshot
      await generateFromSnapshot(resolvedSnapshot, options);
    } else {
      // No snapshot found - provide helpful error message
      printSnapshotNotFoundError(snapshotDir, requestedMode, options.stack);
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red('✗ Generation failed:'), error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Print a helpful error message when no snapshot is found.
 */
function printSnapshotNotFoundError(snapshotDir: string, mode: SnapshotModeOption, stackFilter?: string): void {
  console.error(chalk.red('\n✗ No snapshot found'));
  console.error('');
  console.error(chalk.yellow('Chaim requires a snapshot from chaim-cdk as a prerequisite.'));
  console.error('');
  console.error(chalk.white('To create a snapshot, run one of the following in your CDK project:'));
  console.error('');
  console.error(chalk.cyan('  # For development (preview mode):'));
  console.error(chalk.white('  cdk synth'));
  console.error('');
  console.error(chalk.cyan('  # For production (registered mode):'));
  console.error(chalk.white('  cdk deploy'));
  console.error('');
  console.error(chalk.white('Expected snapshot location:'));
  console.error(chalk.gray(`  ${snapshotDir}/preview/<stackName>.json`));
  console.error(chalk.gray(`  ${snapshotDir}/registered/<stackName>-<eventId>.json`));
  console.error('');
  
  if (stackFilter) {
    console.error(chalk.white(`Searched for stack: ${stackFilter}`));
  }
  if (mode !== 'auto') {
    console.error(chalk.white(`Searched in mode: ${mode}`));
  }
  
  // Show what snapshots DO exist (if any)
  const existingSnapshots = listSnapshots(snapshotDir);
  if (existingSnapshots.length > 0) {
    console.error('');
    console.error(chalk.white('Found snapshots (but none matched your criteria):'));
    for (const snap of existingSnapshots.slice(0, 5)) {
      console.error(chalk.gray(`  - ${snap.stackName} (${snap.mode})`));
    }
    if (existingSnapshots.length > 5) {
      console.error(chalk.gray(`  ... and ${existingSnapshots.length - 5} more`));
    }
  }
}

/**
 * Normalize the mode option to a valid SnapshotModeOption.
 */
function normalizeMode(mode?: string): SnapshotModeOption {
  if (!mode || mode === 'auto') {
    return 'auto';
  }
  if (mode === 'preview' || mode === 'registered') {
    return mode;
  }
  console.error(chalk.red(`Error: Invalid mode '${mode}'. Must be 'preview', 'registered', or 'auto'`));
  process.exit(1);
}

async function runPreGenerationChecks(): Promise<void> {
  const spinner = ora('Running pre-generation checks...').start();
  
  try {
    // Run environment checks (capture output to avoid duplicate messages)
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    
    console.log = () => {}; // Suppress doctor output
    console.error = () => {}; // Suppress doctor errors
    
    await doctorCommand();
    
    // Restore console
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    
    spinner.succeed('Pre-generation checks passed');
  } catch (error) {
    spinner.fail('Pre-generation checks failed');
    throw new Error(`Environment validation failed: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Generate SDK from a resolved snapshot file.
 */
async function generateFromSnapshot(
  resolved: { modeUsed: string; filePath: string; snapshot: any; stackName: string },
  options: GenerateOptions
): Promise<void> {
  const modeLabel = resolved.modeUsed.toUpperCase();
  const modeDescription = resolved.modeUsed === 'preview'
    ? 'cdk synth output'
    : 'deploy/ingest commit';

  console.log(chalk.blue(`Generating from ${modeLabel} snapshot (${modeDescription})`));
  console.log(chalk.green('  Snapshot file:'), resolved.filePath);
  console.log(chalk.green('  Stack name:'), resolved.stackName);

  const snapshot = resolved.snapshot;
  
  // Extract schema and metadata from snapshot
  const schema = snapshot.schema;
  const dataStore = snapshot.dataStore;
  const context = snapshot.context;

  console.log(chalk.green('  App ID:'), snapshot.appId);
  console.log(chalk.green('  Captured at:'), snapshot.capturedAt || snapshot.timestamp);
  
  if (snapshot.snapshotMode === 'REGISTERED') {
    console.log(chalk.green('  Event ID:'), snapshot.eventId);
  }

  // Create a table metadata adapter for the Java generator
  const tableMetadata = createTableMetadataFromSnapshot(dataStore, context);

  // Handle table filtering
  if (options.table) {
    // For now, snapshot only contains one table's data
    // In the future, we may support multi-table snapshots
    if (dataStore.tableName !== options.table && dataStore.name !== options.table) {
      console.error(chalk.red(`Error: Table '${options.table}' not found in snapshot`));
      console.error(chalk.red('Snapshot contains table:'), dataStore.tableName || dataStore.name);
      process.exit(1);
    }
  }

  const spinner = ora(`Generating SDK from snapshot`).start();

  try {
    const javaGenerator = new JavaGenerator();
    await javaGenerator.generate(schema, options.package, options.output, tableMetadata);

    spinner.succeed('SDK generated successfully');
    console.log(chalk.green('  Output directory:'), path.resolve(options.output));
    console.log(chalk.green('  Package:'), options.package);
    console.log(chalk.green('  Entity:'), schema.entity?.name || 'Unknown');
    console.log(chalk.green('  Table:'), dataStore.tableName || dataStore.name);
  } catch (error) {
    spinner.fail('Failed to generate SDK');
    throw error;
  }
}

/**
 * Create a table metadata object compatible with the Java generator from snapshot data.
 */
function createTableMetadataFromSnapshot(dataStore: any, context: any): any {
  return {
    getSchemaData: () => null, // Schema is passed separately
    getTableName: () => dataStore.tableName || dataStore.name,
    getTableArn: () => dataStore.tableArn || dataStore.arn,
    getRegion: () => context?.region || dataStore.region,
    getPartitionKey: () => dataStore.partitionKey,
    getSortKey: () => dataStore.sortKey,
    getGlobalSecondaryIndexes: () => dataStore.globalSecondaryIndexes,
    getLocalSecondaryIndexes: () => dataStore.localSecondaryIndexes,
  };
}

