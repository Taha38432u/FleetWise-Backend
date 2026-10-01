import { Injectable } from '@nestjs/common';
@Injectable()
export class DemoService {
  readonly DEMO_USER = 'demo@fleetwise.local';
  readonly DEMO_ORG = 'demo-org';
  isDemo(userId?: string) { return userId === this.DEMO_USER || false; }
  allowWrite(userId?: string) { return !this.isDemo(userId); }
}
