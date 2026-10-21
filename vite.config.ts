import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  // Relative asset URLs work both at / and GitHub Pages' /slate-whiteboard/.
  base: './',
  plugins: [react(), tailwind()],
});
