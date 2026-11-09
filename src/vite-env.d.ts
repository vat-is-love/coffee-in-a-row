/// <reference types="vite/client" />

interface Window { CoffeeRecovery?: { diagnostics(): { webBuild: string; stage: string; ready: boolean; online: boolean; events: unknown[] }; isReady(): boolean; log(kind: string, detail?: string): void; stage(value: string): void; ready(): void; fail(code: string): void }; }
