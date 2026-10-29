import { IsNotEmpty, IsString } from 'class-validator';

export class SendMessageDto {
  @IsNotEmpty({ message: 'Missing content' })
  @IsString()
  content: string;

  @IsNotEmpty({ message: 'Missing aes_key_encrypted' })
  aes_key_encrypted: string | Record<string, string>;

  @IsNotEmpty({ message: 'Missing iv' })
  @IsString()
  iv: string;

  @IsNotEmpty({ message: 'Missing tag' })
  @IsString()
  tag: string;
}
