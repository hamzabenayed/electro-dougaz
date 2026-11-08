import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

export class ReportQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsIn(['order', 'delivery', 'collection']) basis = 'order';
  @IsOptional() @IsString() @MaxLength(30) status?: string;
  @IsOptional()
  @IsIn(['pending', 'collected', 'received', 'partially_refunded', 'refunded'])
  payment?: string;
  @IsOptional() @IsIn(['cash_on_delivery', 'online_card']) method?: string;
  @IsOptional() @IsString() @MaxLength(80) governorate?: string;
  @IsOptional() @IsUUID() product?: string;
  @IsOptional() @IsUUID() category?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000) offset = 0;
}
export class PaymentEventDto {
  @IsIn(['collected', 'received', 'refunded']) kind!: 'collected' | 'received' | 'refunded';
  @IsInt() @Min(1) @Max(2147483647) amountMillimes!: number;
  @IsString() @MinLength(3) @MaxLength(300) note!: string;
  @IsUUID() requestKey!: string;
}
