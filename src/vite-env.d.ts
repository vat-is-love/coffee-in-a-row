/// <reference types="vite/client" />

declare module '@game/levels/match3.json' {
  const level: import('./game/levels/match3').Match3Level;
  export default level;
}

declare module '@game/levels/falling.json' {
  const level: import('./game/logic/falling').FallingLevel;
  export default level;
}

declare module '@game/levels/story.json' {
  type StoryConfig = import('./game/levels/story').StoryConfig;
  const story: StoryConfig & { largeBoard: StoryConfig['board'] };
  export default story;
}

interface Window { CoffeeRecovery?: { diagnostics(): { webBuild: string; stage: string; ready: boolean; online: boolean; events: unknown[] }; isReady(): boolean; log(kind: string, detail?: string): void; stage(value: string): void; ready(): void; fail(code: string): void }; }
