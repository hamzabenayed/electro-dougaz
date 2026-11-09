import { Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  IsOptional,
  IsIn,
  Matches,
  Min,
  Max
} from 'class-validator';
export class AdjustStockDto {
  @IsUUID() variantId!: string;
  @Type(() => Number) @IsInt() @Min(-1_000_000) @Max(1_000_000) quantity!: number;
  @IsString() @MinLength(1) @MaxLength(500) note!: string;
  @IsOptional() @IsUUID() requestKey?: string;
}
export class StockHistoryQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(['all', 'add', 'remove']) direction = 'all';
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
}
