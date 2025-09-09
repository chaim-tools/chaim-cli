#!/bin/bash

echo "🚀 Setting up Chaim CLI (TypeScript)"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing CLI dependencies..."
cd cli && npm install

# Build the TypeScript CLI
echo "🔨 Building TypeScript CLI..."
npm run build

# Build Java modules (for code generation)
echo "☕ Building Java modules..."
cd ../java
if [ -f "gradlew" ]; then
    ./gradlew :schema-core:build
    ./gradlew :codegen-java:build
    ./gradlew :cdk-integration:build
else
    echo "⚠️  Gradle wrapper not found. Please install Gradle and run:"
    echo "   gradle :schema-core:build"
    echo "   gradle :codegen-java:build"
    echo "   gradle :cdk-integration:build"
fi

echo "✅ Setup complete!"
echo ""
echo "Usage:"
echo "  ./cli/dist/index.js generate --stack MyStack --package com.example"
echo "  ./cli/dist/index.js validate ./shared/examples/user.bprint"
echo "  ./cli/dist/index.js doctor"
