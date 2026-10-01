import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/types/jwt-payload.type';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
@ApiBearerAuth('JWT-auth')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  async list(
    @CurrentUser() user: JwtUserPayload,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const result = await this.notificationsService.listForUser(
      user.id,
      parseInt(page, 10),
      parseInt(pageSize, 10),
    );
    return { ok: true, data: result.data, meta: result.meta };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    const data = await this.notificationsService.markRead(user.id, id);
    return { ok: true, data };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@CurrentUser() user: JwtUserPayload) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification' })
  async remove(@CurrentUser() user: JwtUserPayload, @Param('id') id: string) {
    await this.notificationsService.remove(user.id, id);
  }
}
