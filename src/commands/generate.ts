import chalk from 'chalk';
import ora from 'ora';
import { JavaGenerator } from '@chaim-tools/client-java';
import { doctorCommand } from './doctor';
import {
  resolveAllSnapshots,
  getSnapshotDirPath,
  listSnapshots,
  DiscoveryOptions,
  ResolvedSnapshot,
} from '../services/snapshot-discovery';
import { getSnapshotBaseDir } from '../services/os-cache-paths';
import {
  DynamoDBMetadata,
  StackContext,
  TableMetadata,
} from '../types';
import * as path from 'path';

interface GenerateOptions {
  stack?: string;
  package: string;
  output: string;
  snapshotDir?: string;
  skipChecks?: boolean;
}

export async function generateCommand(options: GenerateOptions): Promise<void> {
  try {
    // Validate required options
    if (!options.package) {
      console.error(chalk.red('Error: --package is required'));
      console.error(chalk.gray('  Example: chaim generate --package com.mycompany.myapp.model'));
      process.exit(1);
    }

    // Pre-generation checks (unless skipped)
    if (!options.skipChecks) {
      await runPreGenerationChecks();
    }

    // Use OS cache by default, or override if specified
    const snapshotDir = options.snapshotDir 
      ? getSnapshotDirPath(options.snapshotDir) 
      : getSnapshotBaseDir();

    // Build discovery options from CLI args (only --stack filter)
    const discoveryOptions: DiscoveryOptions = {
      stackName: options.stack,
    };

    // Resolve all matching snapshots
    const resolvedSnapshots = resolveAllSnapshots(snapshotDir, discoveryOptions);

    if (resolvedSnapshots.length === 0) {
      // No snapshots found - provide helpful error message
      printSnapshotNotFoundError(snapshotDir, discoveryOptions);
      process.exit(1);
    }

    // Generate from all matching snapshots
    await generateFromSnapshots(resolvedSnapshots, options);

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
function printSnapshotNotFoundError(snapshotDir: string, options: DiscoveryOptions): void {
  console.error(chalk.red('\n✗ No snapshot found'));
  console.error('');
  console.error(chalk.yellow('Chaim requires a LOCAL snapshot from chaim-cdk.'));
  console.error('');
  console.error(chalk.white('To create a snapshot, run one of the following in your CDK project:'));
  console.error('');
  console.error(chalk.cyan('  # Synthesize (creates LOCAL snapshot in cache):'));
  console.error(chalk.white('  cdk synth'));
  console.error('');
  console.error(chalk.cyan('  # Or deploy (also creates LOCAL snapshot):'));
  console.error(chalk.white('  cdk deploy'));
  console.error('');
  console.error(chalk.white('Expected snapshot location (OS cache):'));
  console.error(chalk.gray(`  ${snapshotDir}/aws/{accountId}/{region}/{stackName}/{datastoreType}/{resourceId}.json`));
  console.error('');

  // Show applied filters
  if (options.stackName) {
    console.error(chalk.white('Stack filter applied:'), options.stackName);
    console.error('');
  }

  // Show what snapshots DO exist (if any)
  const existingSnapshots = listSnapshots(snapshotDir);
  if (existingSnapshots.length > 0) {
    console.error(chalk.white('Found snapshots (but none matched your criteria):'));

    // Group by account/region/stack for cleaner output
    const grouped = new Map<string, typeof existingSnapshots>();
    for (const snap of existingSnapshots) {
      const key = `${snap.accountId}/${snap.region}/${snap.stackName}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(snap);
    }

    let shown = 0;
    for (const [key, snaps] of grouped) {
      if (shown >= 5) {
        console.error(chalk.gray(`  ... and ${grouped.size - 5} more locations`));
        break;
      }
      const [acct, reg, stack] = key.split('/');
      console.error(chalk.gray(`  Account: ${acct} / Region: ${reg} / Stack: ${stack}`));
      for (const snap of snaps.slice(0, 3)) {
        console.error(chalk.gray(`    - ${snap.entityName} (${snap.resourceName})`));
      }
      if (snaps.length > 3) {
        console.error(chalk.gray(`    ... and ${snaps.length - 3} more entities`));
      }
      shown++;
    }
    console.error('');
    console.error(chalk.white('Hint: Use --stack <stackName> to filter to a specific stack.'));
  }
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
 * Generate SDK from multiple resolved snapshots.
 */
async function generateFromSnapshots(
  snapshots: ResolvedSnapshot[],
  options: GenerateOptions
): Promise<void> {
  console.log(chalk.blue(`\nGenerating from ${snapshots.length} LOCAL snapshot(s)`));
  console.log('');

  // Group snapshots by account/region/stack for organized output
  const grouped = new Map<string, ResolvedSnapshot[]>();
  for (const snap of snapshots) {
    const key = `${snap.accountId}/${snap.region}/${snap.stackName}/${snap.datastoreType}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(snap);
  }

  const results: { entity: string; resource: string; success: boolean; error?: string }[] = [];
  const spinner = ora('Generating SDK...').start();

  try {
    for (const [key, groupSnapshots] of grouped) {
      const [acct, reg, stack, dsType] = key.split('/');
      spinner.text = `Generating for ${stack}/${dsType}...`;

      for (const resolved of groupSnapshots) {
        const snapshot = resolved.snapshot;
        const schema = snapshot.schema;
        const dataStore = snapshot.dataStore;
        const context = snapshot.context;

        // Use --package for Java package location (required)
        // schema.namespace is the entity/domain name, not the Java package
        const packageName = options.package;

        // Create a table metadata adapter for the Java generator
        const tableMetadata = createTableMetadataFromSnapshot(dataStore, context);

        try {
          const javaGenerator = new JavaGenerator();
          await javaGenerator.generate(schema, packageName, options.output, tableMetadata);

          results.push({
            entity: resolved.entityName,
            resource: resolved.resourceName,
            success: true,
          });
        } catch (error) {
          results.push({
            entity: resolved.entityName,
            resource: resolved.resourceName,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    spinner.stop();

    // Print summary
    console.log('');
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    for (const [key, groupSnapshots] of grouped) {
      const [acct, reg, stack, dsType] = key.split('/');
      console.log(chalk.cyan(`  Account: ${acct} / Region: ${reg}`));
      console.log(chalk.cyan(`    Stack: ${stack} / DataStore: ${dsType}`));

      for (const snap of groupSnapshots) {
        const result = results.find((r) => r.entity === snap.entityName && r.resource === snap.resourceName);
        if (result?.success) {
          console.log(chalk.green(`      ✓ ${snap.entityName}.java (${snap.resourceName})`));
        } else {
          console.log(chalk.red(`      ✗ ${snap.entityName}.java (${snap.resourceName}) - ${result?.error}`));
        }
      }
    }

    console.log('');
    if (failCount === 0) {
      console.log(chalk.green(`✓ Generated ${successCount} entity/entities successfully`));
    } else {
      console.log(chalk.yellow(`Generated ${successCount} entity/entities, ${failCount} failed`));
    }

    console.log(chalk.green('  Output directory:'), path.resolve(options.output));
    console.log(chalk.green('  Package:'), options.package);

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    spinner.fail('Failed to generate SDK');
    throw error;
  }
}

/**
 * Resolve region value, handling 'unknown' from CDK tokens.
 * 
 * When CDK synthesizes with unresolved tokens (e.g., environment-agnostic stacks),
 * it writes 'unknown' to the snapshot. This function resolves to actual region
 * from environment variables or falls back to a sensible default.
 */
function resolveRegion(snapshotRegion: string | undefined): string {
  if (snapshotRegion && snapshotRegion !== 'unknown') {
    return snapshotRegion;
  }
  // Try AWS environment variables
  return process.env.AWS_REGION 
    || process.env.AWS_DEFAULT_REGION 
    || 'us-east-1';
}

/**
 * Create a table metadata object compatible with the Java generator from snapshot data.
 * 
 * IMPORTANT: This returns a plain object with properties, NOT getter functions.
 * The JavaGenerator serializes this to JSON via JSON.stringify(), and arrow functions
 * are not JSON-serializable (they get stripped). Plain properties work correctly.
 * 
 * Handles 'unknown' values from CDK tokens by resolving from environment.
 */
function createTableMetadataFromSnapshot(dataStore: DynamoDBMetadata, context: StackContext): TableMetadata {
  // Resolve region - prefer context, fall back to dataStore, resolve 'unknown'
  const contextRegion = resolveRegion(context?.region);
  const dataStoreRegion = resolveRegion(dataStore.region);
  const resolvedRegion = (contextRegion !== 'us-east-1' || !dataStore.region) 
    ? contextRegion 
    : dataStoreRegion;

  return {
    tableName: dataStore.tableName || dataStore.name,
    tableArn: dataStore.tableArn || dataStore.arn,
    region: resolvedRegion,
    partitionKey: dataStore.partitionKey,
    sortKey: dataStore.sortKey,
    globalSecondaryIndexes: dataStore.globalSecondaryIndexes,
    localSecondaryIndexes: dataStore.localSecondaryIndexes,
  };
}
