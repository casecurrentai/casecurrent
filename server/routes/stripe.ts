import { Router } from 'express';
import { stripeService } from '../stripeService';
import { stripeStorage } from '../stripeStorage';
import { getStripePublishableKey } from '../stripeClient';

const router = Router();

router.get('/api/stripe/publishable-key', async (_req, res) => {
  try {
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch (error: any) {
    console.error('Failed to get publishable key:', error.message);
    res.status(500).json({ error: 'Failed to get Stripe publishable key' });
  }
});

router.get('/api/stripe/products', async (_req, res) => {
  try {
    const products = await stripeStorage.listProducts();
    res.json({ data: products });
  } catch (error: any) {
    console.error('Failed to list products:', error.message);
    res.status(500).json({ error: 'Failed to list products' });
  }
});

router.get('/api/stripe/products-with-prices', async (_req, res) => {
  try {
    const rows = await stripeStorage.listProductsWithPrices();

    const productsMap = new Map();
    for (const row of rows) {
      if (!productsMap.has(row.product_id)) {
        productsMap.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          active: row.product_active,
          metadata: row.product_metadata,
          prices: []
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id).prices.push({
          id: row.price_id,
          unit_amount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
          active: row.price_active,
          metadata: row.price_metadata,
        });
      }
    }

    res.json({ data: Array.from(productsMap.values()) });
  } catch (error: any) {
    console.error('Failed to list products with prices:', error.message);
    res.status(500).json({ error: 'Failed to list products' });
  }
});

router.get('/api/stripe/products/:productId/prices', async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await stripeStorage.getProduct(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const prices = await stripeStorage.getPricesForProduct(productId);
    res.json({ data: prices });
  } catch (error: any) {
    console.error('Failed to get prices:', error.message);
    res.status(500).json({ error: 'Failed to get prices' });
  }
});

router.post('/api/stripe/checkout', async (req, res) => {
  try {
    const { priceId, customerEmail, mode } = req.body;

    if (!priceId) {
      return res.status(400).json({ error: 'priceId is required' });
    }

    const customer = await stripeService.createCustomer(
      customerEmail || 'guest@casecurrent.co',
      { source: 'checkout' }
    );

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const session = await stripeService.createCheckoutSession(
      customer.id,
      priceId,
      `${baseUrl}/pricing?success=true`,
      `${baseUrl}/pricing?canceled=true`,
      mode || 'subscription'
    );

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

router.post('/api/stripe/portal', async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const session = await stripeService.createCustomerPortalSession(
      customerId,
      `${baseUrl}/pricing`
    );

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Portal error:', error.message);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

export default router;
