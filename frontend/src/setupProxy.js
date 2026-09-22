/* eslint-disable */
/**
 * Dev-only. `npm start` loads this instead of package.json "proxy".
 *
 * The old catch-all proxy forwarded unknown SPA paths (hard refresh of
 * /owasp-top-10, /labs/:id, …) to FastAPI, which returned JSON 404.
 * Proxy only backend prefixes; webpack-dev-server historyApiFallback
 * serves index.html for the rest. Docker nginx already uses try_files.
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

const target = process.env.REACT_APP_PROXY_TARGET || 'http://127.0.0.1:8000';

module.exports = function setupProxy(app) {
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
  });
  app.use('/api', proxy);
  app.use('/media', proxy);
};
