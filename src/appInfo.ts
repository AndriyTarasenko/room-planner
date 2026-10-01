/** Replaced at build time by `define` in vite.config.ts. */
declare const __APP_INFO__: {
  /** package.json version. */
  version: string;
  /** Short commit hash of CI builds; empty for local builds. */
  commit: string;
  /** Public source repository, or empty when none is configured. */
  repositoryUrl: string;
};

export const APP_INFO = __APP_INFO__;
