-- CreateTable
CREATE TABLE "RouteDefinition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RouteControl" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "routeDefinitionId" INTEGER NOT NULL,
    "acquiredAt" TEXT NOT NULL,
    "lastDrivenAt" TEXT,
    "paperSubmittedAt" TEXT,
    "digitalCopyUri" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RouteControl_routeDefinitionId_fkey" FOREIGN KEY ("routeDefinitionId") REFERENCES "RouteDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
