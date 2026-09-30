const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runLinkChains() {
  console.log('Generating chain linkage SQL...');
  let sql = 'BEGIN;\n\n';

  // 1. Apollo Books Prototype Chain (8 events)
  sql += `-- Chain 1: Apollo Books Prototype\n`;
  sql += `UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = NULL WHERE id = '4b388730-50ff-4605-aba1-6e427cf395cb';\n`;
  sql += `UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = '4b388730-50ff-4605-aba1-6e427cf395cb' WHERE id = '38adab3e-4a31-42a2-91d1-2fa54366af3c';\n`;
  sql += `UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = '38adab3e-4a31-42a2-91d1-2fa54366af3c' WHERE id = '82343629-e6c4-467a-83b2-88cbd4a1c8ff';\n`;
  sql += `UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = '82343629-e6c4-467a-83b2-88cbd4a1c8ff' WHERE id = '1217926c-9b25-4a6d-bb6d-aae597adcb8e';\n`;
  sql += `UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = '1217926c-9b25-4a6d-bb6d-aae597adcb8e' WHERE id = 'f755bec9-0958-4152-9cdb-5c40d019df3e';\n`;
  sql += `UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = 'f755bec9-0958-4152-9cdb-5c40d019df3e' WHERE id = '39781007-2891-4a22-b086-c3d77a6a9a86';\n`;
  sql += `UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = '39781007-2891-4a22-b086-c3d77a6a9a86' WHERE id = '700bd6f7-7f86-47e7-b057-c5c297df0e1e';\n`;
  sql += `UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = '700bd6f7-7f86-47e7-b057-c5c297df0e1e' WHERE id = 'ca1f900b-14f1-4aff-b896-1e0e4b0f6dee';\n\n`;

  // 2. Spec-Driven Development Framework Evaluation Chain (6 events)
  sql += `-- Chain 2: Spec-Driven Development Framework Evaluation & Synthesis\n`;
  sql += `UPDATE events SET chain_id = 'e1a10002-0000-4000-8000-000000000002', previous_event_id = NULL WHERE id = '2f8c63b4-b250-4c6a-b2fc-d0d13bbc37d4';\n`;
  sql += `UPDATE events SET chain_id = 'e1a10002-0000-4000-8000-000000000002', previous_event_id = '2f8c63b4-b250-4c6a-b2fc-d0d13bbc37d4' WHERE id = '8a2876fa-39f8-40e6-9c91-57b35b265bb6';\n`;
  sql += `UPDATE events SET chain_id = 'e1a10002-0000-4000-8000-000000000002', previous_event_id = '8a2876fa-39f8-40e6-9c91-57b35b265bb6' WHERE id = '8c0f8cf7-208e-421a-a95b-dc716580c48d';\n`;
  sql += `UPDATE events SET chain_id = 'e1a10002-0000-4000-8000-000000000002', previous_event_id = '8c0f8cf7-208e-421a-a95b-dc716580c48d' WHERE id = '0ccbea8c-74e1-4b05-b88f-88945f249c23';\n`;
  sql += `UPDATE events SET chain_id = 'e1a10002-0000-4000-8000-000000000002', previous_event_id = '0ccbea8c-74e1-4b05-b88f-88945f249c23' WHERE id = '9183750d-b12d-4257-8f34-ce6b14f8cdc6';\n`;
  sql += `UPDATE events SET chain_id = 'e1a10002-0000-4000-8000-000000000002', previous_event_id = '9183750d-b12d-4257-8f34-ce6b14f8cdc6' WHERE id = '3c3e5333-2d80-400c-b378-be9868bf6086';\n\n`;

  // 3. Reusable AI Prototype Strategy Chain (2 events)
  sql += `-- Chain 3: Reusable AI Prototype Strategy\n`;
  sql += `UPDATE events SET chain_id = 'e1a10003-0000-4000-8000-000000000003', previous_event_id = NULL WHERE id = '2837fc9a-8e71-4349-a16b-dd2f530b679d';\n`;
  sql += `UPDATE events SET chain_id = 'e1a10003-0000-4000-8000-000000000003', previous_event_id = '2837fc9a-8e71-4349-a16b-dd2f530b679d' WHERE id = 'dbb3fc5c-a503-4c28-a14e-5532f5657897';\n\n`;

  sql += 'COMMIT;\n';

  const migrationFilePath = path.resolve(__dirname, '..', 'supabase', 'migrations', '20261005120000_link_event_chains.sql');
  fs.writeFileSync(migrationFilePath, sql, 'utf8');
  console.log(`Chain linkage SQL written to: ${migrationFilePath}`);

  console.log('Applying chain linkage to Supabase...');
  try {
    const output = execSync(`npx supabase db query --linked -f "${migrationFilePath}"`, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024
    });
    console.log('Chain linkage successfully applied!');
    console.log(output.slice(0, 400));
  } catch (err) {
    console.error('Failed to link chains:', err.message);
    process.exit(1);
  }
}

runLinkChains();
