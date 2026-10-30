import { execSync } from 'child_process';
import path from 'path';

const rootDir = path.resolve(__dirname, '..');

function run(cmd: string) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
}

async function setup() {
  console.log('=== Setting up School Management System v2 ===');
  run('npm run db:migrate');
  run('npm run db:seed');
  console.log('=== Setup Complete ===');
}

setup().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
