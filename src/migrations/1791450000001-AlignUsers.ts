import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignUsers1791450000001 implements MigrationInterface {
  name = 'AlignUsers1791450000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
-- Preserve accounts from both the original feature schema and pulled main.
DO $$
DECLARE
    old_name TEXT;
    new_name TEXT;
BEGIN
    FOR old_name, new_name IN
        SELECT * FROM (VALUES
            ('display_name', 'name'), ('google_subject', 'googleId'),
            ('avatar_url', 'avatarUrl'), ('email_verified', 'emailVerified'),
            ('last_login_at', 'lastLoginAt'), ('created_at', 'createdAt'),
            ('updated_at', 'updatedAt')
        ) AS names(old_column, new_column)
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = old_name) THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = new_name) THEN
                RAISE EXCEPTION 'users contains both % and %; reconcile these columns before migrating', old_name, new_name;
            END IF;
            EXECUTE format('ALTER TABLE public.users RENAME COLUMN %I TO %I', old_name, new_name);
        END IF;
    END LOOP;
END $$;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS name VARCHAR(200),
    ADD COLUMN IF NOT EXISTS affiliation VARCHAR(200),
    ADD COLUMN IF NOT EXISTS "passwordHash" VARCHAR,
    ADD COLUMN IF NOT EXISTS "googleId" VARCHAR(255),
    ADD COLUMN IF NOT EXISTS "resetTokenHash" VARCHAR,
    ADD COLUMN IF NOT EXISTS "resetTokenExpiresAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "avatarUrl" VARCHAR(2048),
    ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.users
    ALTER COLUMN name DROP NOT NULL,
    ALTER COLUMN name TYPE VARCHAR(200),
    ALTER COLUMN email TYPE VARCHAR(254);

-- Normalize old records. Conflicting emails abort the transaction; never merge identities.
UPDATE public.users SET email = lower(btrim(email)) WHERE email IS DISTINCT FROM lower(btrim(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON public.users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_google_subject_unique ON public.users ("googleId");
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_normalized;
ALTER TABLE public.users ADD CONSTRAINT users_email_normalized CHECK (email = lower(btrim(email)) AND email <> '');
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_display_name_nonempty;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_google_subject_nonempty;
ALTER TABLE public.users ADD CONSTRAINT users_google_subject_nonempty CHECK ("googleId" IS NULL OR btrim("googleId") <> '');
    `);
  }

  async down(): Promise<void> {
    throw new Error('This compatibility migration preserves accounts and cannot be automatically reverted');
  }
}
