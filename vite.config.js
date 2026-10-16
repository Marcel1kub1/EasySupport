import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  kit: {
    adapter: adapter({ out: 'build' }),
    alias: {
      $lib: 'src/lib',
    },
  },
});
