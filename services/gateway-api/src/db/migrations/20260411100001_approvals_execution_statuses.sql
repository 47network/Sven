-- Migration: Add execution lifecycle statuses to approvals table
-- Supports the self-healing pipeline: pending → approved → executing → executed | failed
-- Also adds 'failed' for code_fix/deploy failures after apply

-- Drop the existing check constraint and recreate with new values
ALTER TABLE approvals DROP CONSTRAINT IF EXISTS approvals_status_check;
ALTER TABLE approvals ADD CONSTRAINT approvals_status_check
  CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'executing', 'executed', 'failed'));
