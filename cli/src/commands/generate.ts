import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { CloudFormationReader } from './cloudformation-reader';
import { JavaGenerator } from './java-generator-wrapper';
import { doctorCommand } from './doctor';
// import { validateSchema } from '../../../chaim-bprint-spec/dist/index';
import * as fs from 'fs';
import * as path from 'path';

interface GenerateOptions {
  stack?: string;
  region?: string;
  table?: string;
  package: string;
  output: string;
  skipChecks?: boolean;
}

export async function generateCommand(options: GenerateOptions): Promise<void> {
  try {
    // Validation
    if (!options.stack) {
      console.error(chalk.red('Error: --stack is required'));
      process.exit(1);
    }
    if (!options.package) {
      console.error(chalk.red('Error: --package is required'));
      process.exit(1);
    }

    // Pre-generation checks (unless skipped)
    if (!options.skipChecks) {
      await runPreGenerationChecks();
    }

    // Main generation logic
    await generateFromStack(options);
    
  } catch (error) {
    console.error(chalk.red('✗ Generation failed:'), error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
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

async function generateFromStack(options: GenerateOptions): Promise<void> {
  const spinner = ora('Reading CloudFormation stack...').start();
  
  try {
    // Read stack outputs
    const cloudFormationReader = new CloudFormationReader();
    const stackOutputs = await cloudFormationReader.readStackOutputs(options.stack!, options.region || 'us-east-1');
    
    spinner.succeed('Stack outputs read successfully');
    console.log(chalk.green('  Mode:'), stackOutputs.getMode());
    console.log(chalk.green('  Region:'), stackOutputs.getRegion());
    console.log(chalk.green('  Account:'), stackOutputs.getAccountId());
    
    // List available tables
    const availableTables = await cloudFormationReader.listChaimTables(stackOutputs);
    console.log(chalk.green('  Available tables:'), availableTables.join(', '));
    
    if (options.table && !availableTables.includes(options.table)) {
      console.error(chalk.red(`Error: Table '${options.table}' not found in stack`));
      console.error(chalk.red('Available tables:'), availableTables.join(', '));
      process.exit(1);
    }
    
    // Generate for specific table or all tables
    if (options.table) {
      await generateForTable(cloudFormationReader, stackOutputs, options.table, options);
    } else {
      await generateForAllTables(cloudFormationReader, stackOutputs, options);
    }
  } catch (error) {
    spinner.fail('Failed to read stack outputs');
    throw error;
  }
}

async function generateForTable(
  reader: CloudFormationReader,
  stackOutputs: any,
  table: string,
  options: GenerateOptions
): Promise<void> {
  const spinner = ora(`Generating SDK for table: ${table}`).start();
  
  try {
    const tableMetadata = await reader.extractTableMetadata(stackOutputs, table);
    const schemaData = tableMetadata.getSchemaData();
    
    // Convert JSON to BprintSchema
    const schema = JSON.parse(JSON.stringify(schemaData));
    
    // Validate schema (unless skipped)
    if (!options.skipChecks) {
      try {
        // validateSchema(schema);
      } catch (error) {
        throw new Error(`Schema validation failed for table '${table}': ${error instanceof Error ? error.message : error}`);
      }
    }
    
    // Generate code using Java generator
    const javaGenerator = new JavaGenerator();
    await javaGenerator.generate(schema, options.package, options.output, tableMetadata);
    
    spinner.succeed('SDK generated successfully');
    console.log(chalk.green('  Output directory:'), path.resolve(options.output));
    console.log(chalk.green('  Package:'), options.package);
    console.log(chalk.green('  Entity:'), schema.entity.name);
    console.log(chalk.green('  Table:'), table);
  } catch (error) {
    spinner.fail('Failed to generate SDK');
    throw error;
  }
}

async function generateForAllTables(
  reader: CloudFormationReader,
  stackOutputs: any,
  options: GenerateOptions
): Promise<void> {
  const tables = await reader.listChaimTables(stackOutputs);
  
  if (tables.length === 0) {
    console.error(chalk.red('Error: No Chaim tables found in stack'));
    process.exit(1);
  }
  
  const spinner = ora(`Generating SDK for ${tables.length} tables`).start();
  
  try {
    for (const table of tables) {
      console.log(chalk.blue(`  Generating for table: ${table}`));
      await generateForTable(reader, stackOutputs, table, options);
    }
    
    spinner.succeed('All tables generated successfully');
  } catch (error) {
    spinner.fail('Failed to generate SDK for all tables');
    throw error;
  }
}
