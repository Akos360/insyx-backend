import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const SORT_BY = ['title', 'authors', 'publicationYear', 'field', 'citedByCount'] as const;
export type WorksSortBy = (typeof SORT_BY)[number];

// class-transformer's @Type(() => Boolean) would coerce ANY non-empty string
// (including the literal string "false") to `true`, since Boolean('false') is
// truthy — so booleans need an explicit string-aware transform instead.
function toBoolean({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
}

export class WorksQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1800)
  @Max(2200)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1800)
  @Max(2200)
  yearFrom?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1800)
  @Max(2200)
  yearTo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  domain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  field?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  is_oa?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsIn(SORT_BY)
  sortBy?: WorksSortBy;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';
}
