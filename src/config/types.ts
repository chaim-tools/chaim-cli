/**
 * Configuration Type Definitions
 *
 * This module defines the configuration file structures for the Chaim CLI.
 * Configuration is loaded from two sources:
 *
 * 1. Global config: ~/.chaim/config.json
 *    - User-wide defaults that apply to all projects
 *
 * 2. Repo config: ./chaim.json (in project root)
 *    - Project-specific overrides
 *
 * Resolution order: Repo config values override global config values.
 *
 * NOTE: File I/O is not implemented yet. This module only defines types.
 */

/**
 * Authentication profile stored in global config
 */
export interface AuthProfile {
  /** Profile name (e.g., "default", "work", "personal") */
  name: string;
  /** User identifier (email or ID) */
  userId?: string;
  /** Organization context */
  orgId?: string;
  /** Token expiry timestamp (ISO 8601) */
  tokenExpiry?: string;
  // Note: Actual tokens should be stored in secure storage (keychain),
  // not in the config file. This interface only tracks metadata.
}

/**
 * Global configuration stored at ~/.chaim/config.json
 *
 * Contains user-wide defaults and authentication profiles.
 */
export interface GlobalChaimConfig {
  /** Schema version for config file format */
  configVersion?: string;

  /** Active authentication profile name */
  activeProfile?: string;

  /** List of authentication profiles (metadata only, tokens stored securely) */
  profiles?: AuthProfile[];

  /** Default AWS region */
  defaultRegion?: string;

  /** Default Java package name for code generation */
  defaultJavaPackage?: string;

  /** Default output directory for generated code */
  defaultOutput?: string;

  /** Telemetry opt-out flag */
  telemetryOptOut?: boolean;
}

/**
 * Repository/project configuration stored at ./chaim.json
 *
 * Contains project-specific settings that override global defaults.
 */
export interface RepoChaimConfig {
  /** Schema version for config file format */
  configVersion?: string;

  /** Linked Chaim application ID */
  appId?: string;

  /** Environment name (e.g., "dev", "staging", "prod") */
  environment?: string;

  /** AWS region for this project */
  region?: string;

  /** CloudFormation stack name */
  stackName?: string;

  /** Java package name for code generation */
  javaPackage?: string;

  /** Output directory for generated code */
  output?: string;

  /** Specific tables to include (if not all) */
  tables?: string[];
}

/**
 * Resolved configuration after merging global and repo configs
 *
 * This represents the effective configuration used by CLI commands.
 * Values are resolved with repo config taking precedence over global.
 */
export interface ResolvedChaimConfig {
  // === Source tracking ===
  /** Path to global config file (if loaded) */
  globalConfigPath?: string;
  /** Path to repo config file (if loaded) */
  repoConfigPath?: string;

  // === Authentication ===
  /** Active profile name */
  activeProfile?: string;
  /** Whether user is currently authenticated */
  isAuthenticated: boolean;

  // === Project context ===
  /** Linked Chaim application ID */
  appId?: string;
  /** Environment name */
  environment?: string;

  // === AWS/Infrastructure ===
  /** AWS region */
  region: string;
  /** CloudFormation stack name */
  stackName?: string;

  // === Code generation ===
  /** Java package name */
  javaPackage?: string;
  /** Output directory */
  output: string;
  /** Specific tables to include */
  tables?: string[];
}

/**
 * Default values for resolved configuration
 */
export const CONFIG_DEFAULTS: Partial<ResolvedChaimConfig> = {
  region: 'us-east-1',
  output: './src/main/java',
  isAuthenticated: false,
};

/**
 * Well-known file paths for configuration
 */
export const CONFIG_PATHS = {
  /** Global config directory */
  globalDir: '~/.chaim',
  /** Global config file */
  globalFile: '~/.chaim/config.json',
  /** Repo config file (relative to project root) */
  repoFile: './chaim.json',
} as const;


