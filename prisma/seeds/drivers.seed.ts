import {
  PrismaClient,
  LicenseStatus,
  AvailabilityStatus,
} from '@prisma/client';

export async function seedDrivers(prisma: PrismaClient) {
  console.log('👨‍✈️ Seeding drivers...');

  // Get existing driver user
  const driverUser = await prisma.user.findUnique({
    where: { email: 'driver@fleetwise.com' },
  });

  if (!driverUser) {
    console.log('⚠️ Driver user not found, skipping driver profile seed');
    return;
  }

  const drivers = [
    {
      userId: driverUser.id,
      licenseNumber: 'DL0320240000001',
      licenseExpiry: new Date('2026-12-31'),
      licenseStatus: LicenseStatus.VALID,
      licenseVerifiedAt: new Date('2024-01-01'),
      yearsOfExperience: 8,
      emergencyContact: 'Sharma Family',
      emergencyContactPhone: '+91-9876543210',
      availabilityStatus: AvailabilityStatus.AVAILABLE,
      totalRides: 450,
      totalDistance: 45000,
      lastWorkingDate: new Date('2024-01-10'),
      documentVerified: true,
      backgroundCheckDone: true,
      backgroundCheckDate: new Date('2024-01-01'),
    },
  ];

  for (const driver of drivers) {
    try {
      const created = await prisma.driver.upsert({
        where: { userId: driver.userId },
        update: {},
        create: driver,
      });
      console.log(`✅ Created driver: ${created.licenseNumber}`);
    } catch (err) {
      console.log(
        `⚠️ Driver already exists for user: ${(err as Error).message}`,
      );
    }
  }

  console.log('🎉 Drivers seeding completed!');
}
