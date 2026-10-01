import { BillingService } from './billing.service';

const stripeCheckoutCreate = jest.fn();
const stripeCheckoutRetrieve = jest.fn();

jest.mock('stripe', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: stripeCheckoutCreate,
          retrieve: stripeCheckoutRetrieve,
        },
      },
    })),
  };
});

describe('BillingService', () => {
  const createService = () => {
    const subscription = {
      id: 'subscription-id',
      userId: 'user-id',
      plan: 'PRO',
      status: 'ACTIVE',
    };
    const prisma: any = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(subscription),
        create: jest.fn().mockResolvedValue(subscription),
        upsert: jest.fn().mockResolvedValue(subscription),
        update: jest.fn().mockResolvedValue(subscription),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      vehicle: { count: jest.fn().mockResolvedValue(0) },
      driver: { count: jest.fn().mockResolvedValue(0) },
      route: { count: jest.fn().mockResolvedValue(0) },
      user: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-id',
          role: 'ADMIN',
          organizationId: null,
        }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    return { service: new BillingService(prisma), prisma, subscription };
  };

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
    stripeCheckoutCreate.mockReset();
    stripeCheckoutCreate.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    });
    stripeCheckoutRetrieve.mockReset();
    stripeCheckoutRetrieve.mockResolvedValue({
      id: 'cs_test_123',
      status: 'complete',
      payment_status: 'paid',
    });
  });

  it('creates Stripe test checkout sessions', async () => {
    const { service } = createService();

    const result = await service.createCheckoutSession('user-id', 'PRO');

    expect(stripeCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        client_reference_id: 'user-id',
        metadata: expect.objectContaining({ plan: 'PRO' }),
      }),
    );
    expect(result.provider).toBe('STRIPE_TEST');
    expect(result.sessionId).toBe('cs_test_123');
    expect(result.checkoutUrl).toContain('checkout.stripe.com');
  });

  it('uses production-facing plan labels', () => {
    const { service } = createService();

    const planText = JSON.stringify(service.getPlans());

    expect(planText).not.toMatch(/demo/i);
  });

  it('creates free subscriptions without auto-starting trial', async () => {
    const { service, prisma } = createService();

    await service.getCurrentSubscription('user-id');

    expect(prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ACTIVE',
          trialUsed: false,
        }),
      }),
    );
    expect(prisma.subscription.create.mock.calls[0][0].data).not.toHaveProperty(
      'trialStartAt',
    );
  });

  it('starts one-time 10-day trials explicitly', async () => {
    const { service, prisma } = createService();
    prisma.subscription.findUnique.mockResolvedValueOnce({
      userId: 'user-id',
      plan: 'FREE',
      status: 'ACTIVE',
      trialUsed: false,
    });
    prisma.subscription.update.mockResolvedValueOnce({
      userId: 'user-id',
      plan: 'FREE',
      status: 'TRIALING',
      trialUsed: true,
      trialStartAt: new Date(),
      trialEndAt: new Date(Date.now() + 10 * 86_400_000),
      currentPeriodEnd: new Date(Date.now() + 10 * 86_400_000),
    });

    const result = await service.createTrial('user-id');

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-id' },
        data: expect.objectContaining({
          status: 'TRIALING',
          trialUsed: true,
          trialStartAt: expect.any(Date),
          trialEndAt: expect.any(Date),
        }),
      }),
    );
    expect(result.accessState).toBe('trialing');
  });

  it('blocks second free trial attempts', async () => {
    const { service, prisma } = createService();
    prisma.subscription.findUnique.mockResolvedValueOnce({
      userId: 'user-id',
      plan: 'FREE',
      status: 'ACTIVE',
      trialUsed: true,
    });

    await expect(service.createTrial('user-id')).rejects.toThrow(
      'You have already used your free trial.',
    );
  });

  it('activates pending subscriptions from Stripe checkout webhook', async () => {
    const { service, prisma } = createService();
    prisma.subscription.findFirst.mockResolvedValueOnce({
      userId: 'user-id',
      providerPaymentId: 'cs_test_123',
      pendingPlan: 'PRO',
      plan: 'FREE',
      status: 'PAYMENT_PENDING',
    });
    prisma.subscription.findUnique.mockResolvedValueOnce({
      userId: 'user-id',
      providerPaymentId: 'cs_test_123',
      pendingPlan: 'PRO',
      plan: 'FREE',
      status: 'PAYMENT_PENDING',
    });

    await service.webhook({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_123' } },
    });

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-id' },
        data: expect.objectContaining({
          plan: 'PRO',
          status: 'ACTIVE',
          paymentStatus: 'PAID',
        }),
      }),
    );
  });

  it('verifies Stripe test checkout success after redirect', async () => {
    const { service, prisma } = createService();
    prisma.subscription.findUnique.mockResolvedValueOnce({
      userId: 'user-id',
      provider: 'STRIPE_TEST',
      providerPaymentId: 'cs_test_123',
      pendingPlan: 'PRO',
      plan: 'FREE',
      status: 'PAYMENT_PENDING',
    });
    prisma.subscription.update.mockResolvedValueOnce({
      userId: 'user-id',
      provider: 'STRIPE_TEST',
      providerPaymentId: 'cs_test_123',
      plan: 'PRO',
      status: 'ACTIVE',
      paymentStatus: 'PAID',
    });

    await service.completeCheckoutSession('user-id', 'cs_test_123');

    expect(stripeCheckoutRetrieve).toHaveBeenCalledWith('cs_test_123');
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-id' },
        data: expect.objectContaining({
          plan: 'PRO',
          status: 'ACTIVE',
          paymentStatus: 'PAID',
        }),
      }),
    );
  });

  it('self-heals paid pending Stripe sessions when subscription is read', async () => {
    const { service, prisma } = createService();
    prisma.subscription.findUnique.mockResolvedValueOnce({
      userId: 'user-id',
      provider: 'STRIPE_TEST',
      providerPaymentId: 'cs_test_123',
      pendingPlan: 'PRO',
      plan: 'FREE',
      status: 'PAYMENT_PENDING',
      paymentStatus: 'PENDING',
    });
    prisma.subscription.update.mockResolvedValueOnce({
      userId: 'user-id',
      provider: 'STRIPE_TEST',
      providerPaymentId: 'cs_test_123',
      plan: 'PRO',
      status: 'ACTIVE',
      paymentStatus: 'PAID',
    });

    const result = await service.getCurrentSubscription('user-id');

    expect(stripeCheckoutRetrieve).toHaveBeenCalledWith('cs_test_123');
    expect(result.status).toBe('ACTIVE');
    expect(result.paymentStatus).toBe('PAID');
  });

  it('syncs all pending Stripe sessions for super admin views', async () => {
    const { service, prisma } = createService();
    prisma.subscription.findMany = jest.fn().mockResolvedValue([
      {
        userId: 'user-id',
        provider: 'STRIPE_TEST',
        providerPaymentId: 'cs_test_123',
        pendingPlan: 'PRO',
        plan: 'FREE',
        status: 'PAYMENT_PENDING',
        paymentStatus: 'PENDING',
      },
    ]);

    await service.syncPendingPayments();

    expect(stripeCheckoutRetrieve).toHaveBeenCalledWith('cs_test_123');
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-id' },
        data: expect.objectContaining({ paymentStatus: 'PAID' }),
      }),
    );
  });

  it('checks sub-user plan access against organization owner subscription', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'dispatcher-id',
      role: 'DISPATCHER',
      organizationId: 'org-id',
    });
    prisma.organization.findUnique.mockResolvedValueOnce({
      ownerUserId: 'admin-id',
    });
    prisma.subscription.findUnique.mockResolvedValueOnce({
      userId: 'admin-id',
      plan: 'PRO',
      status: 'ACTIVE',
      currentPeriodEnd: new Date('2099-01-01'),
    });

    await service.assertFeature('dispatcher-id', 'liveTracking');

    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { userId: 'admin-id' },
    });
  });

  it('falls back to free limits after trial expiry', async () => {
    const { service, prisma } = createService();
    prisma.subscription.findUnique.mockResolvedValueOnce({
      userId: 'user-id',
      plan: 'FREE',
      status: 'TRIALING',
      trialEndAt: new Date('2020-01-01'),
    });
    prisma.subscription.update.mockResolvedValueOnce({
      userId: 'user-id',
      plan: 'FREE',
      status: 'EXPIRED',
      paymentStatus: 'NONE',
    });
    prisma.vehicle.count.mockResolvedValueOnce(2);

    await expect(service.assertWithinLimit('user-id', 'vehicles')).rejects.toThrow(
      'Plan limit reached for vehicles',
    );
  });

  it('enforces plan limits on backend', async () => {
    const { service, prisma } = createService();
    prisma.subscription.findUnique.mockResolvedValueOnce({
      userId: 'user-id',
      plan: 'FREE',
      status: 'ACTIVE',
    });
    prisma.vehicle.count.mockResolvedValueOnce(2);

    await expect(service.assertWithinLimit('user-id', 'vehicles')).rejects.toThrow(
      'Plan limit reached for vehicles',
    );
  });

  it('keeps paid access after cancellation until period end', async () => {
    const { service, prisma } = createService();
    const periodEnd = new Date('2099-01-01');
    prisma.subscription.findUnique.mockResolvedValueOnce({
      userId: 'user-id',
      plan: 'PRO',
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    });
    prisma.subscription.update.mockResolvedValueOnce({
      userId: 'user-id',
      plan: 'PRO',
      status: 'CANCELED',
      paymentStatus: 'PAID',
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: true,
    });

    const result = await service.cancel('user-id');

    expect(result.accessState).toBe('cancelled_active_until_period_end');
    expect(result.cancellationMessage).toContain(
      'Your subscription has been cancelled.',
    );
  });

  it('uses free entitlements for failed payments', async () => {
    const { service, prisma } = createService();
    prisma.subscription.findUnique.mockResolvedValueOnce({
      userId: 'user-id',
      plan: 'PRO',
      status: 'PAST_DUE',
      paymentStatus: 'FAILED',
    });

    await expect(service.assertFeature('user-id', 'liveTracking')).rejects.toThrow(
      'Current plan does not include this feature',
    );
  });
});
