import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface NotificationInput {
  title: string;
  message: string;
  type: string;
  actionUrl?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma as any;
  }

  async create(userId: string, input: NotificationInput) {
    return this.db.notification.create({
      data: {
        userId,
        title: input.title,
        message: input.message,
        type: input.type,
        actionUrl: input.actionUrl,
      },
    });
  }

  async notifyRoles(roles: string[], input: NotificationInput) {
    const users = await this.prisma.user.findMany({
      where: { role: { in: roles as any[] } },
      select: { id: true },
    });

    if (!users.length) {
      return [];
    }

    return Promise.all(users.map((user) => this.create(user.id, input)));
  }

  async listForUser(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, totalItems] = await Promise.all([
      this.db.notification.findMany({
        where: { userId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.notification.count({ where: { userId } }),
    ]);

    return {
      data: items,
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: page,
        pageSize,
      },
    };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.db.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.db.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    await this.db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { ok: true };
  }

  async remove(userId: string, id: string) {
    const notification = await this.db.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.db.notification.delete({ where: { id } });
  }
}
