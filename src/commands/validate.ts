import chalk from 'chalk';
import { validateSchema } from '@chaim/chaim-bprint-spec';
import * as fs from 'fs';
import * as path from 'path';

export async function validateCommand(schemaFile: string): Promise<void> {
  try {
    console.log(chalk.blue('🔍 Validating schema:'), schemaFile);
    
    // Check if file exists
    if (!fs.existsSync(schemaFile)) {
      console.error(chalk.red(`Error: Schema file not found: ${schemaFile}`));
      process.exit(1);
    }
    
    // Load and validate schema
    const schemaContent = fs.readFileSync(path.resolve(schemaFile), 'utf-8');
    const schema = JSON.parse(schemaContent);
    const validatedSchema = validateSchema(schema);
    
    console.log(chalk.green('✓ Schema is valid'));
    console.log(chalk.green('  Entity:'), validatedSchema.entity.primaryKey.partitionKey);
    console.log(chalk.green('  Version:'), validatedSchema.schemaVersion);
    console.log(chalk.green('  Fields:'), validatedSchema.entity.fields.length);
    
  } catch (error) {
    console.error(chalk.red('✗ Schema validation failed:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
