import { Controller, Get } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';

@Controller()
export class RealtimeController {
  constructor(private readonly chatGateway: ChatGateway) {}

  @Get('_connected_users')
  getConnectedUsers() {
    return {
      connected_users: this.chatGateway.getConnectedUserIds(),
    };
  }
}
