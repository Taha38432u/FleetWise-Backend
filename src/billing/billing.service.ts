import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getPlanAmount, PaymentProvider, StripeTestProvider } from './payment-provider';
import {
  PLAN_LIMITS,
  PUBLIC_PLANS,
  TRIAL_DAYS,
  TRIAL_LIMITS,
} from './plan-limits';
import type {
  BillingAccessState,
  FeatureKey,
  FleetPlan,
  LimitResource,
  PlanEntitlement,
} from './plan-limits';

const ACTIVE_ROUTE_STATUSES = ['SCHEDULED', 'IN_PROGRESS'];
const PAID_PLANS: FleetPlan[] = ['BASIC', 'PRO', 'ENTERPRISE'];
const ENTITLED_ACCESS_STATES: BillingAccessState[] = [
  'free',
  'trialing',
  'active_paid',
  'cancelled_active_until_period_end',
  'expired',
  'past_due',
  'payment_pending',
];

@Injectable()
export class BillingService {
  private readonly paymentProvider: PaymentProvider;

  constructor(private readonly prisma: PrismaService) {
    this.paymentProvider = new StripeTestProvider();
  }

  private get db() {
    return this.prisma as any;
  }

  private trialEndFrom(start: Date) {
    const end = new Date(start);
    end.setDate(end.getDate() + TRIAL_DAYS);
    return end;
  }

  private async ensureSubscription(userId: string) {
    const billingUserId = await this.resolveBillingUserId(userId);
    const existing = await this.db.subscription.findUnique({
      where: { userId: billingUserId },
    });

    if (existing) {
      const synced = await this.syncStripePayment(existing);
      const current = await this.persistExpiredSubscription(synced);
      return this.normalizeSubscription(current);
    }

    const created = await this.db.subscription.create({
      data: {
        userId: billingUserId,
        plan: 'FREE',
        status: 'ACTIVE',
        paymentStatus: 'NONE',
        provider: this.paymentProvider.key,
        trialUsed: false,
      },
    });

    return this.normalizeSubscription(created);
  }

  private async resolveBillingUserId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, organizationId: true },
    });

    if (!user?.organizationId || user.role === 'SUPER_ADMIN') {
      return userId;
    }

    const organization = await this.db.organization.findUnique({
      where: { id: user.organizationId },
      select: { ownerUserId: true },
    });
    if (organization?.ownerUserId) {
      return organization.ownerUserId;
    }

    const admin = await this.prisma.user.findFirst({
      where: {
        organizationId: user.organizationId,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    return admin?.id || userId;
  }

  private getAccessState(subscription: any): BillingAccessState {
    const now = new Date();
    const trialEndAt = subscription.trialEndAt
      ? new Date(subscription.trialEndAt)
      : null;
    const currentPeriodEnd = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : null;

    if (subscription.status === 'PAYMENT_PENDING') {
      return subscription.paymentStatus === 'FAILED' ? 'past_due' : 'payment_pending';
    }

    if (subscription.status === 'PAST_DUE' || subscription.paymentStatus === 'FAILED') {
      return 'past_due';
    }

    if (subscription.status === 'TRIALING') {
      return trialEndAt && trialEndAt >= now ? 'trialing' : 'expired';
    }

    if (
      subscription.cancelAtPeriodEnd &&
      currentPeriodEnd &&
      currentPeriodEnd >= now &&
      (subscription.status === 'ACTIVE' ||
        subscription.status === 'CANCELED' ||
        subscription.status === 'CANCELLED')
    ) {
      return 'cancelled_active_until_period_end';
    }

    if (
      PAID_PLANS.includes(subscription.plan) &&
      subscription.status === 'ACTIVE' &&
      currentPeriodEnd &&
      currentPeriodEnd < now
    ) {
      return 'expired';
    }

    if (subscription.status === 'ACTIVE' && PAID_PLANS.includes(subscription.plan)) {
      return 'active_paid';
    }

    if (subscription.status === 'EXPIRED') {
      return 'expired';
    }

    return 'free';
  }

  private getEntitlement(subscription: any): PlanEntitlement {
    const accessState = this.getAccessState(subscription);
    if (accessState === 'trialing') {
      return TRIAL_LIMITS;
    }
    if (
      accessState === 'active_paid' ||
      accessState === 'cancelled_active_until_period_end'
    ) {
      return PLAN_LIMITS[subscription.plan as FleetPlan] || PLAN_LIMITS.FREE;
    }
    return PLAN_LIMITS.FREE;
  }

  private getStatusLabel(accessState: BillingAccessState) {
    const labels: Record<BillingAccessState, string> = {
      free: 'Free plan',
      trialing: 'Free trial active',
      active_paid: 'Paid subscription active',
      cancelled_active_until_period_end: 'Cancelled, active until period end',
      expired: 'Expired',
      past_due: 'Payment failed',
      payment_pending: 'Payment pending',
    };
    return labels[accessState];
  }

  private async persistExpiredSubscription(subscription: any) {
    const accessState = this.getAccessState(subscription);
    if (accessState !== 'expired') {
      return subscription;
    }
    if (subscription.status === 'EXPIRED' && subscription.plan === 'FREE') {
      return subscription;
    }
    return this.db.subscription.update({
      where: { userId: subscription.userId },
      data: {
        plan: 'FREE',
        pendingPlan: null,
        status: 'EXPIRED',
        paymentStatus: subscription.paymentStatus === 'FAILED' ? 'FAILED' : 'NONE',
        paymentUrl: null,
        providerPaymentId: null,
        cancelAtPeriodEnd: false,
      },
    });
  }

  private normalizeSubscription(subscription: any) {
    const accessState = this.getAccessState(subscription);
    const entitlement = this.getEntitlement(subscription);
    const currentPeriodEnd = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : null;
    const trialEndAt = subscription.trialEndAt
      ? new Date(subscription.trialEndAt)
      : null;
    const endDate = accessState === 'trialing' ? trialEndAt : currentPeriodEnd;
    const daysRemaining = endDate
      ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86_400_000))
      : null;

    return {
      ...subscription,
      accessState,
      effectiveStatus: accessState,
      effectivePlan: accessState === 'trialing' ? 'TRIAL' : subscription.plan,
      statusLabel: this.getStatusLabel(accessState),
      canUseTrial:
        !subscription.trialUsed &&
        (accessState === 'free' ||
          accessState === 'expired' ||
          accessState === 'past_due'),
      daysRemaining,
      limits: entitlement,
      entitlement,
      cancellationMessage:
        accessState === 'cancelled_active_until_period_end' && currentPeriodEnd
          ? `Your subscription has been cancelled. You can continue using paid features until ${currentPeriodEnd.toLocaleDateString('en-US')}.`
          : null,
    };
  }

  private async syncStripePayment(subscription: any) {
    if (
      subscription.status !== 'PAYMENT_PENDING' ||
      subscription.provider !== this.paymentProvider.key ||
      !subscription.providerPaymentId ||
      !this.paymentProvider.retrieveCheckoutSession
    ) {
      return subscription;
    }

    try {
      const session = await this.paymentProvider.retrieveCheckoutSession(
        subscription.providerPaymentId,
      );

      if (session.paymentStatus === 'paid' && session.status === 'complete') {
        return this.activatePendingSubscription(subscription.userId, subscription);
      }

      if (session.status === 'expired') {
        return this.db.subscription.update({
          where: { userId: subscription.userId },
          data: {
            status: 'PAYMENT_PENDING',
            paymentStatus: 'FAILED',
          },
        });
      }
    } catch {
      return subscription;
    }

    return subscription;
  }

  getPlans() {
    return PUBLIC_PLANS.map((plan) => ({
      ...plan,
      provider: this.paymentProvider.key,
      entitlement:
        plan.key === 'TRIAL'
          ? TRIAL_LIMITS
          : PLAN_LIMITS[plan.key as FleetPlan] || PLAN_LIMITS.FREE,
    }));
  }

  async getCurrentSubscription(userId: string) {
    return this.ensureSubscription(userId);
  }

  async syncPendingPayments() {
    const pending = await this.db.subscription.findMany({
      where: {
        provider: this.paymentProvider.key,
        status: 'PAYMENT_PENDING',
        providerPaymentId: { not: null },
      },
    });

    const synced: any[] = [];
    for (const subscription of pending) {
      synced.push(await this.syncStripePayment(subscription));
    }

    return synced;
  }

  async createTrial(userId: string) {
    const billingUserId = await this.resolveBillingUserId(userId);
    const subscription = await this.ensureSubscription(billingUserId);
    if (subscription.trialUsed) {
      throw new BadRequestException('You have already used your free trial.');
    }
    if (
      subscription.accessState === 'active_paid' ||
      subscription.accessState === 'cancelled_active_until_period_end' ||
      subscription.accessState === 'payment_pending'
    ) {
      throw new BadRequestException('Free trial is only available before paid access starts.');
    }

    const trialStartAt = new Date();
    const trialEndAt = this.trialEndFrom(trialStartAt);
    const updated = await this.db.subscription.update({
      where: { userId: billingUserId },
      data: {
        plan: 'FREE',
        pendingPlan: null,
        status: 'TRIALING',
        paymentStatus: 'NONE',
        paymentUrl: null,
        providerPaymentId: null,
        trialUsed: true,
        trialStartAt,
        trialEndAt,
        currentPeriodEnd: trialEndAt,
        cancelAtPeriodEnd: false,
      },
    });

    return this.normalizeSubscription(updated);
  }

  async createCheckoutSession(userId: string, plan: string) {
    const billingUserId = await this.resolveBillingUserId(userId);
    if (plan === 'FREE') {
      return {
        sessionId: `free_${billingUserId}`,
        provider: this.paymentProvider.key,
        checkoutUrl: '/billing',
        subscription: await this.ensureSubscription(billingUserId),
      };
    }

    if (!PLAN_LIMITS[plan as FleetPlan] || plan === 'FREE') {
      throw new BadRequestException('Invalid paid plan');
    }

    const amount = getPlanAmount(plan as FleetPlan);
    let payment;
    try {
      payment = await this.paymentProvider.createCheckoutSession({
        userId: billingUserId,
        plan: plan as FleetPlan,
        amount,
        currency: 'USD',
      });
    } catch (error: any) {
      throw new BadRequestException(
        error?.message || 'Unable to create Stripe checkout session',
      );
    }

    let subscription: any;
    try {
      subscription = await this.db.subscription.upsert({
        where: { userId: billingUserId },
        create: {
          userId: billingUserId,
          plan: 'FREE',
          pendingPlan: plan,
          status: 'PAYMENT_PENDING',
          paymentStatus: 'PENDING',
          provider: payment.provider,
          providerPaymentId: payment.providerPaymentId,
          paymentUrl: payment.checkoutUrl,
        },
        update: {
          pendingPlan: plan,
          status: 'PAYMENT_PENDING',
          paymentStatus: 'PENDING',
          provider: payment.provider,
          providerPaymentId: payment.providerPaymentId,
          paymentUrl: payment.checkoutUrl,
          cancelAtPeriodEnd: false,
        },
      });
    } catch (error: any) {
      throw new BadRequestException(
        error?.message?.includes('Unknown')
          ? 'Payment schema is not migrated. Run prisma migrate and generate before checkout.'
          : error?.message || 'Unable to create checkout session',
      );
    }

    return {
      sessionId: payment.providerPaymentId,
      provider: payment.provider,
      checkoutUrl: payment.checkoutUrl,
      subscription,
    };
  }

  async completeCheckoutSession(userId: string, sessionId: string) {
    const subscription = await this.ensureSubscription(userId);
    if (subscription.provider !== this.paymentProvider.key) {
      throw new BadRequestException('Checkout provider does not match subscription');
    }
    if (subscription.providerPaymentId !== sessionId) {
      throw new BadRequestException('Checkout session does not match subscription');
    }
    if (!this.paymentProvider.retrieveCheckoutSession) {
      throw new BadRequestException('Payment provider cannot verify checkout sessions');
    }

    const session = await this.paymentProvider.retrieveCheckoutSession(sessionId);
    if (session.paymentStatus !== 'paid' || session.status !== 'complete') {
      throw new BadRequestException('Stripe checkout session is not paid yet');
    }

    return this.activatePendingSubscription(subscription.userId, subscription);
  }

  private async activatePendingSubscription(userId: string, current?: any) {
    const subscription = current || (await this.ensureSubscription(userId));
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

    const updated = await this.db.subscription.update({
      where: { userId },
      data: {
        plan: subscription.pendingPlan || subscription.plan,
        pendingPlan: null,
        status: 'ACTIVE',
        paymentStatus: 'PAID',
        paymentUrl: null,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
      },
    });

    return this.normalizeSubscription(updated);
  }

  async markStripeSessionComplete(providerPaymentId: string) {
    const subscription = await this.db.subscription.findFirst({
      where: {
        provider: this.paymentProvider.key,
        providerPaymentId,
      },
    });

    if (!subscription) {
      throw new BadRequestException('Stripe checkout session is not linked to a subscription');
    }

    return this.activatePendingSubscription(subscription.userId, subscription);
  }

  async markStripePaymentFailed(providerPaymentId: string) {
    return this.db.subscription.updateMany({
      where: {
        provider: this.paymentProvider.key,
        providerPaymentId,
      },
      data: {
        status: 'PAST_DUE',
        paymentStatus: 'FAILED',
      },
    });
  }

  async cancel(userId: string) {
    const billingUserId = await this.resolveBillingUserId(userId);
    const subscription = await this.ensureSubscription(billingUserId);
    const accessState = subscription.accessState as BillingAccessState;
    const currentPeriodEnd = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd)
      : null;

    if (
      (accessState === 'active_paid' ||
        accessState === 'cancelled_active_until_period_end') &&
      currentPeriodEnd &&
      currentPeriodEnd > new Date()
    ) {
      const updated = await this.db.subscription.update({
        where: { userId: billingUserId },
        data: {
          status: 'CANCELED',
          cancelAtPeriodEnd: true,
        },
      });
      return this.normalizeSubscription(updated);
    }

    const updated = await this.db.subscription.update({
      where: { userId: billingUserId },
      data: {
        plan: 'FREE',
        pendingPlan: null,
        status: 'EXPIRED',
        paymentStatus: 'NONE',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      },
    });
    return this.normalizeSubscription(updated);
  }

  async reactivate(userId: string) {
    const billingUserId = await this.resolveBillingUserId(userId);
    const subscription = await this.ensureSubscription(billingUserId);
    if (subscription.accessState !== 'cancelled_active_until_period_end') {
      throw new BadRequestException('Expired subscription requires payment');
    }

    const updated = await this.db.subscription.update({
      where: { userId: billingUserId },
      data: {
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
      },
    });
    return this.normalizeSubscription(updated);
  }

  async assertFeature(userId: string, feature: FeatureKey) {
    const subscription = await this.ensureSubscription(userId);
    if (!ENTITLED_ACCESS_STATES.includes(subscription.accessState)) {
      throw new ForbiddenException('Subscription is not active');
    }
    const limits = subscription.entitlement || PLAN_LIMITS.FREE;
    if (!limits.features[feature]) {
      throw new ForbiddenException('Current plan does not include this feature');
    }
  }

  async assertWithinLimit(userId: string, resource: LimitResource) {
    const subscription = await this.ensureSubscription(userId);
    const limits = subscription.entitlement || PLAN_LIMITS.FREE;
    const current = await this.countResource(userId, resource);
    if (current >= limits[resource]) {
      throw new ForbiddenException(
        `Plan limit reached for ${resource}. Upgrade subscription to continue.`,
      );
    }
  }

  private async countResource(userId: string, resource: LimitResource) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    const organizationId = user?.organizationId || null;

    if (resource === 'vehicles') {
      return this.db.vehicle.count({ where: { isDeleted: false, organizationId } });
    }
    if (resource === 'drivers') {
      return this.db.driver.count({
        where: { isDeleted: false, user: { organizationId } },
      });
    }
    if (resource === 'activeRoutes') {
      return this.db.route.count({
        where: {
          status: { in: ACTIVE_ROUTE_STATUSES },
          createdBy: { organizationId },
        },
      });
    }
    if (resource === 'dispatchers') {
      return this.db.user.count({
        where: { role: 'DISPATCHER', status: 'ACTIVE', organizationId },
      });
    }
    return this.db.user.count({
      where: {
        role: { in: ['ADMIN', 'DISPATCHER', 'DRIVER', 'MECHANIC'] },
        status: 'ACTIVE',
        organizationId,
      },
    });
  }

  async webhook(payload: any) {
    if (payload?.type === 'checkout.session.completed') {
      const sessionId = payload?.data?.object?.id;
      if (sessionId) {
        await this.markStripeSessionComplete(sessionId);
      }
    }

    if (
      payload?.type === 'checkout.session.expired' ||
      payload?.type === 'checkout.session.async_payment_failed' ||
      payload?.type === 'payment_intent.payment_failed'
    ) {
      const sessionId =
        payload?.data?.object?.id ||
        payload?.data?.object?.metadata?.checkoutSessionId;
      if (sessionId) {
        await this.markStripePaymentFailed(sessionId);
      }
    }

    return {
      received: true,
      provider: this.paymentProvider.key,
      eventType: payload?.type || 'unknown',
    };
  }
}
