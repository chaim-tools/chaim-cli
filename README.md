# chaim-cli

A **schema-driven code generation tool** that transforms `.bprint` schema snapshots into complete SDKs with DynamoDB Mapper clients, DTOs, and configuration management. Currently supports **Java** (default), with more languages coming soon.

## Prerequisite

> **IMPORTANT**: You must run `cdk synth` or `cdk deploy` in your CDK project before using this CLI.

```bash
# In your CDK project directory
cdk synth   # Creates LOCAL snapshot in OS cache
# OR
cdk deploy  # Creates LOCAL snapshot + publishes to Chaim SaaS
```

The CLI reads snapshot files from the **OS cache** (`~/.chaim/cache/snapshots/`) produced by [chaim-cdk](https://github.com/chaim-tools/chaim-cdk). You can run the CLI from **any directory**.

## Quick Start

```bash
# 1. In your CDK project, create a snapshot
cd my-cdk-project
cdk synth

# 2. Generate SDK (run from your Java application directory)
cd my-java-app
chaim generate --package com.mycompany.myapp.model

# That's it! Your Java SDK is ready in ./src/main/java/
```

## Installation

```bash
npm install -g @chaim-tools/chaim
```

## System Requirements

Run `chaim doctor` to verify your environment:

```bash
chaim doctor
```

**Required:**
- Node.js v18+
- Java 11+ (for code generation)
- AWS CLI (configured)

## CLI Commands

### Generate SDK

```bash
# Generate all entities from snapshots (defaults to Java)
chaim generate --package com.mycompany.myapp.model

# Explicitly specify language
chaim generate --package com.mycompany.myapp.model --language java

# Filter by CDK stack name
chaim generate --package com.mycompany.myapp.model --stack MyStack

# Custom output directory
chaim generate --package com.mycompany.myapp.model --output ./generated

# Skip environment checks
chaim generate --package com.mycompany.myapp.model --skip-checks
```

**Options:**

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `--package` | **Yes** | Package name (e.g., `com.mycompany.myapp.model` for Java) | - |
| `-l, --language` | No | Target language for code generation | java |
| `--output` | No | Output directory | ./src/main/java |
| `--stack` | No | Filter by CDK stack name | - |
| `--snapshot-dir` | No | Override snapshot directory | OS cache |
| `--skip-checks` | No | Skip environment checks | false |

**Supported Languages:**
- `java` (default) — generates Java DTOs, ChaimConfig, and ChaimMapperClient

### Other Commands

```bash
# Verify prerequisites
chaim init

# Validate a schema file
chaim validate ./schemas/user.bprint

# Check environment health
chaim doctor
```

## Snapshot Locations

Snapshots are stored in a **global OS cache**, allowing the CLI to work from any directory.

**Default locations:**
- macOS/Linux: `~/.chaim/cache/snapshots/`
- Windows: `%LOCALAPPDATA%/chaim/cache/snapshots/`

**Directory structure:**
```
~/.chaim/cache/snapshots/
└── aws/
    └── {accountId}/
        └── {region}/
            └── {stackName}/
                └── dynamodb/
                    └── {resourceId}.json
```

## Error: No Snapshot Found

If you see "No snapshot found", **you need to create a snapshot first**. Snapshots are created by `chaim-cdk`:

```bash
# Navigate to your CDK project
cd my-cdk-project

# Create a snapshot
cdk synth    # For development
# OR
cdk deploy   # For production

# Then generate (from any directory)
chaim generate --package com.mycompany.myapp.model
```

**Common causes:**
- Haven't run `cdk synth` or `cdk deploy` yet
- Filters (`--stack`) don't match existing snapshots
- Snapshots in non-default location (use `--snapshot-dir`)

**Tip:** The CLI shows existing snapshots that didn't match your filters, helping you adjust.

## Generated Output

```
src/main/java/com/mycompany/myapp/model/
├── Users.java              # Entity DTO
├── config/
│   └── ChaimConfig.java    # Table configuration
└── mapper/
    └── ChaimMapperClient.java  # DynamoDB mapper
```

### Using the Generated SDK

```java
// Create mapper client
ChaimMapperClient mapper = ChaimConfig.createMapper();

// Save entity
User user = new User();
user.setUserId("user-123");
user.setEmail("john@example.com");
mapper.save(user);

// Find by ID
Optional<User> found = mapper.findById(User.class, "user-123");
```

## Optional Configuration

Create `chaim.json` to set defaults:

```json
{
  "defaults": {
    "package": "com.mycompany.myapp.model",
    "output": "./src/main/java"
  }
}
```

Then run without arguments:
```bash
chaim generate
```

## Field Type Mappings

| .bprint Type | Java Type |
|--------------|-----------|
| `string` | `String` |
| `number` | `Double` |
| `boolean` | `Boolean` |
| `timestamp` | `Instant` |

## Related Packages

| Package | Purpose |
|---------|---------|
| [chaim-cdk](https://github.com/chaim-tools/chaim-cdk) | AWS CDK constructs (creates snapshots) |
| [chaim-bprint-spec](https://github.com/chaim-tools/chaim-bprint-spec) | Schema specification |
| [chaim-client-java](https://github.com/chaim-tools/chaim-client-java) | Java code generation |

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/chaim-tools/chaim-cli/issues)
- **Examples**: [chaim-examples](https://github.com/chaim-tools/chaim-examples)

---

**Chaim** means life, representing our mission: supporting the life (data) of software applications as they grow and evolve alongside businesses.
