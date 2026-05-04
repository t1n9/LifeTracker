import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class GeneratePhasePlansDto {
  @IsString()
  userIntent: string;
}

export class PhasePlanItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNumber()
  @Min(0)
  sortOrder: number;
}

export class ConfirmPhasePlansDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhasePlanItemDto)
  phases: PhasePlanItemDto[];
}

export class UpdatePhasePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class ExpandWeekDto {
  @IsDateString()
  weekStart: string;

  @IsOptional()
  @IsString()
  phaseId?: string;

  @IsOptional()
  @IsString()
  userIntent?: string;
}

export class WeekSlotDraftDto {
  @IsDateString()
  date: string;

  @IsString()
  chapterId: string;

  @IsOptional()
  @IsString()
  chapterTitle?: string;

  @IsOptional()
  @IsString()
  subjectName?: string;

  @IsNumber()
  @Min(0.25)
  plannedHours: number;

  @IsOptional()
  @IsString()
  timeSegment?: string;

  @IsOptional()
  @IsString()
  phaseId?: string;
}

export class ConfirmWeekDto {
  @IsDateString()
  weekStart: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeekSlotDraftDto)
  slots: WeekSlotDraftDto[];

  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;
}

export class EstimateHoursDto {
}

export class PlanChatDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  weekStart?: string;
}

export class PlanExecuteDto {
  @IsString()
  action: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  weekStart?: string;

  @IsOptional()
  parsedIntent?: unknown;
}
