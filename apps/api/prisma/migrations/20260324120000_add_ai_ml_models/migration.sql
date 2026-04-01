-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChurnRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "demand_forecasts" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "predictedTransactions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "predictedRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceLow" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceHigh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dayOfWeek" INTEGER NOT NULL,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_suggestions" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "staffProfileId" TEXT,
    "date" DATE NOT NULL,
    "suggestedStart" TEXT NOT NULL,
    "suggestedEnd" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "demandScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "churn_scores" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "riskLevel" "ChurnRiskLevel" NOT NULL,
    "features" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "churn_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "demand_forecasts_branchId_date_key" ON "demand_forecasts"("branchId", "date");

-- CreateIndex
CREATE INDEX "demand_forecasts_organizationId_idx" ON "demand_forecasts"("organizationId");

-- CreateIndex
CREATE INDEX "schedule_suggestions_branchId_date_idx" ON "schedule_suggestions"("branchId", "date");

-- CreateIndex
CREATE INDEX "schedule_suggestions_organizationId_idx" ON "schedule_suggestions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "churn_scores_customerId_branchId_key" ON "churn_scores"("customerId", "branchId");

-- CreateIndex
CREATE INDEX "churn_scores_branchId_riskLevel_idx" ON "churn_scores"("branchId", "riskLevel");

-- CreateIndex
CREATE INDEX "churn_scores_organizationId_idx" ON "churn_scores"("organizationId");

-- AddForeignKey
ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_suggestions" ADD CONSTRAINT "schedule_suggestions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_suggestions" ADD CONSTRAINT "schedule_suggestions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "churn_scores" ADD CONSTRAINT "churn_scores_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "churn_scores" ADD CONSTRAINT "churn_scores_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "churn_scores" ADD CONSTRAINT "churn_scores_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
