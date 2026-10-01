import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { TrackingController } from './tracking.controller';

describe('TrackingController roles', () => {
  it('allows drivers to post location updates', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, TrackingController.prototype.saveLocation);

    expect(roles).toEqual([
      UserRole.ADMIN,
      UserRole.DISPATCHER,
      UserRole.DRIVER,
    ]);
  });

  it('keeps fleet tracking reads admin and dispatcher only', () => {
    const latestRoles = Reflect.getMetadata(
      ROLES_KEY,
      TrackingController.prototype.getLatest,
    );
    const historyRoles = Reflect.getMetadata(
      ROLES_KEY,
      TrackingController.prototype.getHistory,
    );

    expect(latestRoles).toEqual([UserRole.ADMIN, UserRole.DISPATCHER]);
    expect(historyRoles).toEqual([UserRole.ADMIN, UserRole.DISPATCHER]);
  });
});
