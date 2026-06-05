// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');
const httpProxy = require('http-proxy');

const config = getDefaultConfig(__dirname);

config.cacheStores = [
  new FileStore({ root: path.join(__dirname, '.metro-cache', 'cache') }),
];

config.maxWorkers = 2;

// Proxy /api/* and /health HTTP requests from the browser to the FastAPI backend
// so both the frontend (port 5000) and backend (port 8080) share the same origin.
const proxy = httpProxy.createProxyServer({
  target: 'http://localhost:8080',
  changeOrigin: true,
});

proxy.on('error', (err, req, res) => {
  console.error('[proxy error]', err.message);
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detail: 'Backend unreachable' }));
  }
});

config.server = {
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      const url = req.url || '';
      if (url.startsWith('/api') || url === '/health') {
        proxy.web(req, res);
      } else {
        middleware(req, res, next);
      }
    };
  },
};

module.exports = config;
