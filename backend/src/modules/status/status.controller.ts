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
import { StatusService } from './status.service';
import { UpdateStatusDto } from './dto/update-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

@Controller('status')
@UseGuards(JwtAuthGuard)
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @CurrentUserId() userId: number,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.statusService.updateStatus(userId, dto);
  }

  // Alias for Flask blueprint routing compatibility (/status/status)
  @Post('status')
  @HttpCode(HttpStatus.OK)
  async updateStatusAlias(
    @CurrentUserId() userId: number,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.statusService.updateStatus(userId, dto);
  }

  @Get(':id')
  async getStatus(@Param('id', ParseIntPipe) userId: number) {
    return this.statusService.getStatus(userId);
  }

  // Alias for Flask blueprint routing compatibility (/status/status/:id)
  @Get('status/:id')
  async getStatusAlias(@Param('id', ParseIntPipe) userId: number) {
    return this.statusService.getStatus(userId);
  }
}
