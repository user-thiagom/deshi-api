CREATE TABLE "StudentWeightRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "bmi" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentWeightRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudentWeightRecord_studentId_recordedAt_idx"
ON "StudentWeightRecord"("studentId", "recordedAt");
ALTER TABLE "StudentWeightRecord"
ADD CONSTRAINT "StudentWeightRecord_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
