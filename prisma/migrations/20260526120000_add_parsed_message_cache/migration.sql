-- CreateTable
CREATE TABLE "ParsedMessageCache" (
    "id" TEXT NOT NULL,
    "normalized_text" TEXT NOT NULL,
    "foods" JSONB NOT NULL,
    "meal_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParsedMessageCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParsedMessageCache_normalized_text_key" ON "ParsedMessageCache"("normalized_text");
