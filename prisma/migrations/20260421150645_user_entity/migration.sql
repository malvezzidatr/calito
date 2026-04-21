/*
  Warnings:

  - Added the required column `activity_level` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `age` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `calorie_goal` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `carbs_goal` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `consent_date` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fat_goal` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gender` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `height` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `onboarding_step` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `protein_goal` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subscription_id` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weight` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'INTENSE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activity_level" "ActivityLevel" NOT NULL,
ADD COLUMN     "age" INTEGER NOT NULL,
ADD COLUMN     "calorie_goal" INTEGER NOT NULL,
ADD COLUMN     "carbs_goal" INTEGER NOT NULL,
ADD COLUMN     "consent_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "consent_given" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fat_goal" INTEGER NOT NULL,
ADD COLUMN     "gender" "Gender" NOT NULL,
ADD COLUMN     "height" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "onboarding_step" TEXT NOT NULL,
ADD COLUMN     "protein_goal" INTEGER NOT NULL,
ADD COLUMN     "subscription_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "weight" DOUBLE PRECISION NOT NULL;
