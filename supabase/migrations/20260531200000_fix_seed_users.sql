-- Temporarily disable constraints to allow deleting the users from auth.users without cascade failures
SET session_replication_role = 'replica';

DELETE FROM auth.users WHERE id IN (
  'a1111111-1111-1111-1111-111111111111', 
  'b2222222-2222-2222-2222-222222222222', 
  'c3333333-3333-3333-3333-333333333333'
);

SET session_replication_role = 'origin';
