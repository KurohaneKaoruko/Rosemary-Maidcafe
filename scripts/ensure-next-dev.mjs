import net from 'node:net';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.NEXT_DEV_PORT ?? 3527);
const HOST = process.env.NEXT_DEV_HOST ?? '127.0.0.1';

function isPortOpen(host, port, timeoutMs = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

function runNextDev() {
  const isWindows = process.platform === 'win32';
  const rawCwd = process.cwd();
  const cwd = isWindows && rawCwd.startsWith('\\\\?\\') ? rawCwd.slice(4) : rawCwd;
  const command = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'sh';
  const args = isWindows ? ['/d', '/s', '/c', 'npm run next:dev'] : ['-lc', 'npm run next:dev'];

  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    windowsHide: false,
  });

  child.on('error', (error) => {
    console.error(`[next-dev-ensure] Failed to start next:dev: ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

async function main() {
  const open = await isPortOpen(HOST, PORT);
  if (!open) {
    console.log(`[next-dev-ensure] No dev server on ${HOST}:${PORT}, starting one.`);
    runNextDev();
    return;
  }

  console.log(`[next-dev-ensure] Port ${PORT} is already in use, reusing existing server.`);
  process.exit(0);
}

void main();
