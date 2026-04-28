import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateStudyChapterDto {
  @IsString()
  title: string;

  @IsNumber()
  @Min(0.25)
  @Max(1000)
  estimatedHours: number;

  @IsOptional()
  @IsString()
  source?: string;
}

export class CreateStudySubjectDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  weight?: number;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStudyChapterDto)
  chapters?: CreateStudyChapterDto[];
}

export class CreateStudyPlanDto {
  @IsString()
  title: string;

  @IsString()
  examType: string;

  @IsString()
  examName: string;

  @IsDateString()
  examDate: string;

  @IsString()
  employmentType: string;

  @IsNumber()
  @Min(0)
  @Max(24)
  weekdayHours: number;

  @IsNumber()
  @Min(0)
  @Max(24)
  weekendHours: number;

  @IsOptional()
  @IsBoolean()
  holidayEnabled?: boolean;

  @IsOptional()
  @IsString()
  promptVersion?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStudySubjectDto)
  subjects?: CreateStudySubjectDto[];
}

export class UpdateStudyPlanDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  examType?: string;

  @IsOptional()
  @IsString()
  examName?: string;

  @IsOptional()
  @IsDateString()
  examDate?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  weekdayHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  weekendHours?: number;

  @IsOptional()
  @IsBoolean()
  holidayEnabled?: boolean;
}

export class UpdateStudySubjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  weight?: number;

  @IsOptional()
  @IsString()
  level?: string;
}

export class UpdateStudyChapterDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(1000)
  estimatedHours?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class SearchExamInfoDto {
  @IsString()
  query: string;
}

export class ConfirmSearchSourceDto {
  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsString()
  url: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsString()
  query: string;
}

export class UploadOcrDto {
  @IsString()
  imageUrl: string;

  @IsString()
  rawText: string;

  @IsOptional()
  parsedResult?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class ConfirmOcrDto {
  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsArray()
  chapters?: Array<{ title: string; estimatedHours?: number }>;
}

export class AiAssistDto {
  @IsString()
  step: string; // 'exam_type' | 'exam_info' | 'schedule' | 'subjects'

  @IsString()
  userMessage: string;

  @IsOptional()
  context?: Record<string, unknown>; // current onboarding state
}

