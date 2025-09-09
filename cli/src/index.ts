#!/usr/bin/env node

import { Command } from 'commander';
import { generateCommand } from './commands/generate';
import { validateCommand } from './commands/validate';
import { doctorCommand } from './commands/doctor';
import chalk from 'chalk';

const program = new Command();

program
  .name('chaim')
  .description('Schema-driven code generation tool for DynamoDB')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate Java SDK from schema or CDK stack')
  .option('--stack <stackName>', 'CloudFormation stack name (recommended)')
  .option('--region <region>', 'AWS region', 'us-east-1')
  .option('--table <tableName>', 'Specific table name to generate (optional)')
  .option('--package <packageName>', 'Java package name (required)')
  .option('--output <outputDir>', 'Output directory', './src/main/java')
  .option('--skip-checks', 'Skip environment and schema validation checks')
  .action(generateCommand);

program
  .command('validate')
  .description('Validate a .bprint schema file')
  .argument('<schemaFile>', 'Schema file to validate')
  .action(validateCommand);

program
  .command('doctor')
  .description('Check system environment and dependencies')
  .action(doctorCommand);

// Show help if no command provided
if (process.argv.length <= 2) {
  console.log(chalk.blue('Chaim CLI v0.1.0'));
  console.log('Usage: chaim <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  generate  - Generate Java SDK from schema or CDK stack');
  console.log('  validate  - Validate a .bprint schema file');
  console.log('  doctor    - Check system environment and dependencies');
  console.log('');
  console.log('Use \'chaim <command> --help\' for more information');
  process.exit(0);
}

program.parse();
