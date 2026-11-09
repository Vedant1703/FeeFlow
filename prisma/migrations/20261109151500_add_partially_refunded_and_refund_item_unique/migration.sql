-- AlterEnum
ALTER TYPE "RefundStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- CreateIndex
CREATE UNIQUE INDEX "RefundItem_providerRefundId_key" ON "RefundItem"("providerRefundId");
