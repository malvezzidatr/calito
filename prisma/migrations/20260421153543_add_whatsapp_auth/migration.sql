-- CreateTable
CREATE TABLE "WhatsappAuth" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappAuth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappAuth_type_name_key" ON "WhatsappAuth"("type", "name");

-- CreateIndex
CREATE INDEX "Meal_user_id_idx" ON "Meal"("user_id");
