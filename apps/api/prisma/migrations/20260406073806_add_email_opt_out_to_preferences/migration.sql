-- AlterTable
ALTER TABLE "notification_channel_configs" ADD COLUMN     "emailEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "emailOptOut" BOOLEAN NOT NULL DEFAULT false;

-- RenameIndex
ALTER INDEX "notification_channel_configs_organizationId_notificationType_ke" RENAME TO "notification_channel_configs_organizationId_notificationTyp_key";
