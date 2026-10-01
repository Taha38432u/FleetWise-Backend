import { Test, TestingModule } from '@nestjs/testing';
import { FuelService } from './fuel.service';
import { FuelRepository } from './fuel.repository';

describe('FuelService', () => {
  let service: FuelService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FuelService, { provide: FuelRepository, useValue: { create: jest.fn(), findByVehicle: jest.fn() } }],
    }).compile();
    service = module.get<FuelService>(FuelService);
  });
  it('should calculate efficiency', async () => {
    expect(service).toBeDefined();
  });
});
