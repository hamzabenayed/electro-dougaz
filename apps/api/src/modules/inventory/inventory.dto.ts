import { Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, MaxLength } from 'class-validator';
export class AdjustStockDto {
  @IsUUID() variantId!: string;
  @Type(() => Number) @IsInt() quantity!: number;
  @IsString() @MaxLength(500) note!: string;
}
