import pg from 'pg';

const { Pool } = pg;

function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 3,
  });
}

export class StripeStorage {
  private pool: InstanceType<typeof Pool> | null = null;

  private getPool() {
    if (!this.pool) {
      this.pool = getPool();
    }
    return this.pool;
  }

  async getProduct(productId: string) {
    const pool = this.getPool();
    const result = await pool.query(
      'SELECT * FROM stripe.products WHERE id = $1',
      [productId]
    );
    return result.rows[0] || null;
  }

  async listProducts(active = true, limit = 20, offset = 0) {
    const pool = this.getPool();
    const result = await pool.query(
      'SELECT * FROM stripe.products WHERE active = $1 LIMIT $2 OFFSET $3',
      [active, limit, offset]
    );
    return result.rows;
  }

  async listProductsWithPrices(active = true, limit = 20, offset = 0) {
    const pool = this.getPool();
    const result = await pool.query(
      `WITH paginated_products AS (
        SELECT id, name, description, metadata, active
        FROM stripe.products
        WHERE active = $1
        ORDER BY id
        LIMIT $2 OFFSET $3
      )
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.active as product_active,
        p.metadata as product_metadata,
        pr.id as price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active as price_active,
        pr.metadata as price_metadata
      FROM paginated_products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      ORDER BY p.id, pr.unit_amount`,
      [active, limit, offset]
    );
    return result.rows;
  }

  async getPrice(priceId: string) {
    const pool = this.getPool();
    const result = await pool.query(
      'SELECT * FROM stripe.prices WHERE id = $1',
      [priceId]
    );
    return result.rows[0] || null;
  }

  async listPrices(active = true, limit = 20, offset = 0) {
    const pool = this.getPool();
    const result = await pool.query(
      'SELECT * FROM stripe.prices WHERE active = $1 LIMIT $2 OFFSET $3',
      [active, limit, offset]
    );
    return result.rows;
  }

  async getPricesForProduct(productId: string) {
    const pool = this.getPool();
    const result = await pool.query(
      'SELECT * FROM stripe.prices WHERE product = $1 AND active = true',
      [productId]
    );
    return result.rows;
  }

  async getSubscription(subscriptionId: string) {
    const pool = this.getPool();
    const result = await pool.query(
      'SELECT * FROM stripe.subscriptions WHERE id = $1',
      [subscriptionId]
    );
    return result.rows[0] || null;
  }

  async getCustomer(customerId: string) {
    const pool = this.getPool();
    const result = await pool.query(
      'SELECT * FROM stripe.customers WHERE id = $1',
      [customerId]
    );
    return result.rows[0] || null;
  }
}

export const stripeStorage = new StripeStorage();
