import { readFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * Deployment settings come from the environment (or a gitignored `.env.local`), so nothing
 * here names a repository or account:
 *
 * - BASE_PATH: the public path the app is served from. GitHub Pages serves project sites
 *   from `/<repository>/`; the deploy workflow passes the path reported by
 *   actions/configure-pages. Defaults to `/` for local development.
 * - REPOSITORY_URL: source link in the About dialog. Inside GitHub Actions it defaults to
 *   the repository being built, so forks link to themselves.
 *
 * Everything injected here ends up in public JavaScript. Never pass secrets.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const githubRepositoryUrl = env.GITHUB_REPOSITORY ? `${env.GITHUB_SERVER_URL || 'https://github.com'}/${env.GITHUB_REPOSITORY}` : '';

  return {
    base: normalizeBasePath(env.BASE_PATH),
    plugins: [react()],
    define: {
      __APP_INFO__: JSON.stringify({
        version: pkg.version,
        commit: env.GITHUB_SHA ? env.GITHUB_SHA.slice(0, 7) : '',
        repositoryUrl: env.REPOSITORY_URL || githubRepositoryUrl,
      }),
    },
    build: {
      // Konva + React make up most of the bundle; fine for a local-first tool.
      chunkSizeWarningLimit: 900,
    },
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  };
});

/** `room-planner`, `/room-planner` or `/room-planner/` → `/room-planner/`; empty → `/`. */
function normalizeBasePath(value: string | undefined): string {
  const trimmed = (value ?? '').trim().replace(/^\/+|\/+$/g, '');
  // Git Bash on Windows rewrites `/room-planner` into a file system path; fail instead of
  // shipping a build whose asset URLs all 404.
  if (/[:\\]/.test(trimmed)) {
    throw new Error(`BASE_PATH must be a URL path such as /room-planner/, got "${value}". In Git Bash, use BASE_PATH=room-planner.`);
  }
  return trimmed ? `/${trimmed}/` : '/';
}
