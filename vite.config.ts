import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import os from "os";
import { componentTagger } from "lovable-tagger";

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
        // Prefer Wi-Fi or local LAN subnet (192.168.x.x or 172.x.x.x)
        if (iface.address.startsWith('192.168.')) {
          return iface.address;
        }
      }
    }
  }
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function mobileUploadPlugin(): Plugin {
  const uploadStore = new Map<string, string[]>();
  return {
    name: 'mobile-upload-endpoint',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';

        if (url === '/api/network-ip') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ip: getLocalIpAddress() }));
          return;
        }

        if (url.startsWith('/api/mobile-upload/')) {
          const parts = url.split('/');
          const sessionId = parts[parts.length - 1].split('?')[0];

          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                const incoming: string[] = Array.isArray(parsed.images)
                  ? parsed.images
                  : (parsed.image ? (Array.isArray(parsed.image) ? parsed.image : [parsed.image]) : []);
                
                const existing = uploadStore.get(sessionId) || [];
                uploadStore.set(sessionId, [...existing, ...incoming.filter(Boolean)]);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, count: incoming.length }));
              } catch (e: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message || 'Invalid JSON' }));
              }
            });
            return;
          }

          if (req.method === 'GET') {
            const images = uploadStore.get(sessionId) || [];
            if (images.length > 0) {
              uploadStore.delete(sessionId);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ images }));
            return;
          }
        }
        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    watch: {
      ignored: ['**/whatsapp-service/**']
    }
  },
  plugins: [react(), mobileUploadPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@zegocloud')) {
            return 'vendor-zego';
          }
          if (id.includes('rrweb')) {
            return 'vendor-rrweb';
          }
          if (id.includes('three')) {
            return 'vendor-three';
          }
          if (id.includes('recharts')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules')) {
            return 'vendor-core';
          }
        }
      }
    }
  }
}));
