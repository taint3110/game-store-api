import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {authenticate} from '@loopback/authentication';
import {SecurityBindings, UserProfile, securityId} from '@loopback/security';
import {get, post, patch, param, requestBody, HttpErrors} from '@loopback/rest';
import {
  GameRepository,
  GameKeyRepository,
  OrderDetailRepository,
} from '../repositories';
import {GameKey} from '../models';

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
      fields: {value: true},
    });
    const totalRevenue = orderDetails.reduce((sum, od) => sum + (od.value || 0), 0);
    const totalSales = orderDetails.length;

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

