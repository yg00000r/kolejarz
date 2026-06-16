-- CreateTable Tenant
CREATE TABLE IF NOT EXISTS "Tenant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "portalUsername" TEXT NOT NULL,
    "portalPasswordEncrypted" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable AppSession
CREATE TABLE IF NOT EXISTS "AppSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "AppSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_portalUsername_key" ON "Tenant"("portalUsername");
CREATE UNIQUE INDEX IF NOT EXISTS "AppSession_token_key" ON "AppSession"("token");

-- Add tenantId to Shift (nullable, for backward compat with existing shifts)
ALTER TABLE "Shift" ADD COLUMN "tenantId" INTEGER REFERENCES "Tenant"("id");
