import { WsException } from '@nestjs/websockets';
import { TrackingGateway } from './tracking.gateway';

describe('TrackingGateway', () => {
  it('rejects unauthenticated socket GPS writes', async () => {
    const gateway = new TrackingGateway({} as any);

    await expect(
      gateway.handleLocationUpdate({
        vehicleId: 'vehicle-id',
        latitude: 24.86,
        longitude: 67.01,
      }),
    ).rejects.toBeInstanceOf(WsException);
  });
});
