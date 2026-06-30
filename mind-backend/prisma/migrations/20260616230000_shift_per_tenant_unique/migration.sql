-- Shift: per-tenant unique (tenantId, date) instead of global date unique
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Shift" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "shiftCode" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "type" TEXT NOT NULL DEFAULT 'presence',
    "allocationId" TEXT,
    "planningLevel" TEXT,
    "timecardStatus" TEXT,
    "tenantId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Shift" (
    "id", "date", "shiftCode", "startTime", "endTime", "type",
    "allocationId", "planningLevel", "timecardStatus", "tenantId", "createdAt", "updatedAt"
)
SELECT
    s."id", s."date", s."shiftCode", s."startTime", s."endTime", s."type",
    s."allocationId", s."planningLevel", s."timecardStatus",
    COALESCE(s."tenantId", (SELECT MIN("id") FROM "Tenant")),
    s."createdAt", s."updatedAt"
FROM "Shift" s
WHERE EXISTS (SELECT 1 FROM "Tenant");

DROP TABLE "Shift";
ALTER TABLE "new_Shift" RENAME TO "Shift";
CREATE UNIQUE INDEX "Shift_tenantId_date_key" ON "Shift"("tenantId", "date");

PRAGMA foreign_keys=ON;
