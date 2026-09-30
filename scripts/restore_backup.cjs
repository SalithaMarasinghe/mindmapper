const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.resolve(__dirname, '..', 'backups', 'backup_2026-09-30');
const SQL_FILE = path.join(BACKUP_DIR, 'restore_database.sql');

function restoreDatabase() {
  if (!fs.existsSync(SQL_FILE)) {
    console.error(`Error: Backup SQL file not found at ${SQL_FILE}`);
    process.exit(1);
  }

  console.log(`Starting database restoration from ${SQL_FILE}...`);
  try {
    const cmd = `npx supabase db query --linked -f "${SQL_FILE}"`;
    const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    console.log('Restoration completed successfully!');
    console.log(out.slice(0, 500));
  } catch (err) {
    console.error('Restoration failed:', err.message);
    process.exit(1);
  }
}

restoreDatabase();
