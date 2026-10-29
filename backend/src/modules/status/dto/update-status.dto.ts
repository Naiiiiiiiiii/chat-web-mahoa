import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateStatusDto {
  @IsNotEmpty({ message: 'Invalid status' })
  @IsIn(['online', 'offline'], { message: 'Invalid status' })
  status: 'online' | 'offline';
}
