/* Opt-in local integration test. Uses a unique disposable schema, never shop records. */
const assert = require('node:assert/strict');
const { readFileSync, readdirSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { parse } = require('dotenv');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe, VersioningType } = require('@nestjs/common');
const { FastifyAdapter } = require('@nestjs/platform-fastify');

async function main() {
  const env = parse(readFileSync(path.resolve(__dirname, '../../../.env')));
  const url = new URL(env.DATABASE_URL);
  assert(
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
    'Integration tests require local PostgreSQL'
  );
  const schema = 'commerce_test_' + randomUUID().replaceAll('-', '');
  const mediaDirectory = mkdtempSync(path.join(tmpdir(), 'electro-media-test-'));
  process.env.MEDIA_DIRECTORY = mediaDirectory;
  process.env.MEDIA_DRIVER = 'local';
  process.env.CLOUDINARY_URL = '';
  assert(/^commerce_test_[a-f0-9]{32}$/.test(schema));
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  let app;
  let schemaCreated = false;
  try {
    await pool.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    url.searchParams.set('options', `-c search_path=${schema},public`);
    process.env.DATABASE_URL = url.toString();
    process.env.CORS_ORIGINS = 'http://localhost:3000';
    process.env.DELIVERY_FEE_MILLIMES = '8000';
    const isolated = new Pool({ connectionString: url.toString() });
    try {
      const migrations = path.resolve(__dirname, '../../shared/migrations');
      for (const file of readdirSync(migrations)
        .filter((file) => file.endsWith('.sql'))
        .sort()) {
        await isolated.query(readFileSync(path.join(migrations, file), 'utf8'));
      }
      const { hashPassword } = require('../dist/modules/auth/password.js');
      const password = randomUUID() + 'Test!';
      await isolated.query(
        "INSERT INTO admin_users(email,display_name,password_hash,role) VALUES ($1,$2,$3,'owner')",
        ['flow@example.test', 'Flow Test', await hashPassword(password)]
      );
      const { AppModule } = require('../dist/app.module.js');
      app = await NestFactory.create(
        AppModule,
        new FastifyAdapter({ bodyLimit: 8 * 1024 * 1024 }),
        { logger: ['error'] }
      );
      app.setGlobalPrefix('api');
      app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
      app.useGlobalPipes(
        new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true })
      );
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      const call = (method, endpoint, payload, token, extra = {}) =>
        app.inject({
          method,
          url: '/api/v1' + endpoint,
          headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), ...extra },
          ...(payload ? { payload } : {})
        });
      const body = (response, status = 200) => {
        assert.equal(response.statusCode, status, response.body);
        return response.json();
      };
      assert.equal((await call('GET', '/admin/products')).statusCode, 401);
      assert.equal(
        (
          await call('POST', '/admin/auth/login', {
            email: 'flow@example.test',
            password: 'invalid-password'
          })
        ).statusCode,
        401
      );
      const token = body(
        await call('POST', '/admin/auth/login', { email: 'flow@example.test', password })
      ).token;
      const categories = body(await call('GET', '/categories'));
      const productInput = {
        categoryId: categories[0].id,
        name: 'Flow Smartphone',
        slug: 'flow-smartphone',
        description: 'Local test product',
        status: 'draft',
        sku: 'FLOW-001',
        priceMillimes: 999900,
        stockQuantity: 8
      };
      const productId = body(await call('POST', '/admin/products', productInput, token), 201).id;
      assert.equal(body(await call('GET', '/admin/products', null, token)).length, 1);
      assert.equal(body(await call('GET', '/products')).length, 0);
      assert.equal((await call('GET', '/products/flow-smartphone')).statusCode, 404);
      productInput.status = 'published';
      body(await call('PUT', '/admin/products/' + productId, productInput, token));
      const product = body(await call('GET', '/products/flow-smartphone'));
      assert.equal(body(await call('GET', '/products?q=Flow')).length, 1);
      assert.equal(body(await call('GET', '/products?category=' + categories[0].slug)).length, 1);
      assert.equal((await call('POST', '/admin/products', productInput, token)).statusCode, 409);
      assert.equal(
        (
          await call(
            'PUT',
            '/admin/products/' + productId,
            { ...productInput, compareAtPriceMillimes: 1 },
            token
          )
        ).statusCode,
        400
      );
      assert.equal(body(await call('GET', '/orders/options')).deliveryMillimes, 8000);
      const checkout = {
        firstName: 'Test',
        lastName: 'Customer',
        phone: '22000148',
        governorate: 'Tunis',
        address: '10 rue de test',
        paymentMethod: 'cash_on_delivery',
        items: [{ variantId: product.variant.id, quantity: 2 }]
      };
      assert.equal((await call('POST', '/orders', checkout)).statusCode, 400);
      const key = { 'idempotency-key': randomUUID() };
      const results = await Promise.all([
        call('POST', '/orders', checkout, null, key),
        call('POST', '/orders', checkout, null, key)
      ]);
      const order = body(results[0], 201);
      assert.equal(body(results[1], 201).id, order.id);
      assert.equal(
        (await call('POST', '/orders', { ...checkout, phone: '22000999' }, null, key)).statusCode,
        409
      );
      assert.equal(order.totalMillimes, 2007800);
      assert.equal(body(await call('GET', '/products/flow-smartphone')).variant.stockQuantity, 6);
      assert.equal(body(await call('GET', '/admin/orders', null, token)).length, 1);
      assert.equal(
        body(await call('GET', '/admin/orders/' + order.id, null, token)).items[0].quantity,
        2
      );
      assert.equal(
        (await call('POST', '/orders/track', { reference: order.reference, phone: '22000999' }))
          .statusCode,
        404
      );
      assert.equal(
        body(
          await call('POST', '/orders/track', {
            reference: order.reference,
            phone: checkout.phone
          }),
          201
        ).status,
        'pending'
      );
      assert.equal(
        (
          await call(
            'PATCH',
            '/admin/orders/' + order.id + '/status',
            { status: 'delivered' },
            token
          )
        ).statusCode,
        409
      );
      for (const status of ['confirmed', 'preparing', 'shipped', 'delivered']) {
        assert.equal(
          body(await call('PATCH', '/admin/orders/' + order.id + '/status', { status }, token))
            .status,
          status
        );
      }
      assert.equal(
        body(
          await call('POST', '/orders/track', {
            reference: order.reference,
            phone: checkout.phone
          }),
          201
        ).status,
        'delivered'
      );
      const second = body(
        await call('POST', '/orders', checkout, null, { 'idempotency-key': randomUUID() }),
        201
      );
      body(
        await call(
          'PATCH',
          '/admin/orders/' + second.id + '/status',
          { status: 'cancelled' },
          token
        )
      );
      assert.equal(body(await call('GET', '/products/flow-smartphone')).variant.stockQuantity, 6);
      assert.equal(
        (
          await call(
            'PATCH',
            '/admin/orders/' + second.id + '/status',
            { status: 'cancelled' },
            token
          )
        ).statusCode,
        409
      );
      assert.equal(
        (
          await call(
            'POST',
            '/orders',
            { ...checkout, items: [{ variantId: product.variant.id, quantity: 10 }] },
            null,
            { 'idempotency-key': randomUUID() }
          )
        ).statusCode,
        409
      );
      assert.equal(
        (
          await call('POST', '/orders', { ...checkout, paymentMethod: 'online_card' }, null, {
            'idempotency-key': randomUUID()
          })
        ).statusCode,
        400
      );
      assert.equal(
        (
          await call('POST', '/orders', { ...checkout, totalMillimes: 1 }, null, {
            'idempotency-key': randomUUID()
          })
        ).statusCode,
        400
      );
      assert.equal(
        body(
          await call(
            'PATCH',
            '/admin/inventory/adjust',
            { variantId: product.variant.id, quantity: 3, note: 'Test restock' },
            token
          )
        ).stockQuantity,
        9
      );
      assert.equal(
        (
          await call(
            'PATCH',
            '/admin/inventory/adjust',
            { variantId: product.variant.id, quantity: -100, note: 'Invalid' },
            token
          )
        ).statusCode,
        404
      );
      body(
        await call(
          'POST',
          '/admin/categories',
          { name: 'Test category', slug: 'test-category' },
          token
        ),
        201
      );
      assert.equal(body(await call('GET', '/categories')).length, categories.length + 1);
      // Two separate customers competing for the last stock must not oversell.
      const competing = { ...checkout, items: [{ variantId: product.variant.id, quantity: 5 }] };
      const race = await Promise.all([
        call('POST', '/orders', competing, null, { 'idempotency-key': randomUUID() }),
        call('POST', '/orders', competing, null, { 'idempotency-key': randomUUID() })
      ]);
      assert.deepEqual(race.map((result) => result.statusCode).sort(), [201, 409]);
      const winner = race.find((result) => result.statusCode === 201).json();
      body(
        await call(
          'PATCH',
          '/admin/orders/' + winner.id + '/status',
          { status: 'cancelled' },
          token
        )
      );
      assert.equal(body(await call('GET', '/products/flow-smartphone')).variant.stockQuantity, 9);
      await isolated.query(
        "INSERT INTO admin_users(email,display_name,password_hash,role) VALUES ($1,$2,$3,'fulfillment')",
        ['staff@example.test', 'Test Staff', await hashPassword(password)]
      );
      const staffToken = body(
        await call('POST', '/admin/auth/login', { email: 'staff@example.test', password })
      ).token;
      assert.equal((await call('GET', '/admin/orders', null, staffToken)).statusCode, 200);
      assert.equal(
        (await call('POST', '/admin/products', productInput, staffToken)).statusCode,
        403
      );
      assert.equal(
        (
          await call(
            'PATCH',
            '/admin/inventory/adjust',
            { variantId: product.variant.id, quantity: 1, note: 'Forbidden' },
            staffToken
          )
        ).statusCode,
        403
      );
      // Settings are owner-only, validated, audited, and must not alter existing orders.
      assert.equal((await call('GET', '/admin/settings')).statusCode, 401);
      assert.equal((await call('GET', '/admin/settings', null, staffToken)).statusCode, 403);
      const initialSettings = body(await call('GET', '/admin/settings', null, token));
      const { updatedAt, ...settingsInput } = initialSettings;
      void updatedAt;
      settingsInput.deliveryMillimes = 12345;
      settingsInput.deliveryEstimate = '2 à 4 jours ouvrables';
      settingsInput.phone = '+216 22000148';
      settingsInput.notificationEmail = 'private@example.test';
      assert.equal(
        (await call('PUT', '/admin/settings', settingsInput, staffToken)).statusCode,
        403
      );
      for (const invalid of [
        { deliveryMillimes: -1 },
        { deliveryMillimes: 0.5 },
        { notificationEmail: 'invalid' },
        { unexpected: 'secret' }
      ]) {
        assert.equal(
          (await call('PUT', '/admin/settings', { ...settingsInput, ...invalid }, token))
            .statusCode,
          400
        );
      }
      const existingOrders = body(await call('GET', '/admin/orders', null, token));
      const updatedSettings = body(await call('PUT', '/admin/settings', settingsInput, token));
      assert.equal(updatedSettings.revision, initialSettings.revision + 1);
      assert.equal(
        body(await call('GET', '/admin/settings', null, token)).notificationEmail,
        'private@example.test'
      );
      assert.equal((await call('PUT', '/admin/settings', settingsInput, token)).statusCode, 409);
      const publicSettings = body(await call('GET', '/settings'));
      assert.equal(publicSettings.phone, settingsInput.phone);
      assert.equal('notificationEmail' in publicSettings, false);
      assert.equal('updatedAt' in publicSettings, false);
      assert.equal(body(await call('GET', '/orders/options')).deliveryMillimes, 12345);
      const changedFeeOrder = body(
        await call('POST', '/orders', checkout, null, { 'idempotency-key': randomUUID() }),
        201
      );
      assert.equal(changedFeeOrder.deliveryMillimes, 12345);
      for (const previous of existingOrders) {
        assert.equal(
          body(await call('GET', '/admin/orders/' + previous.id, null, token)).deliveryMillimes,
          previous.deliveryMillimes
        );
      }
      // Promotions persist publicly, charge the sale price and leave old orders unchanged.
      const beforePromotion = body(await call('GET', '/products/flow-smartphone'));
      const promotionInput = {
        ...productInput,
        stockQuantity: beforePromotion.variant.stockQuantity,
        priceMillimes: 800000,
        compareAtPriceMillimes: 999900
      };
      for (const invalidPrice of [800000, 799999]) {
        assert.equal(
          (
            await call(
              'PUT',
              '/admin/products/' + productId,
              { ...promotionInput, compareAtPriceMillimes: invalidPrice },
              token
            )
          ).statusCode,
          400
        );
      }
      assert.equal(
        (await call('PUT', '/admin/products/' + productId, promotionInput, staffToken)).statusCode,
        403
      );
      body(await call('PUT', '/admin/products/' + productId, promotionInput, token));
      assert.equal(
        body(await call('GET', '/products/flow-smartphone')).variant.compareAtPriceMillimes,
        999900
      );
      const saleOrder = body(
        await call(
          'POST',
          '/orders',
          { ...checkout, items: [{ variantId: product.variant.id, quantity: 1 }] },
          null,
          { 'idempotency-key': randomUUID() }
        ),
        201
      );
      assert.equal(saleOrder.totalMillimes, 812345);
      assert.equal(
        body(await call('GET', '/admin/orders/' + order.id, null, token)).totalMillimes,
        order.totalMillimes
      );
      const afterPromotion = body(await call('GET', '/products/flow-smartphone'));
      body(
        await call(
          'PUT',
          '/admin/products/' + productId,
          { ...productInput, stockQuantity: afterPromotion.variant.stockQuantity },
          token
        )
      );
      const restored = body(await call('GET', '/products/flow-smartphone'));
      assert.equal(restored.variant.priceMillimes, productInput.priceMillimes);
      assert.equal(restored.variant.compareAtPriceMillimes, null);
      // Real variants, details, images, filters and server-quoted totals.
      const optionInput = {
        ...productInput,
        name: 'Options phone',
        slug: 'options-phone',
        sku: 'OPTION-BASE',
        status: 'draft',
        specifications: [{ label: 'Écran', value: '6 pouces' }],
        warranty: '1 an',
        additionalVariants: [
          {
            name: 'Bleu 256 Go',
            sku: 'OPTION-BLUE',
            priceMillimes: 700000,
            compareAtPriceMillimes: 900000,
            stockQuantity: 2
          }
        ]
      };
      const optionId = body(await call('POST', '/admin/products', optionInput, token), 201).id;
      const adminOption = body(await call('GET', '/admin/products/' + optionId, null, token));
      assert.equal(adminOption.variants.length, 2);
      const option = adminOption.variants[1];
      const source = await require('sharp')({
        create: { width: 30, height: 20, channels: 3, background: 'red' }
      })
        .png()
        .toBuffer();
      const imageInput = { data: source.toString('base64'), alt: 'Téléphone bleu' };
      assert.equal(
        (await call('POST', `/admin/products/${optionId}/images`, imageInput)).statusCode,
        401
      );
      assert.equal(
        (await call('POST', `/admin/products/${optionId}/images`, imageInput, staffToken))
          .statusCode,
        403
      );
      assert.equal(
        (
          await call(
            'POST',
            `/admin/products/${optionId}/images`,
            { data: Buffer.from('fake').toString('base64') },
            token
          )
        ).statusCode,
        400
      );
      const image = body(
        await call('POST', `/admin/products/${optionId}/images`, imageInput, token),
        201
      );
      assert.equal(
        body(await call('POST', `/admin/products/${optionId}/images`, imageInput, token), 201).id,
        image.id
      );
      assert.equal((await call('GET', '/media/' + image.id)).statusCode, 404);
      assert.equal((await call('GET', '/admin/media/' + image.id, null, token)).statusCode, 200);
      optionInput.status = 'published';
      optionInput.additionalVariants[0].id = option.id;
      body(await call('PUT', '/admin/products/' + optionId, optionInput, token));
      const visible = body(await call('GET', '/products/options-phone'));
      assert.equal(visible.images.length, 1);
      assert.equal(visible.specifications[0].value, '6 pouces');
      assert.equal(visible.warranty, '1 an');
      assert.equal((await call('GET', '/media/' + image.id)).headers['content-type'], 'image/webp');
      const filtered = body(
        await call('GET', '/products?promotion=1&available=1&maxPrice=750000&sort=price_asc')
      );
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].variant.id, option.id);
      assert.equal((await call('GET', '/products?minPrice=900000&maxPrice=1')).statusCode, 400);
      assert.equal((await call('GET', '/products?sort=invalid')).statusCode, 400);
      const optionItems = { items: [{ variantId: option.id, quantity: 1 }] };
      const quote = body(await call('POST', '/orders/quote', optionItems), 201);
      assert.equal(quote.totalMillimes, 712345);
      assert.equal(
        (
          await call(
            'POST',
            '/orders',
            { ...checkout, ...optionItems, expectedTotalMillimes: 1 },
            null,
            { 'idempotency-key': randomUUID() }
          )
        ).statusCode,
        409
      );
      const optionOrder = body(
        await call(
          'POST',
          '/orders',
          { ...checkout, ...optionItems, expectedTotalMillimes: quote.totalMillimes },
          null,
          { 'idempotency-key': randomUUID() }
        ),
        201
      );
      assert.equal(optionOrder.totalMillimes, 712345);
      assert.equal(body(await call('GET', '/products/options-phone')).variants[1].stockQuantity, 1);
      const tracked = body(
        await call('POST', '/orders/track', {
          reference: optionOrder.reference,
          phone: checkout.phone
        }),
        201
      );
      assert.equal(tracked.history[0].status, 'pending');
      assert.equal('customer' in tracked, false);
      assert.equal('address' in tracked, false);
      optionInput.additionalVariants = [];
      body(await call('PUT', '/admin/products/' + optionId, optionInput, token));
      assert.equal(body(await call('GET', '/products/options-phone')).variants.length, 1);
      assert.equal((await call('POST', '/orders/quote', optionItems)).statusCode, 409);
      body(await call('DELETE', `/admin/products/${optionId}/images/${image.id}`, null, token));
      assert.equal(body(await call('GET', '/products/options-phone')).images.length, 0);
      assert.equal((await call('GET', '/media/' + image.id)).statusCode, 404);
      await isolated.query('DELETE FROM public_rate_limits');
      for (let attempt = 0; attempt < 10; attempt++)
        assert.equal(
          (await call('POST', '/orders/track', { reference: 'unknown', phone: checkout.phone }))
            .statusCode,
          404
        );
      assert.equal(
        (await call('POST', '/orders/track', { reference: 'unknown', phone: checkout.phone }))
          .statusCode,
        429
      );
      const audit = await isolated.query(
        "SELECT actor_user_id,metadata FROM audit_logs WHERE action='settings.updated'"
      );
      assert.equal(audit.rows.length, 1);
      assert.equal(audit.rows[0].metadata.revision, updatedSettings.revision);
      assert.equal(JSON.stringify(audit.rows).includes('private@example.test'), false);
      await isolated.query('UPDATE categories SET is_visible=false WHERE id=$1', [
        categories[0].id
      ]);
      assert.equal(body(await call('GET', '/products')).length, 0);
      assert.equal((await call('GET', '/products/flow-smartphone')).statusCode, 404);
      assert.equal(
        (await call('POST', '/orders', checkout, null, { 'idempotency-key': randomUUID() }))
          .statusCode,
        400
      );
      // Reporting, scheduled pricing and immutable COD payment ledger.
      await isolated.query('UPDATE categories SET is_visible=true WHERE id=$1', [categories[0].id]);
      assert.equal((await call('GET', '/admin/reports')).statusCode, 401);
      assert.equal((await call('GET', '/admin/activity')).statusCode, 401);
      const paidOrder = body(await call('GET', '/admin/orders/' + order.id, null, token));
      const movement = {
        kind: 'collected',
        amountMillimes: paidOrder.totalMillimes,
        note: 'Bordereau test',
        requestKey: randomUUID()
      };
      assert.equal(
        (await call('POST', `/admin/orders/${order.id}/payments`, movement, staffToken)).statusCode,
        403
      );
      const concurrentPayments = await Promise.all([
        call('POST', `/admin/orders/${order.id}/payments`, movement, token),
        call('POST', `/admin/orders/${order.id}/payments`, movement, token)
      ]);
      const event = body(concurrentPayments[0], 201);
      assert.equal(body(concurrentPayments[1], 201).id, event.id);
      assert.equal(
        body(await call('POST', `/admin/orders/${order.id}/payments`, movement, token), 201).id,
        event.id
      );
      assert.equal(
        (
          await call(
            'POST',
            `/admin/orders/${order.id}/payments`,
            { ...movement, requestKey: randomUUID() },
            token
          )
        ).statusCode,
        409
      );
      body(
        await call(
          'POST',
          `/admin/orders/${order.id}/payments`,
          { ...movement, kind: 'received', requestKey: randomUUID() },
          token
        ),
        201
      );
      body(
        await call(
          'POST',
          `/admin/orders/${order.id}/payments`,
          { ...movement, kind: 'refunded', amountMillimes: 1000, requestKey: randomUUID() },
          token
        ),
        201
      );
      assert.equal(
        body(await call('GET', `/admin/orders/${order.id}/payments`, null, token)).length,
        3
      );
      const report = body(
        await call('GET', '/admin/reports?payment=partially_refunded', null, token)
      );
      assert.equal(report.summary.received, paidOrder.totalMillimes);
      assert.equal(report.summary.refunded, 1000);
      assert.equal(report.orders.length, 1);
      assert.equal(
        (await call('GET', '/admin/reports?from=2026-02-30', null, token)).statusCode,
        400
      );
      assert(
        body(await call('GET', '/admin/activity?q=payment.recorded', null, token)).length >= 3
      );
      const promoProduct = body(await call('GET', '/admin/products/' + product.id, null, token));
      assert.equal(
        (
          await call(
            'PUT',
            `/admin/products/${product.id}/accessories`,
            { ids: [product.id] },
            token
          )
        ).statusCode,
        400
      );
      body(
        await call('PUT', `/admin/products/${product.id}/accessories`, { ids: [optionId] }, token)
      );
      assert.equal(body(await call('GET', '/products/flow-smartphone/accessories')).length, 1);
      await isolated.query("UPDATE products SET status='draft' WHERE id=$1", [optionId]);
      assert.equal(body(await call('GET', '/products/flow-smartphone/accessories')).length, 0);
      await isolated.query("UPDATE products SET status='published' WHERE id=$1", [optionId]);
      assert.equal(
        body(await call('GET', `/admin/products/${product.id}/accessories`, null, token))[0].id,
        optionId
      );
      const beforeDate = paidOrder.createdAt;
      await isolated.query("UPDATE orders SET created_at='2026-10-21T23:30:00Z' WHERE id=$1", [
        order.id
      ]);
      assert.equal(
        body(
          await call(
            'GET',
            '/admin/reports?from=2026-10-22&to=2026-10-22&payment=partially_refunded',
            null,
            token
          )
        ).summary.count,
        1
      );
      assert.equal(
        body(
          await call(
            'GET',
            '/admin/reports?from=2026-10-21&to=2026-10-21&payment=partially_refunded',
            null,
            token
          )
        ).summary.count,
        0
      );
      await isolated.query('UPDATE orders SET created_at=$2 WHERE id=$1', [order.id, beforeDate]);
      await isolated.query(
        'UPDATE product_variants SET price_millimes=800000,compare_at_price_millimes=1000000 WHERE id=$1',
        [promoProduct.variant.id]
      );
      body(
        await call(
          'PUT',
          `/admin/products/${product.id}/promotion-schedule`,
          { startsAt: '2099-01-01T00:00:00Z', endsAt: null },
          token
        )
      );
      assert.equal(
        body(await call('GET', '/products/flow-smartphone')).variant.priceMillimes,
        1000000
      );
      const scheduledQuote = body(
        await call('POST', '/orders/quote', {
          items: [{ variantId: promoProduct.variant.id, quantity: 1 }]
        }),
        201
      );
      assert.equal(scheduledQuote.subtotalMillimes, 1000000);
      assert(!body(await call('GET', '/products?promotion=1')).some((p) => p.id === product.id));
      const scheduledOrder = body(
        await call(
          'POST',
          '/orders',
          {
            ...checkout,
            items: [{ variantId: promoProduct.variant.id, quantity: 1 }],
            expectedTotalMillimes: scheduledQuote.totalMillimes
          },
          null,
          { 'idempotency-key': randomUUID() }
        ),
        201
      );
      assert.equal(scheduledOrder.totalMillimes, scheduledQuote.totalMillimes);
      body(
        await call(
          'PATCH',
          `/admin/orders/${scheduledOrder.id}/status`,
          { status: 'cancelled' },
          token
        )
      );
      body(
        await call(
          'PUT',
          `/admin/products/${product.id}/promotion-schedule`,
          { startsAt: null, endsAt: null },
          token
        )
      );
      assert.equal(
        body(await call('GET', '/products/flow-smartphone')).variant.priceMillimes,
        800000
      );
      body(
        await call(
          'PUT',
          `/admin/products/${product.id}/promotion-schedule`,
          { startsAt: null, endsAt: '2020-01-01T00:00:00Z' },
          token
        )
      );
      assert.equal(
        body(await call('GET', '/products/flow-smartphone')).variant.priceMillimes,
        1000000
      );
      assert.equal(
        (
          await call(
            'PUT',
            `/admin/products/${product.id}/promotion-schedule`,
            { startsAt: '2099-01-01T00:00:00Z', endsAt: '2020-01-01T00:00:00Z' },
            token
          )
        ).statusCode,
        400
      );
      assert.equal((await call('POST', '/admin/auth/logout', null, token)).statusCode, 204);
      assert.equal((await call('GET', '/admin/products', null, token)).statusCode, 401);
      console.log(
        'PASS: login, authorization, draft/publish/edit, search/category/detail, duplicate SKU, price validation, delivery fee, concurrent checkout retry, totals, stock reservation, tracking privacy, status workflow, cancellation/restock, insufficient stock, online-payment disabled, price tampering, inventory, category creation, logout.'
      );
    } finally {
      await isolated.end();
    }
  } finally {
    if (app) await app.close();
    // Exact schema generated above; never delete the public schema or user shop data.
    if (schemaCreated) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.end();
    // Only the unique temporary directory created by this run is removed.
    assert.equal(path.dirname(mediaDirectory), path.resolve(tmpdir()));
    assert(path.basename(mediaDirectory).startsWith('electro-media-test-'));
    rmSync(mediaDirectory, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});
