import {repository} from '@loopback/repository';
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {SecurityBindings, UserProfile, securityId} from '@loopback/security';
import {get, post, patch, param, requestBody, HttpErrors} from '@loopback/rest';
import {
  GameRepository,
  GameKeyRepository,
  OrderDetailRepository,
  OrderRepository,
  ReviewRepository,
} from '../repositories';
import {GameKey} from '../models';
import {generateKeyCode} from '../utils/key-code';

type PricingPayload = {originalPrice?: number; discountPrice?: number};
type KeyBatchPayload = {quantity: number; gameVersion?: string};

export class PublisherGameController {
  constructor(
    @repository(GameRepository)
    public gameRepository: GameRepository,
    @repository(GameKeyRepository)
    public gameKeyRepository: GameKeyRepository,
    @repository(OrderDetailRepository)
    public orderDetailRepository: OrderDetailRepository,
    @repository(OrderRepository)
    public orderRepository: OrderRepository,
    @repository(ReviewRepository)
    public reviewRepository: ReviewRepository,
  ) {}

  private isAdmin(user: UserProfile) {
    return (user as any)?.accountType === 'admin';
  }

  private getPublisherId(user: UserProfile) {
    return user[securityId];
  }

  private async ensureOwnsGame(user: UserProfile, gameId: string) {
    if (this.isAdmin(user)) return;
    const game = await this.gameRepository.findById(gameId);
    if (game.publisherId !== this.getPublisherId(user)) {
      throw new HttpErrors.Forbidden('You can only manage your own games.');
    }
  }

  @get('/publisher/games/{id}/reviews', {
    responses: {
      '200': {
        description: 'List reviews for a publisher-owned game',
      },
    },
  })
  @authenticate('jwt')
  async listGameReviews(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<any> {
    if (!this.isAdmin(currentUser) && (currentUser as any)?.accountType !== 'publisher') {
      throw new HttpErrors.Forbidden('Only publishers and admins can view reviews here.');
    }
    await this.ensureOwnsGame(currentUser, id);

    const reviews = await this.reviewRepository.find({
      where: {gameId: id},
      include: [{relation: 'customer'}],
      order: ['updatedAt DESC'],
    });

    const sanitized = reviews.map(r => {
      const anyReview = r as any;
      if (anyReview?.customer && typeof anyReview.customer === 'object') {
        return {
          ...anyReview,
          customer: {...anyReview.customer, password: ''},
        };
      }
      return anyReview;
    });

    const totalReviews = sanitized.length;
    const averageRating =
      totalReviews === 0
        ? 0
        : sanitized.reduce((sum: number, r: any) => sum + (Number(r.rating) || 0), 0) /
          totalReviews;

    return {
      reviews: sanitized,
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews,
    };
  }

  @get('/publisher/reviews', {
    responses: {
      '200': {
        description: 'List reviews across publisher-owned games',
      },
    },
  })
  @authenticate('jwt')
  async listMyReviews(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.query.string('gameId') gameId?: string,
    @param.query.number('limit') limit?: number,
    @param.query.number('skip') skip?: number,
  ): Promise<any[]> {
    if (!this.isAdmin(currentUser) && (currentUser as any)?.accountType !== 'publisher') {
      throw new HttpErrors.Forbidden('Only publishers and admins can view reviews here.');
    }

    const take = Math.min(200, Math.max(1, Math.floor(Number(limit) || 50)));
    const offset = Math.max(0, Math.floor(Number(skip) || 0));

    let where: any = {};
    if (!this.isAdmin(currentUser)) {
      const myGames = await this.gameRepository.find({
        where: {publisherId: this.getPublisherId(currentUser)},
        fields: {id: true},
        limit: 1000,
      });
      const ids = myGames.map(g => String((g as any).id));
      where.gameId = {inq: ids};
    }

    if (gameId) {
      where = {...where, gameId: String(gameId)};
    }

    const reviews = await this.reviewRepository.find({
      where,
      include: [{relation: 'customer'}, {relation: 'game'}],
      order: ['updatedAt DESC'],
      limit: take,
      skip: offset,
    });

    return reviews.map(r => {
      const anyReview = r as any;
      if (anyReview?.customer && typeof anyReview.customer === 'object') {
        return {
          ...anyReview,
          customer: {...anyReview.customer, password: ''},
        };
      }
      return anyReview;
    });
  }

  @get('/publisher/games/me', {
    responses: {
      '200': {
        description: 'List games owned by current publisher/admin',
      },
    },
  })
  @authenticate('jwt')
  async listMyGames(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ) {
    const where = this.isAdmin(currentUser)
      ? {}
      : {publisherId: this.getPublisherId(currentUser)};
    return this.gameRepository.find({
      where,
      order: ['updatedAt DESC'],
    });
  }

  @patch('/publisher/games/{id}/pricing', {
    responses: {
      '200': {description: 'Pricing updated'},
    },
  })
  @authenticate('jwt')
  async updatePricing(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              originalPrice: {type: 'number', minimum: 0},
              discountPrice: {type: 'number', minimum: 0},
            },
          },
        },
      },
    })
    body: PricingPayload,
  ) {
    if (!this.isAdmin(currentUser) && (currentUser as any)?.accountType !== 'publisher') {
      throw new HttpErrors.Forbidden('Only publishers and admins can update pricing.');
    }
    await this.ensureOwnsGame(currentUser, id);
    await this.gameRepository.updateById(id, {
      originalPrice: body.originalPrice,
      discountPrice: body.discountPrice,
      updatedAt: new Date(),
    });
    return this.gameRepository.findById(id);
  }

  @post('/publisher/games/{id}/keys/batch', {
    responses: {
      '201': {description: 'Batch of keys created'},
    },
  })
  @authenticate('jwt')
  async createKeyBatch(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['quantity'],
            properties: {
              quantity: {type: 'number', minimum: 1},
              gameVersion: {type: 'string'},
            },
          },
        },
      },
    })
    body: KeyBatchPayload,
  ) {
    if (!this.isAdmin(currentUser) && (currentUser as any)?.accountType !== 'publisher') {
      throw new HttpErrors.Forbidden('Only publishers and admins can manage keys.');
    }
    await this.ensureOwnsGame(currentUser, id);

    const game = await this.gameRepository.findById(id);
    const version = body.gameVersion || game.version || '1.0';
    const quantity = Math.max(1, Math.floor(body.quantity));

    const keys: Partial<GameKey>[] = Array.from({length: quantity}).map(() => ({
      gameId: id,
      gameVersion: version,
      keyCode: generateKeyCode(),
      businessStatus: 'Available',
      activationStatus: 'NotActivated',
      publishRegistrationDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await this.gameKeyRepository.createAll(keys as GameKey[]);

    const [available, sold, reserved, total] = await Promise.all([
      this.gameKeyRepository.count({gameId: id, businessStatus: 'Available'}),
      this.gameKeyRepository.count({gameId: id, businessStatus: 'Sold'}),
      this.gameKeyRepository.count({gameId: id, businessStatus: 'Reserved'}),
      this.gameKeyRepository.count({gameId: id}),
    ]);

    return {
      created: quantity,
      stats: {
        available: available.count,
        sold: sold.count,
        reserved: reserved.count,
        total: total.count,
      },
    };
  }

  @get('/publisher/games/{id}/keys/summary', {
    responses: {
      '200': {description: 'Key summary for a game'},
    },
  })
  @authenticate('jwt')
  async keySummary(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ) {
    await this.ensureOwnsGame(currentUser, id);

    const [available, sold, reserved, total] = await Promise.all([
      this.gameKeyRepository.count({gameId: id, businessStatus: 'Available'}),
      this.gameKeyRepository.count({gameId: id, businessStatus: 'Sold'}),
      this.gameKeyRepository.count({gameId: id, businessStatus: 'Reserved'}),
      this.gameKeyRepository.count({gameId: id}),
    ]);

    return {
      available: available.count,
      sold: sold.count,
      reserved: reserved.count,
      total: total.count,
    };
  }

  @get('/publisher/games/{id}/stats', {
    responses: {
      '200': {description: 'Stats for a game (publisher/admin)'},
    },
  })
  @authenticate('jwt')
  async stats(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ) {
    await this.ensureOwnsGame(currentUser, id);

    const [available, sold, reserved, totalKeys] = await Promise.all([
      this.gameKeyRepository.count({gameId: id, businessStatus: 'Available'}),
      this.gameKeyRepository.count({gameId: id, businessStatus: 'Sold'}),
      this.gameKeyRepository.count({gameId: id, businessStatus: 'Reserved'}),
      this.gameKeyRepository.count({gameId: id}),
    ]);

    const orderDetails = await this.orderDetailRepository.find({
      where: {gameId: id},
      fields: {value: true, orderId: true},
    });

    const orderIdsWithDetails = new Set(
      orderDetails.map((od: any) => String(od?.orderId ?? '')).filter(Boolean),
    );

    const totalRevenueFromDetails = orderDetails.reduce((sum, od: any) => sum + (od?.value || 0), 0);
    const totalSalesFromDetails = orderDetails.length;

    // Fallback for newer order flow (orders.items[]) when orderDetails are not created.
    const orders = await this.orderRepository.find({
      where: {paymentStatus: 'Completed'} as any,
      fields: {id: true, items: true},
      limit: 2000,
    });

    let totalRevenueFromItems = 0;
    let totalSalesFromItems = 0;
    for (const o of orders as any[]) {
      const orderId = String(o?.id ?? '');
      if (!orderId || orderIdsWithDetails.has(orderId)) continue;
      const items = Array.isArray(o?.items) ? o.items : [];
      for (const line of items as any[]) {
        const slug = String(line?.slug ?? '').trim();
        if (!slug || slug !== String(id)) continue;
        const qty = typeof line?.quantity === 'number' ? Math.max(1, Math.floor(line.quantity)) : 1;
        const unitCents =
          typeof line?.unitPriceCents === 'number' && Number.isFinite(line.unitPriceCents)
            ? Math.max(0, Math.floor(line.unitPriceCents))
            : 0;
        totalSalesFromItems += qty;
        totalRevenueFromItems += (unitCents * qty) / 100;
      }
    }

    const totalRevenue = totalRevenueFromDetails > 0 ? totalRevenueFromDetails : totalRevenueFromItems;
    const totalSales = totalSalesFromDetails > 0 ? totalSalesFromDetails : totalSalesFromItems;

    return {
      keys: {
        available: available.count,
        sold: sold.count,
        reserved: reserved.count,
        total: totalKeys.count,
      },
      sales: {
        totalRevenue,
        totalSales,
      },
    };
  }
}
