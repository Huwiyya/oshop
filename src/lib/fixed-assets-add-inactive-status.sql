-- Migration to add 'inactive' status to existing fixed_assets
-- Run this ONLY if you already have the fixed_assets table

-- Update the status constraint to include 'inactive'
ALTER TABLE fixed_assets 
DROP CONSTRAINT IF EXISTS fixed_assets_status_check;

ALTER TABLE fixed_assets 
ADD CONSTRAINT fixed_assets_status_check 
CHECK (status IN ('active', 'inactive', 'disposed', 'under_maintenance'));

-- Optional: If you want to set any fully depreciated assets to 'inactive'
-- Uncomment the following lines:

-- UPDATE fixed_assets
-- SET status = 'inactive'
-- WHERE status = 'active' 
--   AND accumulated_depreciation >= (acquisition_cost - residual_value)
--   AND depreciation_method != 'none';
