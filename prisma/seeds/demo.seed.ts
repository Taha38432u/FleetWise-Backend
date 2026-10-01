import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const DEMO_PASSWORD = 'DemoRead1!';

/**
 * Read-only demo tenancy: admin@demo.com / driver@demo.com / mechanic@demo.com
 * Mutating API calls are blocked by DemoReadOnlyGuard for @demo.com users.
 */
export async function seedDemoAccounts(prisma: PrismaClient) {
  console.log('🎭 Seeding read-only @demo.com accounts...');

  const password = await bcrypt.hash(DEMO_PASSWORD, 10);

  let org = await prisma.organization.findFirst({
    where: { name: 'FleetWise Demo Fleet' },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'FleetWise Demo Fleet' },
    });
  }

  const upsertDemoUser = async (data: {
    email: string;
    firstName: string;
    lastName: string;
    role: 'ADMIN' | 'DRIVER' | 'MECHANIC';
  }) => {
    return prisma.user.upsert({
      where: { email: data.email },
      update: {
        password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role as any,
        status: 'ACTIVE',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        organizationId: org!.id,
      },
      create: {
        email: data.email,
        password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role as any,
        status: 'ACTIVE',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        organizationId: org!.id,
      },
    });
  };

  const admin = await upsertDemoUser({
    email: 'admin@demo.com',
    firstName: 'Demo',
    lastName: 'Admin',
    role: 'ADMIN',
  });

  const driverUser = await upsertDemoUser({
    email: 'driver@demo.com',
    firstName: 'Demo',
    lastName: 'Driver',
    role: 'DRIVER',
  });

  const mechanic = await upsertDemoUser({
    email: 'mechanic@demo.com',
    firstName: 'Demo',
    lastName: 'Mechanic',
    role: 'MECHANIC',
  });

  await prisma.organization.update({
    where: { id: org.id },
    data: { ownerUserId: admin.id },
  });

  await prisma.subscription.upsert({
    where: { userId: admin.id },
    update: {
      plan: 'PRO',
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      provider: 'STRIPE_TEST',
      trialUsed: true,
    } as any,
    create: {
      userId: admin.id,
      plan: 'PRO',
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      provider: 'STRIPE_TEST',
      trialUsed: true,
    } as any,
  });

  const driver = await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: {
      licenseNumber: 'DEMO-DL-0001',
      licenseExpiry: new Date('2027-12-31'),
      licenseStatus: 'VALID',
      yearsOfExperience: 6,
      emergencyContact: 'Demo Contact',
      emergencyContactPhone: '+10000000001',
      availabilityStatus: 'ON_DUTY',
      documentVerified: true,
      backgroundCheckDone: true,
      isVehicleAssigned: true,
    },
    create: {
      userId: driverUser.id,
      licenseNumber: 'DEMO-DL-0001',
      licenseExpiry: new Date('2027-12-31'),
      licenseStatus: 'VALID',
      yearsOfExperience: 6,
      emergencyContact: 'Demo Contact',
      emergencyContactPhone: '+10000000001',
      availabilityStatus: 'ON_DUTY',
      documentVerified: true,
      backgroundCheckDone: true,
      isVehicleAssigned: true,
    },
  });

  const vehicleSpecs = [
    {
      plate: 'DEMO-TRK-01',
      type: 'TRUCK' as const,
      model: 'Volvo FH16',
      year: 2023,
      status: 'ACTIVE' as const,
      mileage: 51200,
      healthScore: 91,
    },
    {
      plate: 'DEMO-VAN-02',
      type: 'VAN' as const,
      model: 'Mercedes Sprinter',
      year: 2022,
      status: 'ACTIVE' as const,
      mileage: 38400,
      healthScore: 88,
    },
    {
      plate: 'DEMO-TRK-03',
      type: 'TRUCK' as const,
      model: 'Scania R450',
      year: 2021,
      status: 'IN_MAINTENANCE' as const,
      mileage: 97600,
      healthScore: 64,
    },
    {
      plate: 'DEMO-CAR-04',
      type: 'CAR' as const,
      model: 'Toyota Innova',
      year: 2024,
      status: 'IDLE' as const,
      mileage: 12100,
      healthScore: 96,
    },
  ];

  const vehicleIds: string[] = [];
  for (const spec of vehicleSpecs) {
    const existing = await prisma.vehicle.findUnique({ where: { plate: spec.plate } });
    let vehicleId: string;
    if (existing) {
      const updated = await prisma.vehicle.update({
        where: { plate: spec.plate },
        data: {
          type: spec.type,
          model: spec.model,
          year: spec.year,
          status: spec.status,
          mileage: spec.mileage,
          healthScore: spec.healthScore,
          organizationId: org.id,
          assignedDriverId: spec.plate === 'DEMO-TRK-01' ? driver.id : null,
          fuelEfficiency: 6.4,
          lastService: new Date('2025-11-01'),
          nextPredictedMaintenance: new Date('2026-04-01'),
          insuranceExpiry: new Date('2026-12-31'),
          fitnessExpiry: new Date('2026-08-31'),
          isDeleted: false,
        },
      });
      vehicleId = updated.id;
    } else {
      const created = await prisma.vehicle.create({
        data: {
          plate: spec.plate,
          type: spec.type,
          model: spec.model,
          year: spec.year,
          status: spec.status,
          mileage: spec.mileage,
          healthScore: spec.healthScore,
          organizationId: org.id,
          assignedDriverId: spec.plate === 'DEMO-TRK-01' ? driver.id : null,
          fuelEfficiency: 6.4,
          lastService: new Date('2025-11-01'),
          nextPredictedMaintenance: new Date('2026-04-01'),
          insuranceExpiry: new Date('2026-12-31'),
          fitnessExpiry: new Date('2026-08-31'),
        },
      });
      vehicleId = created.id;
    }
    vehicleIds.push(vehicleId);
  }

  await prisma.driver.update({
    where: { id: driver.id },
    data: {
      vehicleAssignedId: vehicleIds[0],
      isVehicleAssigned: true,
    },
  });

  // Clear prior demo ops data for idempotent re-seed
  await prisma.gpsLog.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
  try {
    await prisma.fuelLog.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
  } catch {
    console.warn('⚠️  fuel_logs table missing — skip fuel cleanup (run migrations).');
  }
  await prisma.predictiveAlert.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
  await prisma.maintenanceRecord.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
  await prisma.route.deleteMany({
    where: {
      OR: [
        { vehicleId: { in: vehicleIds } },
        { createdById: admin.id },
        { name: { startsWith: 'Demo ' } },
      ],
    },
  });
  await prisma.notification.deleteMany({
    where: {
      userId: { in: [admin.id, driverUser.id, mechanic.id] },
      title: { in: ['Route in progress', 'Workshop queue', 'Assigned route'] },
    },
  });

  const now = new Date();
  const inProgress = await prisma.route.create({
    data: {
      name: 'Demo Gulberg → DHA',
      startLocation: '24.9056,67.0822 · Gulberg',
      endLocation: '24.8138,67.0680 · DHA Phase 5',
      scheduledAt: new Date(now.getTime() - 45 * 60 * 1000),
      status: 'IN_PROGRESS',
      driverId: driver.id,
      vehicleId: vehicleIds[0],
      createdById: admin.id,
      actualStartAt: new Date(now.getTime() - 40 * 60 * 1000),
      estimatedDistance: 18.4,
      estimatedDurationMinutes: 55,
      notes: 'Read-only demo route currently live.',
    },
  });

  await prisma.route.create({
    data: {
      name: 'Demo Port → Warehouse',
      startLocation: '24.8448,66.9900 · Karachi Port',
      endLocation: '24.9340,67.0900 · SITE Warehouse',
      scheduledAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
      status: 'SCHEDULED',
      driverId: driver.id,
      vehicleId: vehicleIds[1],
      createdById: admin.id,
      estimatedDistance: 22.1,
      estimatedDurationMinutes: 70,
    },
  });

  await prisma.route.create({
    data: {
      name: 'Demo Airport Shuttle',
      startLocation: '24.9000,67.1500 · City Hub',
      endLocation: '24.9065,67.1608 · Jinnah Airport',
      scheduledAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      status: 'COMPLETED',
      driverId: driver.id,
      vehicleId: vehicleIds[0],
      createdById: admin.id,
      actualStartAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
      actualEndAt: new Date(now.getTime() - 23.5 * 60 * 60 * 1000),
      estimatedDistance: 14.2,
      actualDistance: 14.8,
      estimatedDurationMinutes: 40,
      actualDurationMinutes: 48,
    },
  });

  await prisma.maintenanceRecord.createMany({
    data: [
      {
        vehicleId: vehicleIds[2],
        type: 'Brake inspection',
        description: 'Pad wear above threshold on front axle.',
        status: 'IN_PROGRESS',
        scheduledAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        mechanicId: mechanic.id,
        cost: 180,
        notes: 'Demo workshop job.',
      },
      {
        vehicleId: vehicleIds[0],
        type: 'Oil change',
        description: 'Scheduled 50k km service.',
        status: 'PENDING',
        scheduledAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        mechanicId: mechanic.id,
      },
      {
        vehicleId: vehicleIds[1],
        type: 'Tire rotation',
        description: 'Completed demo service.',
        status: 'COMPLETED',
        scheduledAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        completedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        mechanicId: mechanic.id,
        cost: 95,
      },
    ],
  });

  await prisma.predictiveAlert.create({
    data: {
      vehicleId: vehicleIds[2],
      predictedIssue: 'brake_pad_wear',
      riskScore: 0.82,
      confidence: 0.76,
      riskLevel: 'high',
      maintenancePriority: 'schedule_soon',
      suggestedAction: 'Inspect front brakes before next long haul.',
      modelVersion: 'demo-v1',
      dataQuality: 'good',
      message: 'Elevated brake wear signal on DEMO-TRK-03.',
      isActioned: false,
    },
  });

  await prisma.gpsLog.createMany({
    data: [
      {
        vehicleId: vehicleIds[0],
        latitude: 24.89,
        longitude: 67.075,
        speed: 38,
        heading: 140,
        timestamp: new Date(now.getTime() - 8 * 60 * 1000),
      },
      {
        vehicleId: vehicleIds[0],
        latitude: 24.87,
        longitude: 67.072,
        speed: 42,
        heading: 145,
        timestamp: new Date(now.getTime() - 4 * 60 * 1000),
      },
      {
        vehicleId: vehicleIds[0],
        latitude: 24.85,
        longitude: 67.07,
        speed: 36,
        heading: 150,
        timestamp: new Date(now.getTime() - 1 * 60 * 1000),
      },
    ],
  });

  try {
    await prisma.fuelLog.createMany({
      data: [
        {
          vehicleId: vehicleIds[0],
          liters: 80,
          cost: 112,
          odometer: 50800,
          date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        },
        {
          vehicleId: vehicleIds[0],
          liters: 75,
          cost: 105,
          odometer: 51200,
          date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  } catch {
    console.warn('⚠️  fuel_logs table missing — skip fuel seed (run migrations).');
  }

  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        title: 'Route in progress',
        message: `${inProgress.name} is live on DEMO-TRK-01.`,
        type: 'ROUTE_ASSIGNED',
        isRead: false,
      },
      {
        userId: mechanic.id,
        title: 'Workshop queue',
        message: 'Brake inspection is IN_PROGRESS on DEMO-TRK-03.',
        type: 'MAINTENANCE_ALERT',
        isRead: false,
      },
      {
        userId: driverUser.id,
        title: 'Assigned route',
        message: 'Demo Gulberg → DHA is ready to continue.',
        type: 'ROUTE_ASSIGNED',
        isRead: true,
      },
    ],
  });

  console.log('✅ Demo org ready:');
  console.log(`   admin@demo.com / ${DEMO_PASSWORD} (read-only)`);
  console.log(`   driver@demo.com / ${DEMO_PASSWORD} (read-only)`);
  console.log(`   mechanic@demo.com / ${DEMO_PASSWORD} (read-only)`);
}
