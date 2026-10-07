/** The command line was called in a way it cannot act on. The entry point exits with status 2. */
export class UsageError extends Error {}

/** `style-guide.config.json` holds something the branch flow cannot use. */
export class ConfigError extends UsageError {}
