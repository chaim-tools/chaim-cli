# chaim-cli

A **schema-driven code generation tool** that transforms `.bprint` schema definitions into complete Java SDKs with DynamoDB Mapper clients, DTOs, and configuration management.

## Why Use chaim-cli?

Building data-driven applications requires significant boilerplate code. **chaim-cli eliminates this boilerplate** by generating everything from your schema definition:

1. **Define your data model once** in a `.bprint` schema file
2. **Deploy infrastructure** using chaim-cdk constructs
3. **Generate complete SDK** with a single command
4. **Focus on business logic** instead of boilerplate

## Prerequisites

1. **Node.js** (v18 or higher)
2. **AWS Credentials** configured: `aws configure`
3. **Java** (for code generation)
4. **Schema Definition** (`.bprint` files) - [chaim-bprint-spec](https://github.com/chaim-builder/chaim-bprint-spec)
5. **AWS CDK Infrastructure** - [chaim-cdk](https://github.com/chaim-builder/chaim-cdk)

### Quick Prerequisites Setup

Use the `init` command to verify and install all prerequisites:

```bash
# Check and install all required dependencies
chaim init

# This will:
# ✓ Verify Node.js version (v18+)
# ✓ Check Java installation (11+)
# ✓ Validate AWS CLI and credentials
# ✓ Install CDK CLI if missing
# ✓ Bootstrap CDK in your region
# ✓ Install chaim-cli dependencies
```

## Quick Start

### Step 1: Deploy Your Infrastructure (in chaim-cdk repo) 
```bash
cdk deploy MyStack
```

### Step 2: Generate Your SDK
```bash
# Generate SDK from your deployed CDK stack
chaim generate --stack MyStack --package com.example
```

### Step 3: Use the Generated SDK
```java
// Create mapper client
ChaimMapperClient mapper = ChaimConfig.createMapper();

// Save user
User user = new User("user-123", "john@example.com", "John Doe");
mapper.save(user);

// Find user
Optional<User> found = mapper.findById(User.class, "user-123");

// Query users
List<User> activeUsers = mapper.findByField(User.class, "isActive", true);
```

## CLI Commands

```bash
# Verify and install all prerequisites
chaim init

# Generate SDK from CDK stack
chaim generate --stack MyStack --package com.example

# Validate schemas
chaim validate ./schemas/user.bprint

# Check environment and dependencies
chaim doctor
```

### Init Command Options

```bash
# Basic prerequisite verification and installation
chaim init

# Install missing dependencies automatically
chaim init --install

# Verify prerequisites only (no installation)
chaim init --verify-only

# Bootstrap CDK in specific region
chaim init --region us-west-2
```

### What `chaim init` Does

The init command focuses specifically on **prerequisite verification and dependency installation**:

**Prerequisites Checked:**
- ✅ **Node.js** version (requires v18+)
- ✅ **Java** installation (requires 11+)
- ✅ **AWS CLI** availability and configuration
- ✅ **CDK CLI** installation
- ✅ **AWS credentials** validity
- ✅ **CDK bootstrap** status in your region

**Dependencies Installed:**
- 📦 **CDK CLI** (if missing): `npm install -g aws-cdk`
- 📦 **chaim-cli dependencies** (if missing)
- 📦 **CDK bootstrap** (if not already done)

**Output Example:**
```bash
$ chaim init

🔍 Checking prerequisites...
✓ Node.js v18.17.0 (required: v18+)
✓ Java 11.0.19 (required: 11+)
✓ AWS CLI 2.13.0
✓ AWS credentials configured (Account: 123456789012)
✓ CDK CLI 2.100.0
✓ CDK bootstrapped in us-east-1

📦 Installing dependencies...
✓ All dependencies up to date

🎉 Prerequisites setup complete!
```

## Optional Configuration

Create `chaim.json` to avoid repeating command-line parameters:

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

Then use: 
```bash
chaim generate
```

## Supported Field Types

- `string` → `String`
- `number` → `Double`
- `bool` → `Boolean`
- `timestamp` → `Instant`

*For the complete list, see [chaim-bprint-spec](https://github.com/chaim-builder/chaim-bprint-spec).*

## Related Projects

- [chaim-bprint-spec](https://github.com/chaim-builder/chaim-bprint-spec) - Schema specification and validation
- [chaim-cdk](https://github.com/chaim-builder/chaim-cdk) - AWS CDK constructs for infrastructure

## Getting Help

- **Documentation**: [chaim-bprint-spec](https://github.com/chaim-builder/chaim-bprint-spec)
- **Issues**: [GitHub Issues](https://github.com/chaim-builder/chaim-cli/issues)
- **Examples**: [chaim-examples](https://github.com/chaim-builder/chaim-examples)
- **Community**: [Discord](https://discord.gg/chaim)

---

## Why chaim?

Chaim means life, representing our mission: **supporting the life (data) of software applications** as they grow and evolve alongside businesses.