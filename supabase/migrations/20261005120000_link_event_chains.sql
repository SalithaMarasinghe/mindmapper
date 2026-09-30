BEGIN;

-- Chain 1: Apollo Books Prototype
UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = NULL WHERE id = '4b388730-50ff-4605-aba1-6e427cf395cb';
UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = '4b388730-50ff-4605-aba1-6e427cf395cb' WHERE id = '38adab3e-4a31-42a2-91d1-2fa54366af3c';
UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = '38adab3e-4a31-42a2-91d1-2fa54366af3c' WHERE id = '82343629-e6c4-467a-83b2-88cbd4a1c8ff';
UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = '82343629-e6c4-467a-83b2-88cbd4a1c8ff' WHERE id = '1217926c-9b25-4a6d-bb6d-aae597adcb8e';
UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = '1217926c-9b25-4a6d-bb6d-aae597adcb8e' WHERE id = 'f755bec9-0958-4152-9cdb-5c40d019df3e';
UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = 'f755bec9-0958-4152-9cdb-5c40d019df3e' WHERE id = '39781007-2891-4a22-b086-c3d77a6a9a86';
UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = '39781007-2891-4a22-b086-c3d77a6a9a86' WHERE id = '700bd6f7-7f86-47e7-b057-c5c297df0e1e';
UPDATE events SET chain_id = 'e1a10001-0000-4000-8000-000000000001', previous_event_id = '700bd6f7-7f86-47e7-b057-c5c297df0e1e' WHERE id = 'ca1f900b-14f1-4aff-b896-1e0e4b0f6dee';

-- Chain 2: Spec-Driven Development Framework Evaluation & Synthesis
UPDATE events SET chain_id = 'e1a10002-0000-4000-8000-000000000002', previous_event_id = NULL WHERE id = '2f8c63b4-b250-4c6a-b2fc-d0d13bbc37d4';
UPDATE events SET chain_id = 'e1a10002-0000-4000-8000-000000000002', previous_event_id = '2f8c63b4-b250-4c6a-b2fc-d0d13bbc37d4' WHERE id = '8a2876fa-39f8-40e6-9c91-57b35b265bb6';
UPDATE events SET chain_id = 'e1a10002-0000-4000-8000-000000000002', previous_event_id = '8a2876fa-39f8-40e6-9c91-57b35b265bb6' WHERE id = '8c0f8cf7-208e-421a-a95b-dc716580c48d';
UPDATE events SET chain_id = 'e1a10002-0000-4000-8000-000000000002', previous_event_id = '8c0f8cf7-208e-421a-a95b-dc716580c48d' WHERE id = '0ccbea8c-74e1-4b05-b88f-88945f249c23';
UPDATE events SET chain_id = 'e1a10002-0000-4000-8000-000000000002', previous_event_id = '0ccbea8c-74e1-4b05-b88f-88945f249c23' WHERE id = '9183750d-b12d-4257-8f34-ce6b14f8cdc6';
UPDATE events SET chain_id = 'e1a10002-0000-4000-8000-000000000002', previous_event_id = '9183750d-b12d-4257-8f34-ce6b14f8cdc6' WHERE id = '3c3e5333-2d80-400c-b378-be9868bf6086';

-- Chain 3: Reusable AI Prototype Strategy
UPDATE events SET chain_id = 'e1a10003-0000-4000-8000-000000000003', previous_event_id = NULL WHERE id = '2837fc9a-8e71-4349-a16b-dd2f530b679d';
UPDATE events SET chain_id = 'e1a10003-0000-4000-8000-000000000003', previous_event_id = '2837fc9a-8e71-4349-a16b-dd2f530b679d' WHERE id = 'dbb3fc5c-a503-4c28-a14e-5532f5657897';

COMMIT;
