import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsEnum, IsDateString } from 'class-validator';
import { Gender, ActivityLevel, UserStatus } from '@prisma/client';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  onboarding_step?: string;

  @IsOptional()
  @IsString()
  subscription_id?: string;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsInt()
  age?: number;

  @IsOptional()
  @IsInt()
  calorie_goal?: number;

  @IsOptional()
  @IsInt()
  protein_goal?: number;
  
  @IsOptional()
  @IsInt()
  carbs_goal?: number;

  @IsOptional()
  @IsInt()
  fat_goal?: number;

  @IsOptional()
  @IsBoolean()
  consent_given?: boolean;

  @IsOptional()
  @IsEnum(ActivityLevel)
  activity_level?: ActivityLevel;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsDateString()
  consent_date?: string;
}