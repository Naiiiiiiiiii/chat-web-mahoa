import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Res,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Post()
  async createChat(
    @CurrentUserId() userId: number,
    @Body() dto: CreateChatDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.chatsService.createChat(userId, dto);
    res.status(result.isNew ? HttpStatus.CREATED : HttpStatus.OK);
    return result.chat;
  }

  @Get()
  async getChats(@CurrentUserId() userId: number) {
    return this.chatsService.getChats(userId);
  }

  @Get(':id')
  async getChatDetail(
    @Param('id', ParseIntPipe) chatId: number,
    @CurrentUserId() userId: number,
  ) {
    return this.chatsService.getChatDetail(chatId, userId);
  }

  @Post(':id/mark_read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Param('id', ParseIntPipe) chatId: number,
    @CurrentUserId() userId: number,
  ) {
    return this.chatsService.markChatAsRead(chatId, userId);
  }
}
