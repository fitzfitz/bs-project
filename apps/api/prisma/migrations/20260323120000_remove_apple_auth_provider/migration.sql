-- AlterEnum: remove APPLE from AuthProvider
ALTER TYPE "AuthProvider" RENAME TO "AuthProvider_old";
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'GOOGLE');
ALTER TABLE "users" ALTER COLUMN "authProvider" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "authProvider" TYPE "AuthProvider" USING ("authProvider"::text::"AuthProvider");
ALTER TABLE "users" ALTER COLUMN "authProvider" SET DEFAULT 'EMAIL';
DROP TYPE "AuthProvider_old";
