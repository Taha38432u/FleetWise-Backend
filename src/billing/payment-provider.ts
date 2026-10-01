import { BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { PUBLIC_PLANS } from './plan-limits';
import type { FleetPlan } from './plan-limits';

export type PaymentSession = {
  provider: string;
  providerPaymentId: string;
  checkoutUrl: string;
};

export interface PaymentProvider {
  readonly key: string;
  createCheckoutSession(input: {
    userId: string;
    plan: FleetPlan;
    amount: number;
    currency: string;
  }): Promise<PaymentSession>;
  retrieveCheckoutSession?(sessionId: string): Promise<{
    id: string;
    paymentStatus: string | null;
    status: string | null;
  }>;
}

export class StripeTestProvider implements PaymentProvider {
  readonly key = 'STRIPE_TEST';

  private getStripeClient() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new BadRequestException(
        'Stripe test key is not configured. Set STRIPE_SECRET_KEY before creating checkout sessions.',
      );
    }

    return new Stripe(secretKey);
  }

  async createCheckoutSession(input: {
    userId: string;
    plan: FleetPlan;
    amount: number;
    currency: string;
  }): Promise<PaymentSession> {
    const rawSuccessUrl =
      process.env.STRIPE_SUCCESS_URL ||
      'http://localhost:3000/billing?stripe=success&session_id={CHECKOUT_SESSION_ID}';
    const successUrl = rawSuccessUrl.includes('{CHECKOUT_SESSION_ID}')
      ? rawSuccessUrl
      : `${rawSuccessUrl}${rawSuccessUrl.includes('?') ? '&' : '?'}stripe=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      process.env.STRIPE_CANCEL_URL ||
      'http://localhost:3000/billing?stripe=cancel';

    const session = await this.getStripeClient().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: input.userId,
      metadata: {
        userId: input.userId,
        plan: input.plan,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: Math.round(input.amount * 100),
            product_data: {
              name: `FleetWise ${input.plan} monthly plan`,
            },
          },
        },
      ],
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL');
    }

    return {
      provider: this.key,
      providerPaymentId: session.id,
      checkoutUrl: session.url,
    };
  }

  async retrieveCheckoutSession(sessionId: string) {
    const session = await this.getStripeClient().checkout.sessions.retrieve(sessionId);
    return {
      id: session.id,
      paymentStatus: session.payment_status || null,
      status: session.status || null,
    };
  }
}

export function getPlanAmount(plan: FleetPlan) {
  const selected = PUBLIC_PLANS.find((item) => item.key === plan);
  return selected?.priceMonthly || 0;
}
