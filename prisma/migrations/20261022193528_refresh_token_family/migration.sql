ALTER TABLE "RefreshToken" ADD COLUMN     "familyId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");
