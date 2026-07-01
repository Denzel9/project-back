-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Post_catalog_list_idx" ON "Post"("type", "isPrivate", "isArchived", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Post_deadline_idx" ON "Post"("deadline");

-- CreateIndex
CREATE INDEX "Post_workFormat_idx" ON "Post"("workFormat");
