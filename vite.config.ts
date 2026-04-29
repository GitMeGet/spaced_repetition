import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.GITHUB_ACTIONS && repository ? `/${repository}/` : '/';

export default defineConfig({
  base,
  plugins: [svelte()]
});
