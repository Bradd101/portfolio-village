import { defineConfig } from 'vite';

// In dev, Vite only serves static/JS. PHP endpoints (contact.php,
// ask-villager.php) are proxied to a local PHP built-in server so the
// contact form and AI villager can be tested without deploying.
// Run: php -S localhost:8787 -t public
export default defineConfig({
  server: {
    proxy: {
      '/contact.php': 'http://localhost:8787',
      '/ask-villager.php': 'http://localhost:8787',
    },
  },
});
