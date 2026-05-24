/**
 * Prisma seed script.
 *
 * Idempotently seeds the database with a sample user and a representative
 * property listing so Prisma Studio shows real data after migration. The
 * upsert keys (email, sourceUrl) make repeated runs safe.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: "demo@estate-iq.dev" },
    update: {},
    create: {
      email: "demo@estate-iq.dev",
      name: "Demo Investor",
    },
  });

  const property = await prisma.property.upsert({
    where: { sourceUrl: "https://www.zillow.com/homedetails/sample-listing/0_zpid/" },
    update: {},
    create: {
      sourceUrl: "https://www.zillow.com/homedetails/sample-listing/0_zpid/",
      address: "123 Sample St",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
      listPrice: 450000,
      bedrooms: 3,
      bathrooms: 2.5,
      squareFeet: 1850,
      lotSizeSqft: 6000,
      yearBuilt: 2008,
      propertyType: "SINGLE_FAMILY",
      hoaMonthly: 0,
      taxesAnnual: 7200,
      insuranceAnnual: 1800,
      description: "Seeded sample property used to verify schema and Prisma Studio.",
      ownerId: owner.id,
    },
  });

  await prisma.rentalEstimate.deleteMany({ where: { propertyId: property.id } });
  await prisma.rentalEstimate.create({
    data: {
      propertyId: property.id,
      source: "MOCK",
      estimatedRent: 2900,
      rentLow: 2700,
      rentHigh: 3100,
      occupancyRatePct: 95,
    },
  });

  await prisma.analysis.deleteMany({ where: { propertyId: property.id } });
  await prisma.analysis.create({
    data: {
      propertyId: property.id,
      ownerId: owner.id,
      status: "PENDING",
    },
  });

  console.info("Seed complete:", {
    user: owner.email,
    propertyId: property.id,
    address: `${property.address}, ${property.city}, ${property.state}`,
  });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
