export type FleetPlan = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';
export type BillingAccessState =
  | 'free'
  | 'trialing'
  | 'active_paid'
  | 'cancelled_active_until_period_end'
  | 'expired'
  | 'past_due'
  | 'payment_pending';

export type LimitResource =
  | 'vehicles'
  | 'drivers'
  | 'activeRoutes'
  | 'staff'
  | 'dispatchers';

export type FeatureKey = 'reportsExport' | 'liveTracking' | 'predictiveMaintenance';

export type PlanEntitlement = {
  vehicles: number;
  drivers: number;
  activeRoutes: number;
  staff: number;
  dispatchers: number;
  features: Record<FeatureKey, boolean>;
};

export const PLAN_LIMITS: Record<FleetPlan, PlanEntitlement> = {
  FREE: {
    vehicles: 2,
    drivers: 2,
    activeRoutes: 2,
    staff: 3,
    dispatchers: 1,
    features: {
      reportsExport: false,
      liveTracking: false,
      predictiveMaintenance: false,
    },
  },
  BASIC: {
    vehicles: 10,
    drivers: 12,
    activeRoutes: 10,
    staff: 8,
    dispatchers: 2,
    features: {
      reportsExport: true,
      liveTracking: true,
      predictiveMaintenance: false,
    },
  },
  PRO: {
    vehicles: 50,
    drivers: 60,
    activeRoutes: 50,
    staff: 25,
    dispatchers: 8,
    features: {
      reportsExport: true,
      liveTracking: true,
      predictiveMaintenance: true,
    },
  },
  ENTERPRISE: {
    vehicles: 9999,
    drivers: 9999,
    activeRoutes: 9999,
    staff: 9999,
    dispatchers: 9999,
    features: {
      reportsExport: true,
      liveTracking: true,
      predictiveMaintenance: true,
    },
  },
};

export const TRIAL_LIMITS: PlanEntitlement = {
  vehicles: 6,
  drivers: 8,
  activeRoutes: 6,
  staff: 8,
  dispatchers: 2,
  features: {
    reportsExport: true,
    liveTracking: true,
    predictiveMaintenance: false,
  },
};

export const TRIAL_DAYS = 10;

export const PUBLIC_PLANS = [
  {
    key: 'FREE',
    name: 'Free',
    priceMonthly: 0,
    currency: 'USD',
    description: 'For small fleets getting set up.',
    trialAvailable: false,
    limits: ['2 vehicles', '2 drivers', '2 active routes', 'No exports', 'No live tracking'],
    features: ['Basic fleet records', 'Route scheduling', 'Staff roles'],
  },
  {
    key: 'TRIAL',
    name: '10-day trial',
    priceMonthly: 0,
    currency: 'USD',
    description: 'Try core paid features before choosing a plan.',
    trialAvailable: true,
    limits: ['6 vehicles', '8 drivers', '6 active routes', 'Reports export', 'Live tracking'],
    features: ['Paid workflow access', 'Route operations', 'Fleet cost reports'],
  },
  {
    key: 'BASIC',
    name: 'Basic',
    priceMonthly: 49,
    currency: 'USD',
    description: 'For operating fleets with dispatch and reporting needs.',
    trialAvailable: false,
    limits: ['10 vehicles', '12 drivers', '10 active routes', 'CSV exports'],
    features: ['Live tracking', 'Reports export', 'Cost management'],
  },
  {
    key: 'PRO',
    name: 'Pro',
    priceMonthly: 129,
    currency: 'USD',
    description: 'For larger fleets needing maintenance intelligence.',
    trialAvailable: false,
    limits: ['50 vehicles', '60 drivers', '50 active routes', 'Predictive maintenance'],
    features: ['Everything in Basic', 'Predictive maintenance', 'Expanded staff limits'],
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    priceMonthly: 299,
    currency: 'USD',
    description: 'For high-volume fleet operations.',
    trialAvailable: false,
    limits: ['High-volume fleet limits', 'Advanced reports', 'Priority support'],
    features: ['High-volume limits', 'Advanced reporting', 'Priority support'],
  },
];
