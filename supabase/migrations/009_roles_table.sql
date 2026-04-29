-- ============================================================================
-- WC2026 Platform — Roles table (replaces email-based admin check)
-- ============================================================================
--
-- All admins from the `admins` table are migrated to `roles` with role='admin'.
-- Future: use roles table exclusively for access control.
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'moderator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_user ON roles(user_id);
CREATE INDEX IF NOT EXISTS idx_roles_role ON roles(role);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Admins can see the roles table
CREATE POLICY "Roles viewable by admins"
  ON roles FOR SELECT
  USING (auth.jwt() ->> 'email' IN (SELECT email FROM admins));

-- Migrate existing admins from the admins table
-- Each admin in the admins table gets an 'admin' role
INSERT INTO roles (user_id, role)
  SELECT au.id, 'admin'
  FROM admins a
  JOIN auth.users au ON au.email = a.email
  ON CONFLICT (user_id) DO NOTHING;

-- Add a note to the audit log about the migration
INSERT INTO admin_audit_log (admin_email, target_user_id, table_name, field_name, note)
  SELECT 'system@migration', NULL, 'roles', 'initial_migration',
    'Migrated ' || COUNT(*)::TEXT || ' admins from admins table to roles table'
  FROM admins
  ON CONFLICT DO NOTHING;
