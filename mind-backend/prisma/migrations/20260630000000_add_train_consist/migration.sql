-- CreateTable TrainConsist (zestawienia składów z vagonweb.cz)
CREATE TABLE "TrainConsist" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cislo" TEXT NOT NULL,
    "kategoria" TEXT NOT NULL,
    "nazwa" TEXT,
    "relacja" TEXT,
    "rok" INTEGER NOT NULL,
    "variantsJson" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "TrainConsist_cislo_key" ON "TrainConsist"("cislo");
