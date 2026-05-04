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

export class DatePhaseMappingDto {
  @IsString()
  date: string;

  @IsOptional()
  @IsString()
  phaseId?: string;

  @IsOptional()
  @IsString()
  phaseName?: string;

  @IsOptional()
  @IsString()
  phaseDesc?: string;
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

  /** Dates (YYYY-MM-DD) with no existing slots — only these days get generated */
  @IsOptional()
  @IsArray()
  missingDates?: string[];

  /** Hard cutoff: do not schedule on or after this date */
  @IsOptional()
  @IsString()
  examDateISO?: string;

  /** Per-day phase assignments for deterministic generation (bypasses LLM) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DatePhaseMappingDto)
  datePhaseMappings?: DatePhaseMappingDto[];
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

  @IsOptional()
  @IsArray()
  @IsDateString({}, { each: true })
  skipDates?: string[];
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
