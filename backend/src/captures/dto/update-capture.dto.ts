import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCaptureDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sourceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceName?: string;
}
