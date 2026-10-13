import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative URLs work at both / and /REPOSITORY/, including a later custom domain.
export default defineConfig({ plugins: [react()], base: './', resolve: { preserveSymlinks: true }, build: { target: 'es2022' } });
