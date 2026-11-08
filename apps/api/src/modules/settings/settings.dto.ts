import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsInt() @Min(0) revision!: number;
  @IsString() @MaxLength(30) @Matches(/^$|^\+?[0-9 ()-]{8,30}$/) phone!: string;
  @IsString() @Matches(/^$|^[1-9][0-9]{7,14}$/) whatsapp!: string;
  @IsString() @MaxLength(254) @Matches(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/) contactEmail!: string;
  @IsString() @MaxLength(300) address!: string;
  @IsString() @MaxLength(200) openingHours!: string;
  @IsInt() @Min(0) @Max(1_000_000) deliveryMillimes!: number;
  @IsString() @MaxLength(120) deliveryEstimate!: string;
  @IsString() @MaxLength(254) @Matches(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/) notificationEmail!: string;
}
