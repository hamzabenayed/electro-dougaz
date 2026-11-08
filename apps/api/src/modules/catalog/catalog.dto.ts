import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
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
  IsArray,
  ArrayMaxSize,
  ValidateNested
} from 'class-validator';

export class CatalogQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) maxPrice?: number;
  @IsOptional() @IsIn(['1']) available?: string;
  @IsOptional() @IsIn(['1']) promotion?: string;
  @IsOptional() @IsIn(['newest', 'price_asc', 'price_desc']) sort = 'newest';
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) category?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 24;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset = 0;
}
export class ProductSpecificationDto {
  @IsString() @MinLength(1) @MaxLength(80) label!: string;
  @IsString() @MinLength(1) @MaxLength(300) value!: string;
}
export class ProductVariantDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsString() @MinLength(1) @MaxLength(80) sku!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) priceMillimes!: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  compareAtPriceMillimes?: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000) stockQuantity!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000) lowStockThreshold = 3;
}
export class ProductImageDto {
  @IsString() @MaxLength(7_000_000) @Matches(/^[A-Za-z0-9+/]+={0,2}$/) data!: string;
  @IsString() @MaxLength(180) alt = '';
}
export class CreateCategoryDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsBoolean() isVisible = true;
}
export class CreateProductDto {
  @IsOptional() @IsString() @MaxLength(500) warranty = '';
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProductSpecificationDto)
  specifications: ProductSpecificationDto[] = [];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(19)
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  additionalVariants?: ProductVariantDto[];
  @IsUUID() categoryId!: string;
  @IsString() @MinLength(2) @MaxLength(180) name!: string;
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
  @IsString() @MaxLength(5000) description = '';
  @IsIn(['draft', 'published']) status: 'draft' | 'published' = 'draft';
  @IsString() @MinLength(1) @MaxLength(80) sku!: string;
  @IsOptional() @IsString() @MaxLength(100) variantName = 'Standard';
  @Type(() => Number) @IsInt() @Min(0) @Max(100_000_000) priceMillimes!: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  compareAtPriceMillimes?: number;
  @Type(() => Number) @IsInt() @Min(0) stockQuantity!: number;
  @Type(() => Number) @IsInt() @Min(0) lowStockThreshold = 3;
}
export class UpdateProductDto extends CreateProductDto {}
export class AccessoriesDto {
  @IsArray() @ArrayMaxSize(8) @IsUUID('4', { each: true }) ids!: string[];
}
export class PromotionScheduleDto {
  @IsOptional()
  @IsDateString({ strict: true })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt?: string | null;
  @IsOptional()
  @IsDateString({ strict: true })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/)
  endsAt?: string | null;
}
