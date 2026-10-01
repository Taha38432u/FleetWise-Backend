import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

export interface JwtUserPayload {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  organizationId?: string | null;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  user: JwtUserPayload;
}
