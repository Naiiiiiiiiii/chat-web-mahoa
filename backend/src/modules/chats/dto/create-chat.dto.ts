import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateChatDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  is_group?: boolean;

  @IsArray()
  members: number[];
}
