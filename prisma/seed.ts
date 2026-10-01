import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { seedUsers } from './seeds/users.seed';
import { seedVehicles } from './seeds/vehicles.seed';
import { seedDrivers } from './seeds/drivers.seed';
import { seedDemoAccounts } from './seeds/demo.seed';

// DATABASE_URL should be loaded by dotenv/config via ts-node -r flag
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set in environment variables. Please check your .env file.',
  );
}

// Prisma 7 requires an adapter for database connections
const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...\n');

  // Seed users
  await seedUsers(prisma);
  console.log();

  // Seed drivers
  await seedDrivers(prisma);
  console.log();

  // Seed vehicles
  await seedVehicles(prisma);
  console.log();

  // Read-only @demo.com tenancy with sample ops data
  await seedDemoAccounts(prisma);
  console.log();

  console.log('📋 Default credentials:');
  console.log('Super Admin: rasheedtaha1111@gmail.com / Attackontitan');
  console.log('Admin: rasheedtaha111@gmail.com / @superadmin');
  console.log('Dispatcher: dispatcher@fleetwise.com / Dispatcher@123');
  console.log('Driver: driver@fleetwise.com / Driver@123');
  console.log('Mechanic: mechanic@fleetwise.com / Mechanic@123');
  console.log('');
  console.log('📋 Read-only demos (@demo.com — writes blocked):');
  console.log('Admin: admin@demo.com / DemoRead1!');
  console.log('Driver: driver@demo.com / DemoRead1!');
  console.log('Mechanic: mechanic@demo.com / DemoRead1!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
