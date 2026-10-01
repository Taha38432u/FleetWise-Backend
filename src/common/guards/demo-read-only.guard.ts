import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { isDemoEmail } from '../utils/demo-account';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class DemoReadOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const method = String(request.method || 'GET').toUpperCase();

    if (!WRITE_METHODS.has(method)) {
      return true;
    }

    const path = String(request.originalUrl || request.url || '');
    // Auth session endpoints must still work for demo logins.
    if (
      path.includes('/auth/login') ||
      path.includes('/auth/logout') ||
      path.includes('/auth/refresh') ||
      path.includes('/auth/forgot-password') ||
      path.includes('/auth/reset-password')
    ) {
      return true;
    }

    const email = request.user?.email as string | undefined;
    if (isDemoEmail(email)) {
      throw new ForbiddenException(
        'Demo accounts are read-only. Sign up for a real account to make changes.',
      );
    }

    return true;
  }
}
