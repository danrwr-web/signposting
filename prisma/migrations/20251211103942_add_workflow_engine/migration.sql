-- CreateEnum: WorkflowNodeType
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkflowNodeType') THEN
    CREATE TYPE "WorkflowNodeType" AS ENUM ('INSTRUCTION', 'QUESTION', 'END');
  END IF;
END $$;

-- CreateEnum: WorkflowInstanceStatus
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkflowInstanceStatus') THEN
    CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
  END IF;
END $$;

-- CreateEnum: WorkflowActionKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkflowActionKey') THEN
    CREATE TYPE "WorkflowActionKey" AS ENUM ('FORWARD_TO_GP', 'FORWARD_TO_PRESCRIBING_TEAM', 'FORWARD_TO_PHARMACY_TEAM', 'FILE_WITHOUT_FORWARDING', 'ADD_TO_YELLOW_SLOT', 'SEND_STANDARD_LETTER', 'CODE_AND_FILE', 'OTHER');
  END IF;
END $$;

-- CreateTable: WorkflowTemplate
CREATE TABLE IF NOT EXISTS "WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "colourHex" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WorkflowNodeTemplate
CREATE TABLE IF NOT EXISTS "WorkflowNodeTemplate" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "nodeType" "WorkflowNodeType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "isStart" BOOLEAN NOT NULL DEFAULT false,
    "actionKey" "WorkflowActionKey",

    CONSTRAINT "WorkflowNodeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WorkflowAnswerOptionTemplate
CREATE TABLE IF NOT EXISTS "WorkflowAnswerOptionTemplate" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueKey" TEXT NOT NULL,
    "description" TEXT,
    "nextNodeId" TEXT,
    "actionKey" "WorkflowActionKey",

    CONSTRAINT "WorkflowAnswerOptionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WorkflowInstance
CREATE TABLE IF NOT EXISTS "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "reference" TEXT,
    "category" TEXT,
    "currentNodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WorkflowAnswerRecord
CREATE TABLE IF NOT EXISTS "WorkflowAnswerRecord" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "nodeTemplateId" TEXT NOT NULL,
    "answerOptionId" TEXT,
    "answerValueKey" TEXT,
    "freeTextNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowAnswerRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: WorkflowTemplate -> Surgery
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'WorkflowTemplate_surgeryId_fkey'
  ) THEN
    ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_surgeryId_fkey" 
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: WorkflowNodeTemplate -> WorkflowTemplate
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'WorkflowNodeTemplate_templateId_fkey'
  ) THEN
    ALTER TABLE "WorkflowNodeTemplate" ADD CONSTRAINT "WorkflowNodeTemplate_templateId_fkey" 
      FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: WorkflowAnswerOptionTemplate -> WorkflowNodeTemplate
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'WorkflowAnswerOptionTemplate_nodeId_fkey'
  ) THEN
    ALTER TABLE "WorkflowAnswerOptionTemplate" ADD CONSTRAINT "WorkflowAnswerOptionTemplate_nodeId_fkey" 
      FOREIGN KEY ("nodeId") REFERENCES "WorkflowNodeTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: WorkflowInstance -> Surgery
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'WorkflowInstance_surgeryId_fkey'
  ) THEN
    ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_surgeryId_fkey" 
      FOREIGN KEY ("surgeryId") REFERENCES "Surgery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: WorkflowInstance -> WorkflowTemplate
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'WorkflowInstance_templateId_fkey'
  ) THEN
    ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_templateId_fkey" 
      FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: WorkflowInstance -> User
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'WorkflowInstance_startedById_fkey'
  ) THEN
    ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_startedById_fkey" 
      FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: WorkflowAnswerRecord -> WorkflowInstance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'WorkflowAnswerRecord_instanceId_fkey'
  ) THEN
    ALTER TABLE "WorkflowAnswerRecord" ADD CONSTRAINT "WorkflowAnswerRecord_instanceId_fkey" 
      FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: WorkflowAnswerRecord -> WorkflowNodeTemplate
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'WorkflowAnswerRecord_nodeTemplateId_fkey'
  ) THEN
    ALTER TABLE "WorkflowAnswerRecord" ADD CONSTRAINT "WorkflowAnswerRecord_nodeTemplateId_fkey" 
      FOREIGN KEY ("nodeTemplateId") REFERENCES "WorkflowNodeTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: WorkflowAnswerRecord -> WorkflowAnswerOptionTemplate
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'WorkflowAnswerRecord_answerOptionId_fkey'
  ) THEN
    ALTER TABLE "WorkflowAnswerRecord" ADD CONSTRAINT "WorkflowAnswerRecord_answerOptionId_fkey" 
      FOREIGN KEY ("answerOptionId") REFERENCES "WorkflowAnswerOptionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

