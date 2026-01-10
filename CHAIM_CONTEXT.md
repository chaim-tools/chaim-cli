# AI Agent Context: chaim-cli

**Purpose**: Structured context for AI agents to understand and work with the chaim-cli codebase.

**Package**: `@chaim-tools/chaim` (published as `chaim` CLI binary)  
**Version**: 0.1.0  
**License**: Apache-2.0

---

## Project Overview

The chaim-cli is a **schema-driven code generation tool** that transforms `.bprint` schema definitions into complete, language-specific SDKs with data access clients, DTOs, and configuration management. It reads snapshot files produced by `chaim-cdk` to extract schema and resource configuration, then generates type-safe code.

**Current Implementation**: AWS (DynamoDB tables) with Java SDK generation.

### Prerequisite

> **IMPORTANT**: The CLI requires snapshots from `chaim-cdk`. You must run `cdk synth` or `cdk deploy` before using `chaim generate`.

```bash
# In your CDK project (creates snapshots in cdk.out/chaim/snapshots/)
cdk synth   # For development (preview mode)
cdk deploy  # For production (registered mode)

# Then run the CLI
chaim generate --package com.example.model
```

### Key Capabilities

- **Prerequisites Management**: Verify and install all required dependencies for the current provider
- **Language-Specific SDK Generation**: Generate complete SDKs from CDK snapshots (Java-first implementation)
- **Schema Validation**: Validate `.bprint` files using `@chaim-tools/chaim-bprint-spec`
- **Environment Diagnostics**: Check system environment and dependency health
- **Snapshot Discovery**: Automatically find and select the appropriate snapshot from `cdk.out/chaim/snapshots/`
- **Extensible Code Generation**: Structured to support additional language generators (e.g., Kotlin, Python) without changing schema or ingestion behavior

### Scope

This CLI currently targets **AWS-based deployments only**, consuming snapshots produced by `chaim-cdk`.

---

## Related Packages

| Package | Relationship | Purpose |
|---------|-------------|---------|
| `@chaim-tools/cdk-lib` | **Upstream dependency** | Produces snapshot files that CLI consumes |
| `@chaim-tools/chaim-bprint-spec` | **Shared dependency** | Schema format definition, validation |
| `@chaim-tools/client-java` | **Code generator** | Java SDK generation |

**Data flow**:
```
chaim-cdk (cdk synth/deploy) → cdk.out/chaim/snapshots/ → chaim-cli → Generated SDK
```

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
│   ├── commands/
│   │   ├── init.ts                      # Prerequisites verification and installation
│   │   ├── generate.ts                  # SDK generation from snapshots
│   │   ├── validate.ts                  # Schema file validation
│   │   ├── doctor.ts                    # Environment health checks
│   │   └── cloudformation-reader.ts     # DEPRECATED: Legacy CloudFormation reader
│   └── services/
│       └── snapshot-discovery.ts        # Snapshot file discovery and resolution
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
        SnapDisc[snapshot-discovery.ts]
    end
    
    subgraph Core [Core Dependencies]
        BprintSpec[chaim-bprint-spec]
        CodeGen[Code Generator]
    end
    
    subgraph Upstream [Upstream - chaim-cdk]
        CDKOut[cdk.out/chaim/snapshots/]
    end
    
    subgraph AWSImpl [AWS Implementation]
        ClientJava[chaim-client-java]
        AWSCLI[AWS CLI]
        CDK[CDK CLI]
    end
    
    Index --> Init
    Index --> Generate
    Index --> Validate
    Index --> Doctor
    
    Generate --> SnapDisc
    SnapDisc --> CDKOut
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

Generates language-specific SDK from Chaim snapshot files produced by `chaim-cdk`.

**Prerequisite**: Run `cdk synth` or `cdk deploy` in your CDK project first.

```bash
chaim generate --package <packageName> [options]
```

| Option | Type | Required | Description | Default |
|--------|------|----------|-------------|---------|
| `--package` | string | Yes | Target package name (e.g., `com.example.model` for Java) | - |
| `--snapshot-dir` | string | No | Snapshot directory path | cdk.out/chaim/snapshots |
| `--mode` | string | No | Snapshot mode: `preview`, `registered`, or `auto` | auto |
| `--stack` | string | No | Filter snapshots by stack name | - |
| `--table` | string | No | Specific table name to generate | All tables |
| `--output` | string | No | Output directory | ./src/main/java |
| `--skip-checks` | boolean | No | Skip environment validation | false |

**Mode Selection:**
- `auto` (default): Use registered if available, else preview
- `preview`: Only use preview snapshots (cdk synth output)
- `registered`: Only use registered snapshots (cdk deploy output)

**Examples:**
```bash
# Generate from snapshot (auto-discovers mode)
chaim generate --package com.myapp.model

# Generate from preview snapshot explicitly
chaim generate --package com.myapp.model --mode preview

# Generate from registered snapshot explicitly  
chaim generate --package com.myapp.model --mode registered

# Filter by stack name
chaim generate --stack MyAppStack --package com.myapp.model
```

**Error: No snapshot found**

If no snapshot is found, the CLI will show:
- Expected snapshot locations
- Instructions to run `cdk synth` or `cdk deploy`
- Any existing snapshots that didn't match your criteria

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

## Snapshot Locations

The CLI reads snapshots from a standardized directory structure created by `chaim-cdk`:

```
cdk.out/chaim/snapshots/
├── preview/                    # Synth-time snapshots
│   └── <stackName>.json       # e.g., MyStack.json
└── registered/                 # Deploy-time snapshots  
    └── <stackName>-<eventId>.json  # e.g., MyStack-550e8400-e29b-41d4-a716-446655440000.json
```

### Snapshot Modes

| Mode | When Created | Contains | Purpose |
|------|--------------|----------|---------|
| `PREVIEW` | `cdk synth` | schema, dataStore, context, capturedAt | Local development, code generation without deploy |
| `REGISTERED` | `cdk deploy` | All preview fields + eventId, contentHash | Production tracking, audit trail |

### Generation Workflows

**Preview Workflow (no deploy needed):**
```bash
cdk synth
chaim generate --mode preview --package com.example.model
```

**Registered Workflow (after deploy):**
```bash
cdk deploy
chaim generate --mode registered --package com.example.model
```

**Auto Mode (default):**
```bash
chaim generate --package com.example.model  # Uses registered if available, else preview
```

---

## Snapshot Discovery

The CLI discovers and resolves snapshots from the standardized directory structure created by `chaim-cdk`.

### Discovery Logic

```typescript
// Snapshot discovery service API
function resolveSnapshot(
  snapshotDir: string,
  mode: 'preview' | 'registered' | 'auto',
  stackFilter?: string
): ResolvedSnapshot | undefined;

// Auto mode priority:
// 1. If registered snapshots exist → use latest registered
// 2. Else if preview snapshots exist → use latest preview
// 3. Else → error (no snapshot found)
```

### Snapshot Resolution

| Input | Resolution |
|-------|------------|
| `--mode auto` (default) | Prefer registered, fallback to preview |
| `--mode preview` | Only search `preview/` directory |
| `--mode registered` | Only search `registered/` directory |
| `--stack MyStack` | Filter snapshots by stack name |

### Directory Structure

```
cdk.out/chaim/snapshots/
├── preview/                    # Created by: cdk synth
│   └── <stackName>.json
└── registered/                 # Created by: cdk deploy
    └── <stackName>-<eventId>.json
```

---

## Code Generation Flow

### End-to-End Process

```mermaid
sequenceDiagram
    participant User
    participant CDK as chaim-cdk
    participant SnapDir as cdk.out/chaim/snapshots/
    participant CLI as chaim-cli
    participant Spec as chaim-bprint-spec
    participant Gen as Code Generator
    participant FS as File System
    
    Note over User,CDK: Prerequisite: Create snapshot
    User->>CDK: cdk synth (or cdk deploy)
    CDK->>SnapDir: Write snapshot file
    
    Note over User,FS: Code generation
    User->>CLI: chaim generate --package com.example
    CLI->>CLI: Run pre-generation checks (doctor)
    CLI->>SnapDir: Discover snapshots
    SnapDir-->>CLI: Return latest snapshot
    CLI->>CLI: Parse schema + dataStore metadata
    CLI->>Spec: Validate schema
    Spec-->>CLI: Validated schema
    CLI->>Gen: Generate SDK code
    Gen-->>CLI: Generated files
    CLI->>FS: Write output files
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
| `src/commands/generate.ts` | SDK generation from snapshots |
| `src/commands/validate.ts` | Schema validation using chaim-bprint-spec |
| `src/commands/doctor.ts` | Environment health checks |
| `src/services/snapshot-discovery.ts` | Snapshot file discovery and resolution |
| `src/commands/cloudformation-reader.ts` | DEPRECATED: Legacy CloudFormation reader (not used) |
| `shared/examples/orders.bprint` | Sample schema file for testing |
| `shared/scripts/setup.sh` | Development environment setup script |

---

## Integration with Chaim Ecosystem

### Dependencies

| Package | Purpose |
|---------|---------|
| `@chaim-tools/chaim-bprint-spec` | Schema validation and TypeScript types |
| `@chaim-tools/cdk-lib` | Produces snapshot files (upstream dependency) |
| `@chaim-tools/client-java` | Code generation (Java implementation) |

### Workflow with Other Packages

1. **Define Schema** (`chaim-bprint-spec`)
   - Create `.bprint` schema files defining entity structure
   
2. **Create Snapshot** (`chaim-cdk`)
   - Bind schemas to data stores using CDK constructs
   - Run `cdk synth` (preview) or `cdk deploy` (registered)
   - Snapshots written to `cdk.out/chaim/snapshots/`
   
3. **Generate SDK** (`chaim-cli`)
   - Discover and read snapshot files
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
| `No snapshot found` | Missing CDK snapshot | Run `cdk synth` or `cdk deploy` in your CDK project first |
| `--package is required` | Missing Java package | Provide `--package <name>` option |
| `Table 'X' not found in snapshot` | Invalid table name | Check table name in snapshot file |
| `AWS credentials not configured` | Missing AWS auth | Run `aws configure` |
| `Schema validation failed` | Invalid `.bprint` file | Fix schema per error message |

### No Snapshot Found

The most common error is "No snapshot found". This occurs when:

1. **CDK not run**: You haven't run `cdk synth` or `cdk deploy` yet
2. **Wrong directory**: You're running CLI from a different directory than your CDK project
3. **Mode mismatch**: You specified `--mode registered` but only have preview snapshots
4. **Stack mismatch**: You specified `--stack X` but snapshots are for stack Y

**Resolution:**
```bash
# Navigate to your CDK project directory
cd my-cdk-project

# Create a snapshot
cdk synth

# Then run the CLI
chaim generate --package com.example.model
```

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
| `src/services/snapshot-discovery.test.ts` | Snapshot discovery |

---

**Note**: This document reflects the chaim-cli architecture as a TypeScript-based CLI tool. The CLI consumes snapshot files produced by `chaim-cdk` and generates type-safe SDKs. Snapshots are required; the CLI does not fall back to CloudFormation. The current implementation targets AWS (DynamoDB) with Java SDK generation; the architecture supports extension to other target languages.


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