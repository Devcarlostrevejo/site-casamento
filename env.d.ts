declare namespace Cloudflare {
  interface Env {
    FILES: R2Bucket;
  }
}

interface ModelContextTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute(
    input: unknown,
  ): Record<string, unknown> | Promise<Record<string, unknown>>;
}

interface ModelContext {
  registerTool(
    tool: ModelContextTool,
    options?: { signal?: AbortSignal },
  ): void | Promise<void>;
}

interface Document {
  readonly modelContext?: ModelContext;
}
