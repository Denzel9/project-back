-- CreateTable
CREATE TABLE "FavoriteUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "favoriteUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteUser_userId_idx" ON "FavoriteUser"("userId");

-- CreateIndex
CREATE INDEX "FavoriteUser_favoriteUserId_idx" ON "FavoriteUser"("favoriteUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteUser_userId_favoriteUserId_key" ON "FavoriteUser"("userId", "favoriteUserId");

-- AddForeignKey
ALTER TABLE "FavoriteUser" ADD CONSTRAINT "FavoriteUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteUser" ADD CONSTRAINT "FavoriteUser_favoriteUserId_fkey" FOREIGN KEY ("favoriteUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
