# AI Agent Context: chaim-cli

**Purpose**: Structured context for AI agents to understand and work with the chaim-cli codebase.

**Package**: `@chaim-tools/chaim` (published as `chaim` CLI binary)  
**Version**: 0.1.0  
**License**: Apache-2.0

---

## Project Overview

The chaim-cli is a **schema-driven code generation tool** that transforms `.bprint` schema definitions into complete, language-specific SDKs with data access clients, DTOs, and configuration management. It reads metadata from deployed infrastructure stacks to extract schema and resource configuration, then generates type-safe code.

**Current Implementation**: AWS (CloudFormation stacks, DynamoDB tables) with Java SDK generation.

### Key Capabilities

- **Prerequisites Management**: Verify and install all required dependencies for the current provider
- **Language-Specific SDK Generation**: Generate complete SDKs from deployed infrastructure stacks (Java-first implementation)
- **Schema Validation**: Validate `.bprint` files using `@chaim-tools/chaim-bprint-spec`
- **Environment Diagnostics**: Check system environment and dependency health
- **Infrastructure Metadata Integration**: Read stack outputs to extract Chaim metadata (AWS/CloudFormation in current implementation)
- **Extensible Code Generation**: Structured to support additional language generators (e.g., Kotlin, Python) without changing schema or ingestion behavior

### Scope

This CLI currently targets **AWS-based deployments only**, using CloudFormation as the metadata source.

Support for other cloud providers and on-prem environments will be introduced via separate provider-specific adapters, all consuming the same Chaim ingestion contracts.

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript 5.x |
| Module System | CommonJS (`"type": "commonjs"`) |
| Runtime | Node.js 18+ |
| CLI Framework | Commander.js 11.x |
| Terminal Styling | Chalk 4.x |
| Progress Spinners | Ora 5.x |
| Testing | Vitest 1.x |
| Code Quality | ESLint, TypeScript strict mode |
| Cloud Integration | AWS SDK v3 (current provider implementation) |

---

## Repository Structure

```
chaim-cli/
├── src/
│   ├── index.ts                         # CLI entry point and command registration
│   └── commands/
│       ├── init.ts                      # Prerequisites verification and installation
│       ├── generate.ts                  # SDK generation from infrastructure stacks
│       ├── validate.ts                  # Schema file validation
│       ├── doctor.ts                    # Environment health checks
│       └── cloudformation-reader.ts     # Infrastructure metadata reader (AWS implementation)
├── shared/
│   ├── examples/
│   │   └── orders.bprint                # Sample schema file
│   └── scripts/
│       └── setup.sh                     # Setup script for development
├── dist/                                # Compiled output (generated)
├── bundled-deps/                        # Bundled dependencies for offline/reproducible generation (generated)
├── package.json
├── tsconfig.json
└── README.md
```

---

## Architecture

### CLI Command Structure

```
chaim (CLI entry point)
├── init        # Prerequisites verification and installation
├── generate    # SDK generation from infrastructure stack
├── validate    # Schema file validation
└── doctor      # Environment health checks
```

### Component Dependencies

```mermaid
flowchart TD
    subgraph CLI [chaim-cli]
        Index[index.ts]
        Init[init command]
        Generate[generate command]
        Validate[validate command]
        Doctor[doctor command]
        MetadataReader[Metadata Reader]
    end
    
    subgraph Core [Core Dependencies]
        BprintSpec[chaim-bprint-spec]
        CodeGen[Code Generator]
    end
    
    subgraph AWSImpl [AWS Implementation - Current]
        CFN[CloudFormation]
        ClientJava[chaim-client-java]
        AWSCLI[AWS CLI]
        CDK[CDK CLI]
    end
    
    Index --> Init
    Index --> Generate
    Index --> Validate
    Index --> Doctor
    
    Generate --> MetadataReader
    MetadataReader --> CFN
    Generate --> BprintSpec
    Generate --> CodeGen
    CodeGen --> ClientJava
    Validate --> BprintSpec
    Init --> AWSCLI
    Init --> CDK
    Doctor --> AWSCLI
```

---

## CLI Commands

### `chaim init`

Verifies and installs all prerequisites required for the Chaim CLI to function.

```bash
chaim init [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--install` | Install missing dependencies automatically | false |
| `--verify-only` | Verify prerequisites only (no installation) | false |
| `--region <region>` | AWS region for CDK bootstrap | us-east-1 |

**Prerequisites Checked:**
- Node.js version (requires v18+)
- Java installation (requires 11+)
- AWS CLI availability and configuration
- CDK CLI installation
- AWS credentials validity
- CDK bootstrap status

**Dependencies Installed (with `--install`):**
- CDK CLI (if missing): `npm install -g aws-cdk`
- chaim-cli dependencies
- CDK bootstrap (if not already done)

---

### `chaim generate`

Generates language-specific SDK from a deployed infrastructure stack containing Chaim metadata.

**Current Implementation**: Reads AWS CloudFormation stacks and generates Java SDKs.

```bash
chaim generate --stack <stackName> --package <packageName> [options]
```

| Option | Type | Required | Description | Default |
|--------|------|----------|-------------|---------|
| `--stack` | string | Yes | Infrastructure stack name (CloudFormation in AWS) | - |
| `--package` | string | Yes | Target package name (e.g., `com.example.model` for Java) | - |
| `--region` | string | No | AWS region | us-east-1 |
| `--table` | string | No | Specific table name to generate | All tables |
| `--output` | string | No | Output directory | ./src/main/java |
| `--skip-checks` | boolean | No | Skip environment validation | false |

**Example:**
```bash
chaim generate --stack MyAppStack --package com.myapp.model --output ./generated
```

---

### `chaim validate`

Validates a `.bprint` schema file against the Chaim specification.

```bash
chaim validate <schemaFile>
```

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `schemaFile` | string | Yes | Path to the `.bprint` file to validate |

**Example:**
```bash
chaim validate ./schemas/user.bprint
```

**Output on Success:**
```
🔍 Validating schema: ./schemas/user.bprint
✓ Schema is valid
  Entity: userId
  Version: v1
  Fields: 5
```

---

### `chaim doctor`

Checks system environment and dependencies for proper configuration.

```bash
chaim doctor
```

**Checks Performed:**
- Node.js version
- AWS CLI availability
- AWS credentials configuration
- Java availability
- AWS SDK availability

**Example Output:**
```
🔍 Checking system environment...
✓ Node.js version: v20.10.0
✓ AWS credentials configured
  Account: 123456789012
  User: arn:aws:iam::123456789012:user/developer
✓ Java version: 17.0.9
✓ AWS SDK available
✓ All checks passed
```

---

## Infrastructure Metadata Integration

The CLI reads metadata from deployed infrastructure stacks to drive code generation. The metadata source is abstracted to allow different providers.

> The CLI is designed so the metadata source can be swapped without changing code generation semantics.

### AWS Implementation: CloudFormation

The current implementation reads CloudFormation stack outputs prefixed with `Chaim` to extract metadata:

| Output Key Pattern | Description |
|--------------------|-------------|
| `ChaimTableMetadata_<tableName>` | JSON containing table configuration |
| `ChaimSchemaData_<tableName>` | JSON containing schema definition |
| `ChaimMode` | Operating mode (e.g., "oss") |

### CloudFormationReader API (AWS Implementation)

```typescript
interface ChaimStackOutputs {
  getMode(): string;           // Operating mode
  getRegion(): string;         // Cloud region
  getAccountId(): string;      // Cloud account ID
  getOutputs(): Record<string, string>;  // All Chaim outputs
  getOutput(key: string): string | undefined;  // Specific output
}

class CloudFormationReader {
  // Read all stack outputs
  readStackOutputs(stackName: string, region: string): Promise<ChaimStackOutputs>;
  
  // List all Chaim-bound data stores
  listChaimTables(stackOutputs: ChaimStackOutputs): Promise<string[]>;
  
  // Extract metadata for a specific data store
  extractTableMetadata(stackOutputs: ChaimStackOutputs, tableName: string): Promise<TableMetadata>;
}
```

> **Future**: Additional metadata readers (e.g., `TerraformStateReader`, `PulumiReader`) will implement the same interface pattern.

---

## Code Generation Flow

### End-to-End Process

```mermaid
sequenceDiagram
    participant User
    participant CLI as chaim-cli
    participant Meta as Metadata Source
    participant Spec as chaim-bprint-spec
    participant Gen as Code Generator
    participant FS as File System
    
    User->>CLI: chaim generate --stack MyStack
    CLI->>CLI: Run pre-generation checks (doctor)
    CLI->>Meta: Read stack metadata
    Meta-->>CLI: Return Chaim outputs
    CLI->>CLI: Parse data store metadata
    loop For each data store
        CLI->>Spec: Validate schema
        Spec-->>CLI: Validated schema
        CLI->>Gen: Generate SDK code
        Gen-->>CLI: Generated files
        CLI->>FS: Write output files
    end
    CLI-->>User: Success + output summary
```

### Generated Output Structure (Java Example)

```
./src/main/java/
└── com/
    └── example/
        └── model/
            ├── User.java           # Entity DTO
            ├── UserRepository.java # Data store operations
            └── ChaimConfig.java    # Client configuration
```

---

## Package Exports

### npm Installation

```bash
npm install -g @chaim-tools/chaim
```

### Binary Entry Point

```bash
chaim <command> [options]
```

The CLI is registered as a global binary via `package.json`:

```json
{
  "bin": {
    "chaim": "./dist/index.js"
  }
}
```

---

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Build CLI and bundle dependencies |
| `npm run build:cli` | Compile TypeScript to dist/ |
| `npm run build:deps` | Bundle bprint-spec and cdk dependencies |
| `npm test` | Run Vitest test suite |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run dev` | Run CLI in development mode (ts-node) |
| `npm run start` | Run compiled CLI |
| `npm run clean` | Remove dist/ and bundled-deps/ |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry point, Commander.js setup, command registration |
| `src/commands/init.ts` | Prerequisites verification and dependency installation |
| `src/commands/generate.ts` | SDK generation orchestration |
| `src/commands/validate.ts` | Schema validation using chaim-bprint-spec |
| `src/commands/doctor.ts` | Environment health checks |
| `src/commands/cloudformation-reader.ts` | Infrastructure metadata reader (AWS implementation) |
| `shared/examples/orders.bprint` | Sample schema file for testing |
| `shared/scripts/setup.sh` | Development environment setup script |

---

## Integration with Chaim Ecosystem

### Dependencies

| Package | Purpose |
|---------|---------|
| `@chaim-tools/chaim-bprint-spec` | Schema validation and TypeScript types |
| `@chaim-tools/cdk` | Infrastructure constructs (bundled, AWS implementation) |
| `@chaim-tools/client-java` | Code generation (Java implementation) |

### Workflow with Other Packages

1. **Define Schema** (`chaim-bprint-spec`)
   - Create `.bprint` schema files defining entity structure
   
2. **Deploy Infrastructure** (provider-specific)
   - Bind schemas to data stores using provider constructs
   - Infrastructure stack publishes metadata for CLI consumption
   - *AWS*: Use `ChaimDynamoDBBinder` with CDK, metadata in CloudFormation outputs
   
3. **Generate SDK** (`chaim-cli`)
   - Read infrastructure stack metadata
   - Validate schema using `chaim-bprint-spec`
   - Generate SDK code using language-specific generator
   - *Current*: Java code via `chaim-client-java`

---

## Configuration File (Optional)

Create `chaim.json` in your project root to avoid repeating CLI options:

```json
{
  "defaults": {
    "package": "com.example.model",
    "output": "./src/main/java",
    "region": "us-east-1",
    "stack": "MyStack"
  }
}
```

Then run without arguments:
```bash
chaim generate
```

---

## Field Type Mappings (Java)

| `.bprint` Type | Java Type |
|----------------|-----------|
| `string` | `String` |
| `number` | `Double` |
| `boolean` | `Boolean` |
| `timestamp` | `Instant` |

> Type mappings for other target languages will be documented as generators are added.

---

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `--stack is required` | Missing stack name | Provide `--stack <name>` option |
| `--package is required` | Missing Java package | Provide `--package <name>` option |
| `Table 'X' not found in stack` | Invalid table name | Check available tables in stack |
| `No Chaim tables found in stack` | Stack has no Chaim bindings | Ensure stack uses ChaimDynamoDBBinder. If no Chaim metadata is present, ingestion did not occur (CDK deployed without binders or ingestion failed in STRICT mode) |
| `AWS credentials not configured` | Missing AWS auth | Run `aws configure` |
| `Schema validation failed` | Invalid `.bprint` file | Fix schema per error message |

---

## Testing

### Running Tests

```bash
npm test
```

### Test Files

| File | Coverage |
|------|----------|
| `src/index.test.ts` | CLI entry point |
| `src/commands/generate.test.ts` | Generate command |
| `src/commands/validate.test.ts` | Validate command |
| `src/commands/init.test.ts` | Init command |
| `src/commands/doctor.test.ts` | Doctor command |
| `src/commands/cloudformation-reader.test.ts` | CloudFormation integration |

---

**Note**: This document reflects the chaim-cli architecture as a TypeScript-based CLI tool. The CLI acts as the primary user interface for the Chaim ecosystem, orchestrating schema validation and code generation across deployed infrastructure. The current implementation targets AWS (CloudFormation, DynamoDB) with Java SDK generation; the architecture supports extension to other cloud providers and target languages.


```mermaid
sequenceDiagram
    autonumber

    %% =========================
    %% DEVELOPMENT (FAST LOOP)
    %% =========================
    box rgba(240,248,255,0.7) Development / Beta (Fast Loop: synth-first)
      participant Dev as Developer
      participant CDK as AWS CDK (synth)
      participant Binder as ChaimDynamoDBBinder (CDK construct)
      participant Out as cdk.out (local)
      participant CLI as chaim-cli
      participant FS as Project Workspace (generated code)
    end

    Dev->>CDK: cdk synth (dev env)
    CDK->>Binder: construct executes at synth time
    Binder->>Binder: Load + validate .bprint (chaim-bprint-spec)
    Binder->>Binder: Extract declared DynamoDB config (keys/indexes/ttl/streams/encryption)
    Binder->>Binder: Build SynthSnapshot (intent + stack context)
    Binder->>Out: Write snapshot file\ncdk.out/chaim/snapshots/<stack>.json

    Note over Dev,Out: No AWS calls required.\nNo deployment.\nNo Chaim SaaS ingestion.

    Dev->>CLI: chaim generate --from-synth --stack <stack> (dev)
    CLI->>Out: Read SynthSnapshot JSON
    CLI->>CLI: Validate schema again (defensive)
    CLI->>CLI: Generate DTOs + mapper clients + config
    CLI->>FS: Write generated Java SDK\n(e.g., ./generated or src/main/java)
    CLI-->>Dev: Success summary + generated paths

    Note over Dev,FS: Dev can iterate rapidly:\nEdit .bprint -> cdk synth -> chaim generate

    %% =========================
    %% PRODUCTION (AUTHORITATIVE)
    %% =========================
    box rgba(245,245,245,0.8) Production (Deploy-time source of truth)
      participant Prod as Release Engineer / CI
      participant CDKDeploy as AWS CDK (deploy)
      participant CFN as CloudFormation
      participant CR as CFN Custom Resource (Lambda-backed)
      participant IngestAPI as Chaim Ingest API
      participant S3 as Chaim S3 (presigned upload)
      participant Catalog as Chaim Platform (metadata store)
      participant CLIProd as chaim-cli
      participant FSProd as Repo / Build Output
    end

    Prod->>CDKDeploy: cdk deploy (prod env)
    CDKDeploy->>CFN: Create/Update Stack
    CFN->>CR: Invoke Custom Resource (Create/Update/Delete)
    CR->>CR: Collect deployed context (account/region/stack identifiers)
    CR->>CR: Build DeploySnapshot bytes (schema + resource metadata + context)\n(eventId + contentHash)
    CR->>IngestAPI: POST /ingest/upload-url (HMAC auth)
    IngestAPI-->>CR: Presigned S3 URL + object key
    CR->>S3: PUT snapshot bytes (no size constraint)
    CR->>IngestAPI: POST /ingest/snapshot-ref (eventId, contentHash, s3 pointer, metadata)
    IngestAPI->>Catalog: Persist governed metadata (track versions, resource inventory)
    IngestAPI-->>CR: 202 ACCEPTED (eventId)
    CR-->>CFN: SUCCESS/FAILED (based on FailureMode)
    CFN-->>CDKDeploy: Stack completes

    Note over Prod,Catalog: Deploy-time snapshot is authoritative:\n"what exists" + "what was deployed"

    %% =========================
    %% CLI GENERATION (PRODUCTION)
    %% =========================
    Prod->>CLIProd: chaim generate --stack <stack> (prod)
    CLIProd->>CFN: Describe stack outputs (or lookup stack context)
    CFN-->>CLIProd: Stack metadata (minimal) (or identifiers)
    CLIProd->>IngestAPI: (optional future) GET snapshot by eventId\nor query latest schema for appId
    IngestAPI-->>CLIProd: Snapshot metadata + schema\n(or pointer/ref)
    CLIProd->>CLIProd: Generate DTOs + mapper clients
    CLIProd->>FSProd: Write generated SDK artifacts
    CLIProd-->>Prod: Success summary

    Note over CLIProd,FSProd: In production, CLI generation should prefer\nauthoritative deployed snapshot when available.\nIf not available, it can fall back to synth snapshot.
```

```mermaid
flowchart TD
  A["Developer edits .bprint + CDK stack"] --> B{"Which workflow?"}

  %% =========================
  %% Shared (Reusable Pipeline)
  %% =========================
  SB["SnapshotBuilder<br/>Validate .bprint + extract metadata + stack context<br/>Serialize bytes + contentHash"]:::shared
  AW["ArtifactWriter<br/>Write snapshot artifact"]:::shared
  CLI["chaim-cli generate<br/>Consumes snapshot artifact OR authoritative snapshot"]:::shared
  GEN["Generate DTOs + mapper clients"]:::shared

  %% ---------- Preview  ----------
  B -->|Preview| C["Run: cdk synth"]:::dev
  C --> SB
  SB --> AW
  AW --> D1["Write to cdk.out/chaim/snapshots/STACK_NAME.json"]:::dev
  D1 --> CLI
  CLI --> GEN
  GEN --> E1["App dev continues<br/>No deploy required"]:::dev

  %% ---------- PROD ----------
  B -->|Register| P["Run: cdk deploy"]:::prod
  P --> CR["CloudFormation Custom Resource"]:::prod
  CR --> SB
  SB --> AW
  AW --> T2["Write to /tmp/chaim/snapshots/EVENT_ID.json"]:::prod
  T2 --> PUB["ChaimIngestPublisher<br/>upload-url -> PUT -> snapshot-ref"]:::prod
  PUB --> CH["Chaim persists governed metadata<br/>Versioning + inventory"]:::prod
  CH --> CLI
  CLI --> GEN

  classDef shared fill:#E8F0FE,stroke:#1A73E8,stroke-width:1px,color:#111;
  classDef dev fill:#E8F5E9,stroke:#1B5E20,stroke-width:1px,color:#111;
  classDef prod fill:#FFF3E0,stroke:#E65100,stroke-width:1px,color:#111;

  class SB,AW,CLI,GEN shared;
  class C,D1,E1 dev;
  class P,CR,T2,PUB,CH prod;

```