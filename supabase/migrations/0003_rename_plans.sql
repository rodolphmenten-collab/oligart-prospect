-- Rename plan_type enum values to match the actual pricing tiers (basique/essentiel/premium)
-- instead of the placeholder starter/premium/enterprise used during early scaffolding.
-- Order matters to avoid name collisions.
alter type plan_type rename value 'premium' to 'essentiel';
alter type plan_type rename value 'enterprise' to 'premium';
alter type plan_type rename value 'starter' to 'basique';
