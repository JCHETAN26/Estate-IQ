-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('SINGLE_FAMILY', 'MULTI_FAMILY', 'CONDO', 'TOWNHOUSE', 'APARTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RentalSource" AS ENUM ('RENTCAST', 'ATTOM', 'ZILLOW', 'MANUAL', 'MOCK');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip_code" TEXT NOT NULL,
    "list_price" DECIMAL(12,2) NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" DECIMAL(4,2) NOT NULL,
    "square_feet" INTEGER,
    "lot_size_sqft" INTEGER,
    "year_built" INTEGER,
    "property_type" "PropertyType" NOT NULL DEFAULT 'SINGLE_FAMILY',
    "hoa_monthly" DECIMAL(10,2),
    "taxes_annual" DECIMAL(12,2),
    "insurance_annual" DECIMAL(12,2),
    "description" TEXT,
    "raw_listing" JSONB,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyses" (
    "id" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "down_payment_pct" DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    "interest_rate_pct" DECIMAL(5,2) NOT NULL DEFAULT 7.00,
    "loan_term_years" INTEGER NOT NULL DEFAULT 30,
    "monthly_payment" DECIMAL(12,2),
    "monthly_cash_flow" DECIMAL(12,2),
    "net_operating_income" DECIMAL(12,2),
    "cap_rate_pct" DECIMAL(6,3),
    "cash_on_cash_pct" DECIMAL(6,3),
    "investment_score" INTEGER,
    "score_rationale" TEXT,
    "error_message" TEXT,
    "property_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_estimates" (
    "id" TEXT NOT NULL,
    "source" "RentalSource" NOT NULL,
    "estimated_rent" DECIMAL(10,2) NOT NULL,
    "rent_low" DECIMAL(10,2),
    "rent_high" DECIMAL(10,2),
    "occupancy_rate_pct" DECIMAL(5,2),
    "comparables" JSONB,
    "property_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_memos" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "prompt_version" TEXT,
    "property_id" TEXT NOT NULL,
    "analysis_id" TEXT,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_memos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "properties_source_url_key" ON "properties"("source_url");

-- CreateIndex
CREATE INDEX "properties_owner_id_idx" ON "properties"("owner_id");

-- CreateIndex
CREATE INDEX "properties_city_state_idx" ON "properties"("city", "state");

-- CreateIndex
CREATE INDEX "analyses_property_id_idx" ON "analyses"("property_id");

-- CreateIndex
CREATE INDEX "analyses_owner_id_idx" ON "analyses"("owner_id");

-- CreateIndex
CREATE INDEX "analyses_status_idx" ON "analyses"("status");

-- CreateIndex
CREATE INDEX "rental_estimates_property_id_idx" ON "rental_estimates"("property_id");

-- CreateIndex
CREATE INDEX "rental_estimates_source_idx" ON "rental_estimates"("source");

-- CreateIndex
CREATE UNIQUE INDEX "investment_memos_analysis_id_key" ON "investment_memos"("analysis_id");

-- CreateIndex
CREATE INDEX "investment_memos_property_id_idx" ON "investment_memos"("property_id");

-- CreateIndex
CREATE INDEX "investment_memos_owner_id_idx" ON "investment_memos"("owner_id");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_estimates" ADD CONSTRAINT "rental_estimates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_memos" ADD CONSTRAINT "investment_memos_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_memos" ADD CONSTRAINT "investment_memos_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_memos" ADD CONSTRAINT "investment_memos_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
