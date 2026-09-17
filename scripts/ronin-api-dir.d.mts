// Tipos de ronin-api-dir.mjs (importado pelo vite.config.ts e pelo playwright.config.ts).

export declare const WEB_ROOT: string;
export declare const DEFAULT_API_DIR: string;
export declare function readEnvFile(file: string): Record<string, string | undefined>;
export declare function resolveApiDir(): string;
export declare function readApiEnv(): Record<string, string | undefined>;
