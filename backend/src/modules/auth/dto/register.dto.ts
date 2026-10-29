import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'Username, password and public_key are required' })
  @IsString()
  username: string;

  @IsNotEmpty({ message: 'Username, password and public_key are required' })
  @IsString()
  password: string;

  @IsNotEmpty({ message: 'Username, password and public_key are required' })
  @IsString()
  public_key: string;

  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsIn(['male', 'female', 'other'])
  gender?: 'male' | 'female' | 'other';

  @IsOptional()
  @IsString()
  date_of_birth?: string;

  @IsOptional()
  @IsString()
  avatar_url?: string;

  @IsOptional()
  @IsString()
  bio?: string;
}
