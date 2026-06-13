-- CreateTable
CREATE TABLE "FavoriteGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FavoriteGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoritePost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoritePost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoriteGroup_userId_idx" ON "FavoriteGroup"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteGroup_userId_name_key" ON "FavoriteGroup"("userId", "name");

-- CreateIndex
CREATE INDEX "FavoritePost_userId_idx" ON "FavoritePost"("userId");

-- CreateIndex
CREATE INDEX "FavoritePost_groupId_idx" ON "FavoritePost"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoritePost_userId_postId_key" ON "FavoritePost"("userId", "postId");

-- AddForeignKey
ALTER TABLE "FavoriteGroup" ADD CONSTRAINT "FavoriteGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoritePost" ADD CONSTRAINT "FavoritePost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoritePost" ADD CONSTRAINT "FavoritePost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoritePost" ADD CONSTRAINT "FavoritePost_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FavoriteGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
