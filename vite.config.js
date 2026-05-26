import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  // On production build set base to the GitHub Pages sub-path.
  // Dev server stays at '/' so localhost links keep working.
  base: command === 'build' ? '/image-cluster/' : '/',
  plugins: [react()],
  assetsInclude: ['**/*.svg', '**/*.glb'],
  server: { host: true },
}))
