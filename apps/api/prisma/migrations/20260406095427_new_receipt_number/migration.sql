/*
  Warnings:

  - A unique constraint covering the columns `[receiptNumber]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "receiptNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_receiptNumber_key" ON "transactions"("receiptNumber");
