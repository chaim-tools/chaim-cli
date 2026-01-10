# chaim-cli

A **schema-driven code generation tool** that transforms `.bprint` schema definitions into complete Java SDKs with DynamoDB Mapper clients, DTOs, and configuration management.

## Prerequisite

> **IMPORTANT**: You must run `cdk synth` or `cdk deploy` before using this CLI.

```bash
# In your CDK project directory
cdk synth   # Creates preview snapshot (for development)
# OR
cdk deploy  # Creates registered snapshot (for production)
```

The CLI reads snapshot files from `cdk.out/chaim/snapshots/` produced by [chaim-cdk](https://github.com/chaim-tools/chaim-cdk).

## Quick Start

```bash
# 1. In your CDK project, create a snapshot
cdk synth

# 2. Generate SDK
chaim generate --package com.example.model

# That's it! Your Java SDK is ready in ./src/main/java/
```

## Installation

```bash
npm install -g @chaim-tools/chaim
```

## System Requirements

Run `chaim init` to verify and install all prerequisites:

```bash
chaim init
```

**Required:**
- Node.js v18+
- Java 11+
- AWS CLI (configured)
- CDK CLI

## CLI Commands

### Generate SDK

```bash
# Auto-detect snapshot mode (registered preferred, then preview)
chaim generate --package com.example.model

# Use preview snapshot explicitly
chaim generate --mode preview --package com.example.model

# Use registered snapshot explicitly
chaim generate --mode registered --package com.example.model

# Filter by stack name
chaim generate --stack MyStack --package com.example.model
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--package` | Java package name (required) | - |
| `--snapshot-dir` | Snapshot directory path | cdk.out/chaim/snapshots |
| `--mode` | Snapshot mode: `preview`, `registered`, `auto` | auto |
| `--stack` | Filter snapshots by stack name | - |
| `--output` | Output directory | ./src/main/java |
| `--table` | Specific table to generate | All tables |
| `--skip-checks` | Skip environment checks | false |

### Other Commands

```bash
# Verify prerequisites
chaim init

# Validate a schema file
chaim validate ./schemas/user.bprint

# Check environment health
chaim doctor
```

## Snapshot Modes

| Mode | Created By | Location | Use Case |
|------|------------|----------|----------|
| Preview | `cdk synth` | `preview/<stackName>.json` | Development, rapid iteration |
| Registered | `cdk deploy` | `registered/<stackName>-<eventId>.json` | Production, audit trail |

**Auto mode** (default): Uses registered if available, otherwise preview.

## Error: No Snapshot Found

If you see "No snapshot found", it means you haven't run `cdk synth` or `cdk deploy` yet:

```bash
# Navigate to your CDK project
cd my-cdk-project

# Create a snapshot
cdk synth

# Then generate
chaim generate --package com.example.model
```

## Using the Generated SDK

```java
// Create mapper client
ChaimMapperClient mapper = ChaimConfig.createMapper();

// Save entity
User user = new User("user-123", "john@example.com", "John Doe");
mapper.save(user);

// Find by ID
Optional<User> found = mapper.findById(User.class, "user-123");

// Query by field
List<User> activeUsers = mapper.findByField(User.class, "isActive", true);
```

## Optional Configuration

Create `chaim.json` to set defaults:

```json
{
  "defaults": {
    "package": "com.example.model",
    "output": "./src/main/java"
  }
}
```

## Related Packages

| Package | Purpose |
|---------|---------|
| [chaim-cdk](https://github.com/chaim-tools/chaim-cdk) | AWS CDK constructs (creates snapshots) |
| [chaim-bprint-spec](https://github.com/chaim-tools/chaim-bprint-spec) | Schema specification |

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/chaim-tools/chaim-cli/issues)
- **Examples**: [chaim-examples](https://github.com/chaim-tools/chaim-examples)

---

**Chaim** means life, representing our mission: supporting the life (data) of software applications as they grow and evolve alongside businesses.
