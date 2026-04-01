-- AlterTable: add emailOptIn boolean column to users (defaults to true)
ALTER TABLE "users" ADD COLUMN "emailOptIn" BOOLEAN NOT NULL DEFAULT true;
