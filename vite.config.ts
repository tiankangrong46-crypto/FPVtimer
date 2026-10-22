import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
  plugins: [vue()],
  build: { target: 'chrome111' },
  server: {
    port: 1420, strictPort: true,
    watch: { ignored: ['**/.tools/**', '**/src-tauri/**', '**/Android/**'] },
  },
  clearScreen: false,
});
