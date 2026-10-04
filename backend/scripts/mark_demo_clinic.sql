-- Fix existing demo clinic: mark as is_demo_clinic = true
-- This hides it from the public login dropdown immediately.
UPDATE clinics SET is_demo_clinic = true WHERE code = 'DEMO-GH01';
SELECT id, name, code, is_demo_clinic FROM clinics WHERE code = 'DEMO-GH01';
