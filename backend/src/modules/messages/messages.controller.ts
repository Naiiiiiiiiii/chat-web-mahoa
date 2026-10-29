import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

@Controller('chats/:chatId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Param('chatId', ParseIntPipe) chatId: number,
    @CurrentUserId() userId: number,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(chatId, userId, dto);
  }

  @Get()
  async getMessages(
    @Param('chatId', ParseIntPipe) chatId: number,
    @CurrentUserId() userId: number,
  ) {
    return this.messagesService.getMessages(chatId, userId);
  }
}
