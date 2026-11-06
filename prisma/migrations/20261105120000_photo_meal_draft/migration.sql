CREATE TABLE "PhotoMealDraft" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "foods" JSONB NOT NULL,
  "meal_type" TEXT,
  "message_id" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhotoMealDraft_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PhotoMealDraft_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PhotoMealDraft_user_id_key" ON "PhotoMealDraft"("user_id");
CREATE INDEX "PhotoMealDraft_expires_at_idx" ON "PhotoMealDraft"("expires_at");
ALTER TABLE "Meal" ADD COLUMN "photo_message_id" TEXT;
CREATE UNIQUE INDEX "Meal_photo_message_id_key" ON "Meal"("photo_message_id");
ALTER TABLE public."PhotoMealDraft" ENABLE ROW LEVEL SECURITY;
