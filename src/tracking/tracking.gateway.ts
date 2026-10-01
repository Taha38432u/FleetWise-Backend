import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { TrackingService } from './tracking.service';

@WebSocketGateway({
  cors: true,
  namespace: '/tracking',
})
export class TrackingGateway {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly trackingService: TrackingService) {}

  async broadcastLocation(payload: any) {
    this.server.emit('location:broadcast', payload);
  }

  @SubscribeMessage('location:update')
  async handleLocationUpdate(@MessageBody() payload: any) {
    throw new WsException(
      'Client GPS writes must use authenticated POST /tracking/location',
    );
  }
}
