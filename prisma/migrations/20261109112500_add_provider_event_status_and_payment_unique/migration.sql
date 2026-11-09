-- AlterTable
ALTER TABLE "ProviderEvent" ADD COLUMN "error" TEXT,
ADD COLUMN "processingStatus" TEXT DEFAULT 'PENDING';

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerPaymentId_key" ON "Payment"("provider", "providerPaymentId");
