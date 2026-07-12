import { spawn } from 'child_process';

async function main() {
  // 1. Start docker compose
  console.log('Starting Odoo (Docker)...');
  const docker = spawn('docker', ['compose', 'up', '-d'], {
    stdio: 'inherit',
    shell: true,
  });
  await new Promise<void>((resolve, reject) => {
    docker.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`docker compose up exited with code ${code}`));
    });
  });

  // 2. Init Odoo database + module
  console.log('Initializing Odoo database...');
  const init = spawn('bun', ['run', 'scripts/init-odoo.ts'], {
    stdio: 'inherit',
    shell: true,
  });
  await new Promise<void>((resolve, reject) => {
    init.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`init-odoo exited with code ${code}`));
    });
  });

  // 3. Start Next.js
  console.log('Starting frontend...');
  const next = spawn('bun', ['run', 'next', 'dev'], {
    stdio: 'inherit',
    shell: true,
  });
  await new Promise<void>((_, reject) => {
    next.on('exit', (code) => {
      if (code !== 0) reject(new Error(`next dev exited with code ${code}`));
    });
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
