-- AlterEnum: remove APPLE from AuthProvider
-- Cleanup from previous partial attempt: column still uses AuthProvider_old,
-- and a new AuthProvider type was created but never wired to the column.
DROP TYPE IF EXISTS "AuthProvider";
ALTER TYPE "AuthProvider_old" RENAME TO "AuthProvider_fresh";
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE');
ALTER TABLE "users" ALTER COLUMN "authProvider" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "authProvider" TYPE "AuthProvider" USING ("authProvider"::text::"AuthProvider");
ALTER TABLE "users" ALTER COLUMN "authProvider" SET DEFAULT 'EMAIL';
DROP TYPE "AuthProvider_fresh";
