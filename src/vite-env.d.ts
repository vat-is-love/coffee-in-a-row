/// <reference types="vite/client" />

interface Window { CoffeeRecovery?: { isReady(): boolean; log(kind: string, detail?: string): void; stage(value: string): void; ready(): void; fail(code: string): void }; }
