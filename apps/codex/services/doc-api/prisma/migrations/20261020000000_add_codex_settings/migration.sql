-- CreateTable
CREATE TABLE "codex_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "secret" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "codex_settings_pkey" PRIMARY KEY ("key")
);
