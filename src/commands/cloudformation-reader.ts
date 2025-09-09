import { spawn } from 'child_process';
import chalk from 'chalk';

export interface ChaimStackOutputs {
  getMode(): string;
  getRegion(): string;
  getAccountId(): string;
  getOutputs(): Record<string, string>;
  getOutput(key: string): string | undefined;
}

export class CloudFormationReader {
  async readStackOutputs(stackName: string, region: string): Promise<ChaimStackOutputs> {
    return new Promise((resolve, reject) => {
      const awsProcess = spawn('aws', [
        'cloudformation',
        'describe-stacks',
        '--stack-name', stackName,
        '--region', region,
        '--query', 'Stacks[0].Outputs',
        '--output', 'json'
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      awsProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      awsProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      awsProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const outputs = JSON.parse(stdout);
            const chaimOutputs: Record<string, string> = {};
            
            // Filter for Chaim-related outputs
            for (const output of outputs) {
              if (output.OutputKey && output.OutputKey.startsWith('Chaim')) {
                chaimOutputs[output.OutputKey] = output.OutputValue;
              }
            }

            // Get account ID
            const accountId = this.extractAccountIdFromOutputs(chaimOutputs);

            resolve(new ChaimStackOutputsImpl(
              stackName,
              region,
              accountId,
              chaimOutputs
            ));
          } catch (error) {
            reject(new Error(`Failed to parse CloudFormation outputs: ${error}`));
          }
        } else {
          reject(new Error(`AWS CLI failed: ${stderr}`));
        }
      });

      awsProcess.on('error', (error) => {
        reject(new Error(`Failed to execute AWS CLI: ${error.message}`));
      });
    });
  }

  async listChaimTables(stackOutputs: ChaimStackOutputs): Promise<string[]> {
    const outputs = stackOutputs.getOutputs();
    const tables: string[] = [];
    
    for (const key of Object.keys(outputs)) {
      if (key.startsWith('ChaimTableMetadata_')) {
        const tableName = key.substring('ChaimTableMetadata_'.length);
        tables.push(tableName);
      }
    }
    
    return tables;
  }

  async extractTableMetadata(stackOutputs: ChaimStackOutputs, tableName: string): Promise<any> {
    const schemaDataKey = `ChaimSchemaData_${tableName}`;
    const tableMetadataKey = `ChaimTableMetadata_${tableName}`;
    
    const schemaDataJson = stackOutputs.getOutput(schemaDataKey);
    const tableMetadataJson = stackOutputs.getOutput(tableMetadataKey);
    
    if (!schemaDataJson || !tableMetadataJson) {
      throw new Error(`Table metadata not found for table: ${tableName}`);
    }
    
    const schemaData = JSON.parse(schemaDataJson);
    const tableMetadata = JSON.parse(tableMetadataJson);
    
    return {
      getSchemaData: () => schemaData,
      getTableName: () => tableMetadata.tableName,
      getTableArn: () => tableMetadata.tableArn,
      getRegion: () => tableMetadata.region
    };
  }

  private extractAccountIdFromOutputs(outputs: Record<string, string>): string {
    // Try to extract account ID from ARN or other outputs
    for (const value of Object.values(outputs)) {
      const arnMatch = value.match(/arn:aws:[^:]+:[^:]+:(\d+):/);
      if (arnMatch) {
        return arnMatch[1];
      }
    }
    return 'unknown';
  }
}

class ChaimStackOutputsImpl implements ChaimStackOutputs {
  constructor(
    private stackName: string,
    private region: string,
    private accountId: string,
    private outputs: Record<string, string>
  ) {}

  getMode(): string {
    return this.outputs['ChaimMode'] || 'oss';
  }

  getRegion(): string {
    return this.region;
  }

  getAccountId(): string {
    return this.accountId;
  }

  getOutputs(): Record<string, string> {
    return { ...this.outputs };
  }

  getOutput(key: string): string | undefined {
    return this.outputs[key];
  }
}
