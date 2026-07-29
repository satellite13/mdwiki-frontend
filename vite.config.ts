/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

function gitShortSha(): string {
  const fromEnv = process.env.APP_GIT_SHA?.trim()
  if (fromEnv) return fromEnv
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim() || 'unknown'
  } catch {
    return 'unknown'
  }
}

/** Release tag from git (e.g. v0.1.0 or v0.1.0-1-g5f79f6b). */
function versionTag(): string {
  const fromEnv = process.env.APP_VERSION_TAG?.trim()
  if (fromEnv) return fromEnv
  try {
    return (
      execSync('git describe --tags --always', { encoding: 'utf8' }).trim() ||
      `v${pkg.version}`
    )
  } catch {
    return `v${pkg.version}`
  }
}

export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_GIT_SHA__: JSON.stringify(gitShortSha()),
    __APP_VERSION_TAG__: JSON.stringify(versionTag())
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts']
  }
})
