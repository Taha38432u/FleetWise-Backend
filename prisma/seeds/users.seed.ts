import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export async function seedUsers(prisma: PrismaClient) {
  console.log('👥 Seeding users...');

  const superAdminEmail = 'rasheedtaha1111@gmail.com';
  const superAdminPassword = await bcrypt.hash('Attackontitan', 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      password: superAdminPassword,
      firstName: 'SaaS',
      lastName: 'Owner',
      role: 'SUPER_ADMIN' as any,
      status: 'ACTIVE',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: superAdminEmail,
      password: superAdminPassword,
      firstName: 'SaaS',
      lastName: 'Owner',
      role: 'SUPER_ADMIN' as any,
      status: 'ACTIVE',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log('✅ Created/updated super admin user:', superAdmin.email);

  // Create admin user
  const adminEmail = 'rasheedtaha111@gmail.com';
  const adminPassword = await bcrypt.hash('@superadmin', 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log('✅ Created admin user:', admin.email);

  // Create dispatcher user
  const dispatcherEmail = 'dispatcher@fleetwise.com';
  const dispatcherPassword = await bcrypt.hash('Dispatcher@123', 10);

  const dispatcher = await prisma.user.upsert({
    where: { email: dispatcherEmail },
    update: {},
    create: {
      email: dispatcherEmail,
      password: dispatcherPassword,
      firstName: 'Dispatcher',
      lastName: 'User',
      role: 'DISPATCHER',
      status: 'ACTIVE',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log('✅ Created dispatcher user:', dispatcher.email);

  // Create driver user
  const driverEmail = 'driver@fleetwise.com';
  const driverPassword = await bcrypt.hash('Driver@123', 10);

  const driver = await prisma.user.upsert({
    where: { email: driverEmail },
    update: {},
    create: {
      email: driverEmail,
      password: driverPassword,
      firstName: 'Driver',
      lastName: 'User',
      role: 'DRIVER',
      status: 'ACTIVE',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log('✅ Created driver user:', driver.email);

  // Create mechanic user
  const mechanicEmail = 'mechanic@fleetwise.com';
  const mechanicPassword = await bcrypt.hash('Mechanic@123', 10);

  const mechanic = await prisma.user.upsert({
    where: { email: mechanicEmail },
    update: {},
    create: {
      email: mechanicEmail,
      password: mechanicPassword,
      firstName: 'Mechanic',
      lastName: 'User',
      role: 'MECHANIC',
      status: 'ACTIVE',
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log('✅ Created mechanic user:', mechanic.email);
}
