-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserProfile" AS ENUM ('PROFESSIONAL', 'STUDENT');

-- CreateEnum
CREATE TYPE "LinkStatus" AS ENUM ('PENDENTE', 'ATIVO', 'RECUSADO');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDENTE', 'ACEITO', 'RECUSADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "ActivityOrigin" AS ENUM ('PADRAO', 'PERSONALIZADA');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'PAUSED', 'COMPLETED', 'INTERRUPTED');

-- CreateEnum
CREATE TYPE "SessionActivityStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PAUSED', 'RESTING', 'COMPLETED', 'INCOMPLETE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "profile" "UserProfile" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modality" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Modality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalModality" (
    "professionalId" TEXT NOT NULL,
    "modalityId" TEXT NOT NULL,

    CONSTRAINT "ProfessionalModality_pkey" PRIMARY KEY ("professionalId","modalityId")
);

-- CreateTable
CREATE TABLE "Link" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "LinkStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mediaUrl" TEXT,
    "muscleGroup" TEXT,
    "modalityId" TEXT NOT NULL,
    "origin" "ActivityOrigin" NOT NULL,
    "professionalId" TEXT,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityFieldDefinition" (
    "activityId" TEXT NOT NULL,
    "fields" JSONB NOT NULL,

    CONSTRAINT "ActivityFieldDefinition_pkey" PRIMARY KEY ("activityId")
);

-- CreateTable
CREATE TABLE "ActivityConfiguration" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modalityId" TEXT NOT NULL,
    "iconUrl" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramActivity" (
    "programId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "activityId" TEXT NOT NULL,
    "prescribed" JSONB,

    CONSTRAINT "ProgramActivity_pkey" PRIMARY KEY ("programId","order")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "programId" TEXT,
    "legacyProgramId" TEXT,
    "programVersion" INTEGER,
    "studentId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "pauseStartedAt" TIMESTAMP(3),
    "pausedDurationMs" BIGINT,
    "finishedAt" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionActivity" (
    "sessionId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "SessionActivityStatus" NOT NULL,
    "nameSnapshot" TEXT,
    "mediaUrlSnapshot" TEXT,
    "muscleGroupSnapshot" TEXT,
    "timeTracking" JSONB,
    "observations" TEXT[],
    "prescribed" JSONB,
    "execution" JSONB,

    CONSTRAINT "SessionActivity_pkey" PRIMARY KEY ("sessionId","order")
);

-- CreateTable
CREATE TABLE "RevokedToken" (
    "jti" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevokedToken_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ProfessionalModality_modalityId_idx" ON "ProfessionalModality"("modalityId");

-- CreateIndex
CREATE INDEX "Link_studentId_status_idx" ON "Link"("studentId", "status");

-- CreateIndex
CREATE INDEX "Link_professionalId_status_idx" ON "Link"("professionalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Link_professionalId_studentId_key" ON "Link"("professionalId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");

-- CreateIndex
CREATE INDEX "Invite_professionalId_studentId_status_idx" ON "Invite"("professionalId", "studentId", "status");

-- CreateIndex
CREATE INDEX "Invite_expiresAt_idx" ON "Invite"("expiresAt");

-- CreateIndex
CREATE INDEX "Activity_modalityId_origin_idx" ON "Activity"("modalityId", "origin");

-- CreateIndex
CREATE INDEX "Activity_professionalId_modalityId_idx" ON "Activity"("professionalId", "modalityId");

-- CreateIndex
CREATE INDEX "ActivityConfiguration_activityId_professionalId_idx" ON "ActivityConfiguration"("activityId", "professionalId");

-- CreateIndex
CREATE INDEX "Program_studentId_createdAt_idx" ON "Program"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "Program_professionalId_createdAt_idx" ON "Program"("professionalId", "createdAt");

-- CreateIndex
CREATE INDEX "ProgramActivity_activityId_idx" ON "ProgramActivity"("activityId");

-- CreateIndex
CREATE INDEX "WorkoutSession_studentId_startedAt_idx" ON "WorkoutSession"("studentId", "startedAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_professionalId_startedAt_idx" ON "WorkoutSession"("professionalId", "startedAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_programId_idx" ON "WorkoutSession"("programId");

-- CreateIndex
CREATE INDEX "SessionActivity_activityId_idx" ON "SessionActivity"("activityId");

-- CreateIndex
CREATE INDEX "SessionActivity_status_idx" ON "SessionActivity"("status");

-- CreateIndex
CREATE INDEX "RevokedToken_expiresAt_idx" ON "RevokedToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "ProfessionalModality" ADD CONSTRAINT "ProfessionalModality_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalModality" ADD CONSTRAINT "ProfessionalModality_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityFieldDefinition" ADD CONSTRAINT "ActivityFieldDefinition_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityConfiguration" ADD CONSTRAINT "ActivityConfiguration_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityConfiguration" ADD CONSTRAINT "ActivityConfiguration_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramActivity" ADD CONSTRAINT "ProgramActivity_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramActivity" ADD CONSTRAINT "ProgramActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionActivity" ADD CONSTRAINT "SessionActivity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionActivity" ADD CONSTRAINT "SessionActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

