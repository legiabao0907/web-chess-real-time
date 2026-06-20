import { IsOptional, IsString, IsBoolean, IsIn } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @IsIn(['dark', 'light'])
  theme?: string;

  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['classic', 'wood', 'neon'])
  boardStyle?: string;

  @IsOptional()
  @IsString()
  @IsIn(['standard', 'neo', 'classic'])
  pieceStyle?: string;
}
