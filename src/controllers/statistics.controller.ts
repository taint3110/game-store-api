import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, HttpErrors, param} from '@loopback/rest';
import {SecurityBindings, UserProfile, securityId} from '@loopback/security';
import {
  CustomerAccountRepository,
  GameKeyRepository,
  GameRepository,
  OrderDetailRepository,
  OrderRepository,
  PublisherAccountRepository,
} from '../repositories';

type Granularity = 'day' | 'month' | 'year';

type RevenuePoint = {period: string; revenue: number};

type GameRow = {
  id: string;
  name: string;
  publisherId: string;
  releaseStatus?: string;
  releaseDate?: Date;
  originalPrice?: number;
  discountPrice?: number;
};

type KeyStats = {available: number; sold: number; reserved: number; total: number};

type GameStatsRow = {
  gameId: string;
  name: string;
  publisherId: string;
  publisherName?: string;
  revenue: number;
  unitsSold: number;
  keys: KeyStats;
};

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

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

export class StatisticsController {
  constructor(
    @repository(GameRepository)
    public gameRepository: GameRepository,
    @repository(GameKeyRepository)
    public gameKeyRepository: GameKeyRepository,
    @repository(OrderDetailRepository)
    public orderDetailRepository: OrderDetailRepository,
    @repository(OrderRepository)
    public orderRepository: OrderRepository,
    @repository(PublisherAccountRepository)
    public publisherAccountRepository: PublisherAccountRepository,
    @repository(CustomerAccountRepository)
    public customerAccountRepository: CustomerAccountRepository,
  ) {}

  private ensurePublisherOrAdmin(user: UserProfile) {
    const type = (user as any)?.accountType;
    if (type !== 'publisher' && type !== 'admin') {
      throw new HttpErrors.Forbidden('Publisher/Admin access required');
    }
  }

  private isAdmin(user: UserProfile) {
    return (user as any)?.accountType === 'admin';
  }

  private getPublisherId(user: UserProfile) {
    return String(user[securityId]);
  }

  private async listScopedGames(currentUser: UserProfile, publisherId?: string): Promise<GameRow[]> {
    const where =
      this.isAdmin(currentUser) && publisherId
        ? {publisherId}
        : this.isAdmin(currentUser)
          ? {}
          : {publisherId: this.getPublisherId(currentUser)};

    const games = await this.gameRepository.find({
      where,
      fields: {
        id: true,
        name: true,
        publisherId: true,
        releaseStatus: true,
        releaseDate: true,
        originalPrice: true,
        discountPrice: true,
      },
      limit: 5000,
      order: ['createdAt DESC'],
    });

    return games.map(g => ({
      id: String((g as any).id),
      name: String((g as any).name),
      publisherId: String((g as any).publisherId),
      releaseStatus: (g as any).releaseStatus,
      releaseDate: (g as any).releaseDate,
      originalPrice: (g as any).originalPrice,
      discountPrice: (g as any).discountPrice,
    }));
  }

  private async loadPublisherNames(publisherIds: string[]) {
    if (publisherIds.length === 0) return new Map<string, string>();
    const uniq = Array.from(new Set(publisherIds.map(String)));
    const rows = await this.publisherAccountRepository.find({
      where: {id: {inq: uniq}} as any,
      fields: {id: true, publisherName: true},
      limit: 10000,
    });
    const map = new Map<string, string>();
    for (const r of rows as any[]) map.set(String(r.id), String(r.publisherName ?? ''));
    return map;
  }

  private async computeKeyStatsByGame(gameIds: string[]) {
    const result = new Map<string, KeyStats>();
    for (const id of gameIds) result.set(id, {available: 0, sold: 0, reserved: 0, total: 0});
    if (gameIds.length === 0) return result;

    const keys = await this.gameKeyRepository.find({
      where: {gameId: {inq: gameIds}} as any,
      fields: {gameId: true, businessStatus: true},
      limit: 200000,
    });

    for (const k of keys as any[]) {
      const gameId = String(k.gameId ?? '');
      if (!gameId || !result.has(gameId)) continue;
      const stats = result.get(gameId)!;
      stats.total += 1;
      const status = String(k.businessStatus ?? '');
      if (status === 'Available') stats.available += 1;
      else if (status === 'Sold') stats.sold += 1;
      else if (status === 'Reserved') stats.reserved += 1;
    }

    return result;
  }

  private async computeSalesAndRevenue(
    games: GameRow[],
    from: Date,
    to: Date,
  ): Promise<{
    perGameRevenue: Map<string, number>;
    perGameUnits: Map<string, number>;
    ordersIncluded: Set<string>;
    revenueByDay: RevenuePoint[];
    revenueByMonth: RevenuePoint[];
    revenueByYear: RevenuePoint[];
  }> {
    const gameIds = games.map(g => g.id);
    const gameIdSet = new Set(gameIds.map(String));

    const perGameRevenue = new Map<string, number>();
    const perGameUnits = new Map<string, number>();
    const ordersIncluded = new Set<string>();

    const bucketsDay = new Map<string, number>();
    const bucketsMonth = new Map<string, number>();
    const bucketsYear = new Map<string, number>();

    const orderDetails = await this.orderDetailRepository.find({
      where: {gameId: {inq: gameIds}} as any,
      fields: {orderId: true, gameId: true, value: true},
      limit: 200000,
    });

    const orderIdsWithDetails = new Set(
      orderDetails.map(od => String((od as any).orderId ?? '')).filter(Boolean),
    );

    const orderMap = new Map<string, Date>();
    if (orderIdsWithDetails.size) {
      const orderIds = Array.from(orderIdsWithDetails);
      const orders = await this.orderRepository.find({
        where: {id: {inq: orderIds}, paymentStatus: 'Completed'} as any,
        fields: {id: true, orderDate: true, createdAt: true},
        limit: 200000,
      });
      for (const o of orders as any[]) {
        const d = (o.orderDate ? new Date(o.orderDate) : o.createdAt ? new Date(o.createdAt) : null) as any;
        if (d && !Number.isNaN(d.getTime())) orderMap.set(String(o.id), d);
      }
    }

    for (const od of orderDetails as any[]) {
      const gameId = String(od.gameId ?? '');
      const orderId = String(od.orderId ?? '');
      if (!gameId || !orderId || !gameIdSet.has(gameId)) continue;
      const d = orderMap.get(orderId);
      if (!d) continue;
      if (d < from || d > to) continue;

      const value = clampNumber(od.value);
      perGameRevenue.set(gameId, (perGameRevenue.get(gameId) || 0) + value);
      perGameUnits.set(gameId, (perGameUnits.get(gameId) || 0) + 1);
      ordersIncluded.add(orderId);

      const kDay = keyFor(d, 'day');
      const kMonth = keyFor(d, 'month');
      const kYear = keyFor(d, 'year');
      bucketsDay.set(kDay, (bucketsDay.get(kDay) || 0) + value);
      bucketsMonth.set(kMonth, (bucketsMonth.get(kMonth) || 0) + value);
      bucketsYear.set(kYear, (bucketsYear.get(kYear) || 0) + value);
    }

    // Fallback: orders.items[] when orderDetails are not created.
    const orders = await this.orderRepository.find({
      where: {paymentStatus: 'Completed'} as any,
      fields: {id: true, orderDate: true, createdAt: true, items: true},
      limit: 200000,
    });

    for (const o of orders as any[]) {
      const orderId = String(o?.id ?? '');
      if (!orderId || orderIdsWithDetails.has(orderId)) continue;

      const d = o.orderDate ? new Date(o.orderDate) : o.createdAt ? new Date(o.createdAt) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      if (d < from || d > to) continue;

      const items = Array.isArray(o?.items) ? o.items : [];
      if (items.length === 0) continue;

      for (const line of items as any[]) {
        const slug = String(line?.slug ?? '').trim();
        if (!slug || !gameIdSet.has(slug)) continue;
        const qty = typeof line?.quantity === 'number' ? Math.max(1, Math.floor(line.quantity)) : 1;
        const unitCents =
          typeof line?.unitPriceCents === 'number' && Number.isFinite(line.unitPriceCents)
            ? Math.max(0, Math.floor(line.unitPriceCents))
            : 0;
        const value = (unitCents * qty) / 100;

        perGameRevenue.set(slug, (perGameRevenue.get(slug) || 0) + value);
        perGameUnits.set(slug, (perGameUnits.get(slug) || 0) + qty);
        ordersIncluded.add(orderId);

        const kDay = keyFor(d, 'day');
        const kMonth = keyFor(d, 'month');
        const kYear = keyFor(d, 'year');
        bucketsDay.set(kDay, (bucketsDay.get(kDay) || 0) + value);
        bucketsMonth.set(kMonth, (bucketsMonth.get(kMonth) || 0) + value);
        bucketsYear.set(kYear, (bucketsYear.get(kYear) || 0) + value);
      }
    }

    const toSeries = (m: Map<string, number>): RevenuePoint[] =>
      Array.from(m.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([period, revenue]) => ({period, revenue}));

    return {
      perGameRevenue,
      perGameUnits,
      ordersIncluded,
      revenueByDay: toSeries(bucketsDay),
      revenueByMonth: toSeries(bucketsMonth),
      revenueByYear: toSeries(bucketsYear),
    };
  }

  @get('/statistics/summary', {
    responses: {'200': {description: 'Statistics summary for publisher/admin'}},
  })
  @authenticate('jwt')
  async summary(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.query.string('publisherId') publisherId?: string,
    @param.query.string('from') from?: string,
    @param.query.string('to') to?: string,
    @param.query.number('top') top?: number,
  ) {
    this.ensurePublisherOrAdmin(currentUser);

    const scopedPublisherId =
      this.isAdmin(currentUser) && publisherId ? String(publisherId).trim() : undefined;
    if (this.isAdmin(currentUser) && scopedPublisherId) {
      await this.publisherAccountRepository.findById(scopedPublisherId);
    }

    const games = await this.listScopedGames(currentUser, scopedPublisherId);
    const gameIds = games.map(g => g.id);

    const now = to ? new Date(to) : new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 30);
    const fromDate = from ? new Date(from) : defaultFrom;
    if (Number.isNaN(now.getTime()) || Number.isNaN(fromDate.getTime())) {
      throw new HttpErrors.UnprocessableEntity('Invalid from/to date');
    }

    const keyStatsByGame = await this.computeKeyStatsByGame(gameIds);
    const sales = await this.computeSalesAndRevenue(games, fromDate, now);

    const publisherNameMap = await this.loadPublisherNames(games.map(g => g.publisherId));

    const perGame: GameStatsRow[] = games.map(g => {
      const keys = keyStatsByGame.get(g.id) ?? {available: 0, sold: 0, reserved: 0, total: 0};
      const revenue = clampNumber(sales.perGameRevenue.get(g.id) || 0);
      const unitsSold = clampInt(sales.perGameUnits.get(g.id) || 0, 0, 1000000000, 0);
      return {
        gameId: g.id,
        name: g.name,
        publisherId: g.publisherId,
        publisherName: publisherNameMap.get(g.publisherId) || undefined,
        revenue,
        unitsSold,
        keys,
      };
    });

    const totals = perGame.reduce(
      (acc, g) => {
        acc.revenue += g.revenue;
        acc.unitsSold += g.unitsSold;
        acc.keys.available += g.keys.available;
        acc.keys.sold += g.keys.sold;
        acc.keys.reserved += g.keys.reserved;
        acc.keys.total += g.keys.total;
        return acc;
      },
      {
        revenue: 0,
        unitsSold: 0,
        keys: {available: 0, sold: 0, reserved: 0, total: 0} as KeyStats,
      },
    );

    const topN = clampInt(top, 1, 50, 10);
    const topGames = [...perGame]
      .sort((a, b) => (b.revenue !== a.revenue ? b.revenue - a.revenue : b.unitsSold - a.unitsSold))
      .slice(0, topN);

    const publisherAgg = new Map<
      string,
      {publisherId: string; publisherName?: string; revenue: number; unitsSold: number; games: number}
    >();
    for (const row of perGame) {
      const id = row.publisherId;
      const existing = publisherAgg.get(id) ?? {
        publisherId: id,
        publisherName: row.publisherName,
        revenue: 0,
        unitsSold: 0,
        games: 0,
      };
      existing.revenue += row.revenue;
      existing.unitsSold += row.unitsSold;
      existing.games += 1;
      publisherAgg.set(id, existing);
    }
    const topPublishers = Array.from(publisherAgg.values())
      .sort((a, b) => (b.revenue !== a.revenue ? b.revenue - a.revenue : b.unitsSold - a.unitsSold))
      .slice(0, topN);

    const totalOrders = sales.ordersIncluded.size;
    const totalCustomers = this.isAdmin(currentUser)
      ? (await this.customerAccountRepository.count()).count
      : undefined;

    return {
      scope: {
        viewer: this.isAdmin(currentUser) ? 'admin' : 'publisher',
        publisherId: this.isAdmin(currentUser) ? scopedPublisherId : this.getPublisherId(currentUser),
      },
      range: {from: fromDate.toISOString(), to: now.toISOString()},
      totals: {
        games: games.length,
        orders: totalOrders,
        revenue: Math.round(totals.revenue * 100) / 100,
        unitsSold: totals.unitsSold,
        keys: totals.keys,
        customers: totalCustomers,
      },
      revenue: {
        byDay: sales.revenueByDay,
        byMonth: sales.revenueByMonth,
        byYear: sales.revenueByYear,
      },
      topGames,
      topPublishers,
      perGame,
    };
  }
}

