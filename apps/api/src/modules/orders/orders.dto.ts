import { Type, Transform } from 'class-transformer';
import { normalizePhone } from './phone.js';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';
class CreateOrderItemDto {
  @IsUUID() variantId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10) quantity!: number;
}
export class CreateOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_147_483_647)
  expectedTotalMillimes?: number;
  @IsString() @MinLength(2) @MaxLength(80) firstName!: string;
  @IsString() @MinLength(2) @MaxLength(80) lastName!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizePhone(value) : value
  )
  @Matches(/^[0-9]{8}$/)
  phone!: string;
  @IsString() @MinLength(2) @MaxLength(80) governorate!: string;
  @IsString() @MinLength(5) @MaxLength(500) address!: string;
  @IsIn(['cash_on_delivery', 'online_card']) paymentMethod!: 'cash_on_delivery' | 'online_card';
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
export class QuoteOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
export class TrackOrderDto {
  @IsString() @MaxLength(40) reference!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizePhone(value) : value
  )
  @Matches(/^[0-9]{8}$/)
  phone!: string;
}
export class OrderQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() @MaxLength(30) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 30;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
}
export class UpdateOrderStatusDto {
  @IsIn([
    'confirmed',
    'preparing',
    'shipped',
    'delivered',
    'delivery_failed',
    'returned',
    'cancelled'
  ])
  status!: string;
}
