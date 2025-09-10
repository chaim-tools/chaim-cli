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
# Generate SDK from CDK stack (recommended)
chaim generate --stack MyStack --package com.example

# Validate schemas
chaim validate ./schemas/user.bprint

# Check environment
chaim doctor
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