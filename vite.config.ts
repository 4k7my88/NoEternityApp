import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Social previews need absolute image URLs. On Vercel the production domain is
 * known at build time; elsewhere set SITE_URL (e.g. https://example.com), or the
 * links stay relative.
 */
function siteUrl(): string {
  const explicit = process.env.SITE_URL?.replace(/\/+$/, '');
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : '';
}

function siteUrlPlugin(): Plugin {
  return {
    name: 'site-url',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replaceAll('__SITE_URL__', siteUrl()),
    },
  };
}

export default defineConfig({
  plugins: [siteUrlPlugin()],
  build: {
    target: 'es2022',
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
