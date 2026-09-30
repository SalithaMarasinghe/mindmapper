const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TABLES = [
  'events',
  'work_details',
  'meeting_details',
  'weekly_summaries',
  'tasks',
  'task_time_entries',
  'task_status_history',
  'assistant_conversations',
  'assistant_messages',
  'mindmaps',
  'nodes',
  'node_content',
  'map_shares',
  'profiles'
];

const BACKUP_DIR = path.resolve(__dirname, '..', 'backups', 'backup_2026-09-30');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function queryTable(table) {
  const sql = `SELECT COALESCE(json_agg(t), '[]'::json) as data FROM "${table}" t;`;
  const cmd = `npx supabase db query --linked "${sql}"`;
  const output = execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });

  const firstBrace = output.indexOf('{');
  const lastBrace = output.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error(`Failed to find JSON in output for table ${table}:\n${output}`);
  }

  const jsonStr = output.slice(firstBrace, lastBrace + 1);
  const parsed = JSON.parse(jsonStr);
  const rows = parsed.rows && parsed.rows[0] ? parsed.rows[0].data : [];
  return rows;
}

function escapeSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number' || typeof val === 'boolean') return val.toString();
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  return `'${val.toString().replace(/'/g, "''")}'`;
}

function generateTableSql(tableName, rows) {
  if (!rows || rows.length === 0) return `-- No rows in ${tableName}\n`;
  const columns = Object.keys(rows[0]);
  const sqlStatements = [];
  sqlStatements.push(`-- Table: ${tableName} (${rows.length} rows)`);

  for (const row of rows) {
    const colsStr = columns.map(c => `"${c}"`).join(', ');
    const valsStr = columns.map(c => escapeSqlValue(row[c])).join(', ');
    
    // Conflict target
    let conflictTarget = '"id"';
    if (tableName === 'work_details' || tableName === 'meeting_details') {
      conflictTarget = '"event_id"';
    } else if (tableName === 'node_content') {
      conflictTarget = '"node_id"';
    }

    const updates = columns
      .filter(c => c !== 'id' && c !== 'event_id' && c !== 'node_id')
      .map(c => `"${c}" = EXCLUDED."${c}"`)
      .join(', ');

    if (updates) {
      sqlStatements.push(
        `INSERT INTO "${tableName}" (${colsStr}) VALUES (${valsStr}) ON CONFLICT (${conflictTarget}) DO UPDATE SET ${updates};`
      );
    } else {
      sqlStatements.push(
        `INSERT INTO "${tableName}" (${colsStr}) VALUES (${valsStr}) ON CONFLICT (${conflictTarget}) DO NOTHING;`
      );
    }
  }

  return sqlStatements.join('\n') + '\n\n';
}

async function runBackup() {
  console.log(`Starting Supabase backup to ${BACKUP_DIR}...`);
  ensureDir(BACKUP_DIR);

  const fullBackup = {
    metadata: {
      timestamp: new Date().toISOString(),
      supabaseRef: 'ixmvqmfesibpnrjmvzuj',
      tableCounts: {}
    },
    tables: {}
  };

  let sqlDump = `-- Supabase Complete Backup\n-- Date: ${new Date().toISOString()}\n-- Project: ixmvqmfesibpnrjmvzuj\n\nBEGIN;\n\n`;

  // Foreign key order for inserts:
  // 1. profiles
  // 2. mindmaps -> nodes -> node_content -> map_shares
  // 3. tasks -> task_time_entries -> task_status_history
  // 4. events -> work_details -> meeting_details -> weekly_summaries
  // 5. assistant_conversations -> assistant_messages
  const orderedTables = [
    'profiles',
    'mindmaps',
    'nodes',
    'node_content',
    'map_shares',
    'tasks',
    'events',
    'task_time_entries',
    'task_status_history',
    'work_details',
    'meeting_details',
    'weekly_summaries',
    'assistant_conversations',
    'assistant_messages'
  ];

  for (const table of orderedTables) {
    try {
      console.log(`Fetching ${table}...`);
      const rows = queryTable(table);
      fullBackup.tables[table] = rows;
      fullBackup.metadata.tableCounts[table] = rows.length;

      // Save individual table JSON
      fs.writeFileSync(
        path.join(BACKUP_DIR, `${table}.json`),
        JSON.stringify(rows, null, 2),
        'utf8'
      );

      // Append to SQL dump
      sqlDump += generateTableSql(table, rows);
      console.log(`  -> ${table}: ${rows.length} rows saved.`);
    } catch (err) {
      console.error(`  ERROR fetching ${table}:`, err.message);
      fullBackup.metadata.tableCounts[table] = `ERROR: ${err.message}`;
    }
  }

  sqlDump += `COMMIT;\n`;

  // Write full JSON
  fs.writeFileSync(
    path.join(BACKUP_DIR, 'full_database_backup.json'),
    JSON.stringify(fullBackup, null, 2),
    'utf8'
  );

  // Write full SQL
  fs.writeFileSync(
    path.join(BACKUP_DIR, 'restore_database.sql'),
    sqlDump,
    'utf8'
  );

  // Write README with report
  let readme = `# Database Backup Report\n\n`;
  readme += `**Backup Date / Time:** ${fullBackup.metadata.timestamp}\n`;
  readme += `**Supabase Project Ref:** \`${fullBackup.metadata.supabaseRef}\`\n\n`;
  readme += `## Table Summary\n\n`;
  readme += `| Table Name | Row Count | JSON File | Status |\n`;
  readme += `| :--- | :--- | :--- | :--- |\n`;

  for (const table of orderedTables) {
    const count = fullBackup.metadata.tableCounts[table];
    readme += `| \`${table}\` | **${count}** | [\`${table}.json\`](./${table}.json) | ✅ Backed up |\n`;
  }

  readme += `\n## Restoration Instructions\n\n`;
  readme += `### Option A: Via SQL File\n`;
  readme += `Run the included \`restore_database.sql\` against the database using the Supabase SQL Editor or Supabase CLI:\n`;
  readme += `\`\`\`bash\n`;
  readme += `npx supabase db query --linked -f backups/backup_2026-09-30/restore_database.sql\n`;
  readme += `\`\`\`\n\n`;
  readme += `### Option B: Programmatic Restore via Node.js\n`;
  readme += `Run \`node scripts/restore_backup.cjs\` to restore specific tables or the entire backup.\n`;

  fs.writeFileSync(
    path.join(BACKUP_DIR, 'README.md'),
    readme,
    'utf8'
  );

  console.log(`\nBackup successfully completed! Files written to:\n${BACKUP_DIR}`);
}

runBackup();
