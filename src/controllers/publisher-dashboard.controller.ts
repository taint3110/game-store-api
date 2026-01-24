import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, param, HttpErrors} from '@loopback/rest';
import {SecurityBindings, UserProfile, securityId} from '@loopback/security';
import {GameKeyRepository, GameRepository, OrderDetailRepository, OrderRepository} from '../repositories';

type Granularity = 'day' | 'month' | 'year';

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isoMonth(date: Date) {
  return date.toISOString().slice(0, 7);
}

function isoYear(date: Date) {
  return date.toISOString().slice(0, 4);
}

function keyFor(date: Date, granularity: Granularity) {
  if (granularity === 'day') return isoDay(date);
  if (granularity === 'month') return isoMonth(date);
  return isoYear(date);
}

function clampNumber(n: unknown) {
  const num = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(num) ? num : 0;
}

export class PublisherDashboardController {
  constructor(
    @repository(GameRepository)
    public gameRepository: GameRepository,
    @repository(GameKeyRepository)
    public gameKeyRepository: GameKeyRepository,
    @repository(OrderDetailRepository)
    public orderDetailRepository: OrderDetailRepository,
    @repository(OrderRepository)
    public orderRepository: OrderRepository,
  ) {}

  private isAdmin(user: UserProfile) {
    return (user as any)?.accountType === 'admin';
  }

  private ensurePublisherOrAdmin(user: UserProfile) {
    const type = (user as any)?.accountType;
    if (type !== 'publisher' && type !== 'admin') {
      throw new HttpErrors.Forbidden('Publisher access required');
    }
  }

  private getPublisherId(user: UserProfile) {
    return String(user[securityId]);
  }

  private async myGameIds(user: UserProfile) {
    const where = this.isAdmin(user) ? {} : {publisherId: this.getPublisherId(user)};
    const games = await this.gameRepository.find({
      where,
      fields: {id: true, name: true, releaseStatus: true, releaseDate: true, originalPrice: true, discountPrice: true},
      limit: 2000,
    });
    return games.map(g => ({
      id: String((g as any).id),
      name: (g as any).name,
      releaseStatus: (g as any).releaseStatus,
      releaseDate: (g as any).releaseDate,
      originalPrice: (g as any).originalPrice,
      discountPrice: (g as any).discountPrice,
    }));
  }

  private async revenueTimeseries(gameIds: string[], granularity: Granularity, from: Date, to: Date) {
    if (gameIds.length === 0) return [];

    const buckets = new Map<string, number>();
    const gameIdSet = new Set(gameIds.map(String));

    const orderDetails = await this.orderDetailRepository.find({
      where: {gameId: {inq: gameIds}} as any,
      fields: {orderId: true, value: true},
      limit: 100000,
    });

    const orderIdsWithDetails = new Set(
      orderDetails.map(od => String((od as any).orderId ?? '')).filter(Boolean),
    );

    if (orderDetails.length) {
      const orderIds = Array.from(orderIdsWithDetails);
      const orders = await this.orderRepository.find({
        where: {id: {inq: orderIds}, paymentStatus: 'Completed'} as any,
        fields: {id: true, orderDate: true, createdAt: true},
        limit: 100000,
      });

      const orderMap = new Map<string, Date>();
      for (const o of orders as any[]) {
        const d = (o.orderDate ? new Date(o.orderDate) : o.createdAt ? new Date(o.createdAt) : null) as any;
        if (d && !Number.isNaN(d.getTime())) orderMap.set(String(o.id), d);
      }

      for (const od of orderDetails as any[]) {
        const orderId = String(od.orderId);
        const d = orderMap.get(orderId);
        if (!d) continue;
        if (d < from || d > to) continue;
        const k = keyFor(d, granularity);
        buckets.set(k, (buckets.get(k) || 0) + clampNumber(od.value));
      }
    }

    // Fallback: orders.items[] when orderDetails are not created.
    const orders = await this.orderRepository.find({
      where: {paymentStatus: 'Completed'} as any,
      fields: {id: true, orderDate: true, createdAt: true, items: true},
      limit: 100000,
    });

    for (const o of orders as any[]) {
      const orderId = String(o?.id ?? '');
      if (!orderId || orderIdsWithDetails.has(orderId)) continue;

      const d = o.orderDate ? new Date(o.orderDate) : o.createdAt ? new Date(o.createdAt) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      if (d < from || d > to) continue;

      const items = Array.isArray(o?.items) ? o.items : [];
      if (items.length === 0) continue;

      const periodKey = keyFor(d, granularity);
      for (const line of items as any[]) {
        const slug = String(line?.slug ?? '').trim();
        if (!slug || !gameIdSet.has(slug)) continue;
        const qty = typeof line?.quantity === 'number' ? Math.max(1, Math.floor(line.quantity)) : 1;
        const unitCents =
          typeof line?.unitPriceCents === 'number' && Number.isFinite(line.unitPriceCents)
            ? Math.max(0, Math.floor(line.unitPriceCents))
            : 0;
        buckets.set(periodKey, (buckets.get(periodKey) || 0) + (unitCents * qty) / 100);
      }
    }

    return Array.from(buckets.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([period, revenue]) => ({period, revenue}));
  }

  @get('/publisher/dashboard/summary', {
    responses: {
      '200': {description: 'Publisher dashboard summary'},
    },
  })
  @authenticate('jwt')
  async summary(@inject(SecurityBindings.USER) currentUser: UserProfile) {
    this.ensurePublisherOrAdmin(currentUser);

    const games = await this.myGameIds(currentUser);
    const ids = games.map(g => g.id);

    const [available, sold, reserved, totalKeys] = ids.length
      ? await Promise.all([
          this.gameKeyRepository.count({gameId: {inq: ids} as any, businessStatus: 'Available'} as any),
          this.gameKeyRepository.count({gameId: {inq: ids} as any, businessStatus: 'Sold'} as any),
          this.gameKeyRepository.count({gameId: {inq: ids} as any, businessStatus: 'Reserved'} as any),
          this.gameKeyRepository.count({gameId: {inq: ids} as any} as any),
        ])
      : [{count: 0}, {count: 0}, {count: 0}, {count: 0}];

    const statusCounts = games.reduce(
      (acc: Record<string, number>, g: any) => {
        const s = String(g.releaseStatus || 'Unknown');
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      },
      {},
    );

    const now = new Date();
    const dayFrom = new Date(now);
    dayFrom.setDate(now.getDate() - 30);
    const monthFrom = new Date(now);
    monthFrom.setMonth(now.getMonth() - 12);
    const yearFrom = new Date(now);
    yearFrom.setFullYear(now.getFullYear() - 5);

    const [revenueByDay, revenueByMonth, revenueByYear] = await Promise.all([
      this.revenueTimeseries(ids, 'day', dayFrom, now),
      this.revenueTimeseries(ids, 'month', monthFrom, now),
      this.revenueTimeseries(ids, 'year', yearFrom, now),
    ]);

    return {
      games: {
        total: games.length,
        statusCounts,
        list: games,
      },
      keys: {
        available: available.count,
        sold: sold.count,
        reserved: reserved.count,
        total: totalKeys.count,
      },
      revenue: {
        byDay: revenueByDay,
        byMonth: revenueByMonth,
        byYear: revenueByYear,
      },
    };
  }

  @get('/publisher/dashboard/revenue/{granularity}', {
    responses: {
      '200': {description: 'Revenue timeseries for publisher games'},
    },
  })
  @authenticate('jwt')
  async revenue(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('granularity') granularity: Granularity,
    @param.query.string('from') from?: string,
    @param.query.string('to') to?: string,
  ) {
    this.ensurePublisherOrAdmin(currentUser);
    if (!['day', 'month', 'year'].includes(String(granularity))) {
      throw new HttpErrors.UnprocessableEntity('granularity must be day, month, or year');
    }

    const games = await this.myGameIds(currentUser);
    const ids = games.map(g => g.id);

    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30));
    if (Number.isNaN(toDate.getTime()) || Number.isNaN(fromDate.getTime())) {
      throw new HttpErrors.UnprocessableEntity('Invalid from/to date');
    }

    return this.revenueTimeseries(ids, granularity, fromDate, toDate);
  }
}
