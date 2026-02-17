import { getUncachableStripeClient } from './stripeClient';

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  const existingProducts = await stripe.products.search({ query: "name:'CaseCurrent Starter'" });
  if (existingProducts.data.length > 0) {
    console.log('Products already exist, skipping seed');
    return;
  }

  console.log('Creating CaseCurrent pricing plans...');

  const starter = await stripe.products.create({
    name: 'CaseCurrent Starter',
    description: 'AI-powered intake for solo practitioners. Includes 1 phone line, basic analytics, and email notifications.',
    metadata: {
      tier: 'starter',
      intakeLines: '1',
      features: 'ai-intake,basic-analytics,email-notifications',
    },
  });

  await stripe.prices.create({
    product: starter.id,
    unit_amount: 29900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { plan: 'starter-monthly' },
  });

  await stripe.prices.create({
    product: starter.id,
    unit_amount: 287000,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { plan: 'starter-yearly' },
  });

  console.log(`Created Starter plan: ${starter.id}`);

  const professional = await stripe.products.create({
    name: 'CaseCurrent Professional',
    description: 'Full-featured intake automation for growing firms. Includes 3 phone lines, advanced analytics, SMS follow-ups, and webhook integrations.',
    metadata: {
      tier: 'professional',
      intakeLines: '3',
      features: 'ai-intake,advanced-analytics,sms-followups,webhooks,qualification-scoring',
    },
  });

  await stripe.prices.create({
    product: professional.id,
    unit_amount: 59900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { plan: 'professional-monthly' },
  });

  await stripe.prices.create({
    product: professional.id,
    unit_amount: 575000,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { plan: 'professional-yearly' },
  });

  console.log(`Created Professional plan: ${professional.id}`);

  const enterprise = await stripe.products.create({
    name: 'CaseCurrent Enterprise',
    description: 'Enterprise-grade legal intake platform. Unlimited lines, custom AI training, priority support, dedicated account manager, and SLA guarantees.',
    metadata: {
      tier: 'enterprise',
      intakeLines: 'unlimited',
      features: 'ai-intake,enterprise-analytics,sms-followups,webhooks,qualification-scoring,custom-ai,priority-support,sla',
    },
  });

  await stripe.prices.create({
    product: enterprise.id,
    unit_amount: 149900,
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { plan: 'enterprise-monthly' },
  });

  await stripe.prices.create({
    product: enterprise.id,
    unit_amount: 1439000,
    currency: 'usd',
    recurring: { interval: 'year' },
    metadata: { plan: 'enterprise-yearly' },
  });

  console.log(`Created Enterprise plan: ${enterprise.id}`);
  console.log('All pricing plans created successfully!');
}

seedProducts().catch(console.error);
