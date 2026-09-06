import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import net from 'net';
import { spawn } from 'child_process';
import { defineConfig } from 'vite';

// Ensure the FastAPI backend server is running in development
function ensureFastAPIServer() {
  let spawned = false;
  const start = () => {
    if (spawned) return;
    spawned = true;
    try {
      // Use 'python' on Windows, 'python3' on Unix
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const child = spawn(pythonCmd, ['-m', 'uvicorn', 'backend.app.main:app', '--host', '0.0.0.0', '--port', '8001'], {
        cwd: path.resolve(__dirname),
        detached: true,
        stdio: 'ignore',
        shell: process.platform === 'win32',
      });
      child.unref();
      console.log('[TrainETA] Auto-started FastAPI backend on port 8001');
    } catch {
      // Ignored if python or uvicorn is managed externally
    }
  };

  const socket = new net.Socket();
  socket.setTimeout(800);
  socket.connect(8001, '127.0.0.1', () => {
    socket.destroy();
  });
  socket.on('error', () => {
    socket.destroy();
    start();
  });
  socket.on('timeout', () => {
    socket.destroy();
    start();
  });
}

export default defineConfig(() => {
  ensureFastAPIServer();

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: process.env.VITE_FASTAPI_PROXY_TARGET || 'http://127.0.0.1:8001',
          changeOrigin: true,
        },
        '/health': {
          target: process.env.VITE_FASTAPI_PROXY_TARGET || 'http://127.0.0.1:8001',
          changeOrigin: true,
        },
        '/ws': {
          target: process.env.VITE_FASTAPI_PROXY_TARGET || 'http://127.0.0.1:8001',
          changeOrigin: true,
          ws: true,
        },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
