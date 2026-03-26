-- CreateTable
CREATE TABLE "watch_keywords" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watch_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "watch_keywords_user_id_keyword_key" ON "watch_keywords"("user_id", "keyword");

-- AddForeignKey
ALTER TABLE "watch_keywords" ADD CONSTRAINT "watch_keywords_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
