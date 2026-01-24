import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {HttpErrors, post, requestBody} from '@loopback/rest';
import {SecurityBindings, UserProfile, securityId} from '@loopback/security';
import {
  CustomerAccountRepository,
  PublisherAccountRepository,
  GameRepository,
  GameKeyRepository,
  OrderRepository,
  OrderDetailRepository,
} from '../repositories';
import {PasswordService} from '../services';
import {generateKeyCode} from '../utils/key-code';

type SeedPublisherDashboardBody = {
  games?: number;
  keysPerGame?: number;
  orders?: number;
  publisherId?: string;
};

export class DevSeedController {
  constructor(
    @repository(CustomerAccountRepository)
    public customerAccountRepository: CustomerAccountRepository,
    @repository(PublisherAccountRepository)
    public publisherAccountRepository: PublisherAccountRepository,
    @repository(GameRepository)
    public gameRepository: GameRepository,
    @repository(GameKeyRepository)
    public gameKeyRepository: GameKeyRepository,
    @repository(OrderRepository)
    public orderRepository: OrderRepository,
    @repository(OrderDetailRepository)
    public orderDetailRepository: OrderDetailRepository,
    @inject('services.PasswordService')
    public passwordService: PasswordService,
  ) {}

  private ensureDevSeedAllowed() {
    if (String(process.env.ALLOW_DEV_SEED ?? '').toLowerCase() !== 'true') {
      throw new HttpErrors.NotFound();
    }
  }

  private ensurePublisherOrAdmin(currentUser: UserProfile) {
    const type = (currentUser as any)?.accountType;
    if (type !== 'publisher' && type !== 'admin') {
      throw new HttpErrors.Forbidden('Publisher access required');
    }
  }

  private isAdmin(currentUser: UserProfile) {
    return (currentUser as any)?.accountType === 'admin';
  }

  private ensureAdmin(currentUser: UserProfile) {
    if ((currentUser as any)?.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }
  }

  private async getOrCreateDemoPublisher(publisherIdHint?: string) {
    if (publisherIdHint) {
      return this.publisherAccountRepository.findById(publisherIdHint);
    }

    const email = 'demo.publisher@gamestore.local';
    const existing = await this.publisherAccountRepository.findByEmail(email);
    if (existing) return existing;

    const hashed = await this.passwordService.hashPassword('DemoPass123!');
    return this.publisherAccountRepository.create({
      publisherName: 'Demo Publisher',
      email,
      phoneNumber: '0000000000',
      contractDate: new Date(),
      contractDuration: 12,
      activityStatus: 'Active',
      password: hashed,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  private async getOrCreateDemoPublisherByIndex(index: number) {
    const i = Math.max(1, Math.floor(index));
    const email = `demo.publisher${i}@gamestore.local`;
    const existing = await this.publisherAccountRepository.findByEmail(email);
    if (existing) return existing;

    const hashed = await this.passwordService.hashPassword('DemoPass123!');
    return this.publisherAccountRepository.create({
      publisherName: `Demo Publisher ${i}`,
      email,
      phoneNumber: `09000000${String(i).padStart(2, '0')}`,
      contractDate: new Date(),
      contractDuration: 12,
      activityStatus: 'Active',
      password: hashed,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  private async getOrCreateDemoCustomer() {
    const email = 'demo.customer@gamestore.local';
    const existing = await this.customerAccountRepository.findByEmail(email);
    if (existing) return existing;

    const hashed = await this.passwordService.hashPassword('DemoPass123!');
    return this.customerAccountRepository.create({
      email,
      phoneNumber: '0912345678',
      username: 'DemoCustomer',
      password: hashed,
      accountStatus: 'Active',
      accountBalance: 9999,
      registrationDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  private async getOrCreateDemoCustomerByIndex(index: number) {
    const i = Math.max(1, Math.floor(index));
    const email = `demo.customer${i}@gamestore.local`;
    const existing = await this.customerAccountRepository.findByEmail(email);
    if (existing) return existing;

    const hashed = await this.passwordService.hashPassword('DemoPass123!');
    return this.customerAccountRepository.create({
      email,
      phoneNumber: `09100000${String(i).padStart(2, '0')}`,
      username: `DemoCustomer${i}`,
      password: hashed,
      accountStatus: 'Active',
      accountBalance: 9999,
      registrationDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }

  private clampInt(n: unknown, min: number, max: number, fallback: number) {
    const v = Math.floor(Number(n));
    if (!Number.isFinite(v)) return fallback;
    return Math.max(min, Math.min(max, v));
  }

  private async ensureDemoGames(publisherId: string, desiredCount: number) {
    const regex = new RegExp('^\\[Demo\\]', 'i');
    const existing = await this.gameRepository.find({
      where: {publisherId, name: {regexp: regex}} as any,
      order: ['createdAt ASC'],
      limit: 50,
    });

    const games = [...(existing as any[])];
    const templates = [
      {name: '[Demo] Space Raiders', genre: 'Action', price: 19.99},
      {name: '[Demo] Dungeon Chef', genre: 'RPG', price: 29.99},
      {name: '[Demo] Neon Drift', genre: 'Racing', price: 14.99},
      {name: '[Demo] Cozy Farm VR', genre: 'Simulation', price: 24.99},
      {name: '[Demo] Pixel Tactics', genre: 'Strategy', price: 9.99},
    ];

    const now = new Date();
    while (games.length < desiredCount) {
      const t = templates[games.length % templates.length];
      const releaseDate = new Date(now);
      releaseDate.setDate(releaseDate.getDate() - 60 - games.length * 7);
      const originalPrice = t.price;
      const discountPrice = Math.max(0, Math.round(originalPrice * 0.8 * 100) / 100);
      const created = await this.gameRepository.create({
        name: t.name,
        genre: t.genre,
        description: `Seeded demo game for publisher dashboard stats. (${new Date().toISOString()})`,
        imageUrl: 'https://placehold.co/600x400/png',
        releaseDate,
        publisherId,
        releaseStatus: 'Released',
        version: '1.0',
        originalPrice,
        discountPrice,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      games.push(created as any);
    }

    return games;
  }

  private async ensureAvailableKeys(gameId: string, gameVersion: string, minAvailable: number) {
    const available = await this.gameKeyRepository.count({
      gameId,
      businessStatus: 'Available',
    } as any);

    const missing = Math.max(0, minAvailable - available.count);
    if (missing === 0) return {created: 0};

    const now = new Date();
    const batch = Array.from({length: missing}, () => ({
      gameId,
      gameVersion,
      keyCode: generateKeyCode(),
      publishRegistrationDate: now,
      businessStatus: 'Available',
      activationStatus: 'NotActivated',
      createdAt: now,
      updatedAt: now,
    }));
    await this.gameKeyRepository.createAll(batch as any[]);
    return {created: missing};
  }

  private pickGames(games: Array<any>, count: number, offset: number) {
    if (games.length === 0) return [];
    const picked: any[] = [];
    for (let i = 0; i < count; i++) {
      picked.push(games[(offset + i) % games.length]);
    }
    return picked;
  }

  @post('/dev/seed/publisher-dashboard', {
    responses: {
      '200': {description: 'Seed demo games/orders/keys for publisher dashboard'},
    },
  })
  @authenticate('jwt')
  async seedPublisherDashboard(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              games: {type: 'number', minimum: 1, maximum: 10},
              keysPerGame: {type: 'number', minimum: 10, maximum: 500},
              orders: {type: 'number', minimum: 1, maximum: 200},
              publisherId: {type: 'string'},
            },
          },
        },
      },
    })
    body: SeedPublisherDashboardBody = {},
  ) {
    this.ensureDevSeedAllowed();
    this.ensurePublisherOrAdmin(currentUser);

    const desiredGames = this.clampInt(body.games, 1, 10, 3);
    const keysPerGame = this.clampInt(body.keysPerGame, 10, 500, 60);
    const desiredOrders = this.clampInt(body.orders, 1, 200, 12);

    const publisherId =
      (currentUser as any)?.accountType === 'publisher'
        ? String(currentUser[securityId])
        : String((body.publisherId ?? '').trim()) || String((await this.getOrCreateDemoPublisher()).id);

    if (this.isAdmin(currentUser) && body.publisherId) {
      await this.publisherAccountRepository.findById(publisherId);
    }

    const customer = await this.getOrCreateDemoCustomer();
    const games = await this.ensureDemoGames(publisherId, desiredGames);

    let createdKeys = 0;
    for (const g of games as any[]) {
      const res = await this.ensureAvailableKeys(String(g.id), String(g.version ?? '1.0'), keysPerGame);
      createdKeys += res.created;
    }

    let createdOrders = 0;
    let createdOrderDetails = 0;
    let usedKeys = 0;

    const now = new Date();
    for (let i = 1; i <= desiredOrders; i++) {
      const txId = `seed-dash-${publisherId.slice(-6)}-${i}`;
      const exists = await this.orderRepository.findOne({where: {transactionId: txId}});
      if (exists) continue;

      const orderDate = new Date(now);
      orderDate.setDate(orderDate.getDate() - i * 2);

      const linesCount = i % 3 === 0 ? 2 : 1;
      const picked = this.pickGames(games as any[], linesCount, i);

      const items: any[] = [];
      const detailsToCreate: any[] = [];
      const keysToSell: string[] = [];
      let totalValue = 0;

      for (const game of picked) {
        const unit = typeof game.discountPrice === 'number' ? game.discountPrice : game.originalPrice;
        const unitCents = Math.max(0, Math.floor(unit * 100));
        const quantity = 1;

        let keys = await this.gameKeyRepository.find({
          where: {gameId: String(game.id), businessStatus: 'Available'} as any,
          limit: quantity,
        });

        if (keys.length < quantity) {
          const res = await this.ensureAvailableKeys(String(game.id), String(game.version ?? '1.0'), quantity);
          createdKeys += res.created;
          keys = await this.gameKeyRepository.find({
            where: {gameId: String(game.id), businessStatus: 'Available'} as any,
            limit: quantity,
          });
        }

        if (keys.length < quantity) {
          throw new HttpErrors.UnprocessableEntity('Not enough keys to seed orders');
        }

        const keyCodes = (keys as any[]).map(k => String((k as any).keyCode ?? (k as any).id));
        for (const k of keys as any[]) keysToSell.push(String(k.id));

        items.push({
          slug: String(game.id),
          name: String(game.name),
          quantity,
          unitPriceCents: unitCents,
          image: String(game.imageUrl ?? ''),
          keyCodes,
        });

        totalValue += (unitCents * quantity) / 100;
      }

      const order = await this.orderRepository.create({
        customerId: String(customer.id),
        orderDate,
        totalValue: Math.round(totalValue * 100) / 100,
        paymentMethod: 'Wallet',
        transactionId: txId,
        paymentStatus: 'Completed',
        items,
        createdAt: orderDate,
        updatedAt: orderDate,
      } as any);

      for (const item of items) {
        const gameId = String(item.slug);
        const value = (Number(item.unitPriceCents) || 0) / 100;
        for (const keyCode of item.keyCodes as string[]) {
          const key = await this.gameKeyRepository.findOne({where: {gameId, keyCode} as any});
          if (!key) continue;
          detailsToCreate.push({
            orderId: String((order as any).id),
            gameId,
            gameKeyId: String((key as any).id),
            value,
            createdAt: orderDate,
            updatedAt: orderDate,
          });
        }
      }

      for (const keyId of keysToSell) {
        const key = await this.gameKeyRepository.findById(keyId).catch(() => null);
        if (!key) continue;
        if ((key as any).businessStatus !== 'Available') continue;
        await this.gameKeyRepository.updateById(keyId, {
          businessStatus: 'Sold',
          ownedByCustomerId: String(customer.id),
          customerOwnershipDate: orderDate,
          updatedAt: orderDate,
        } as any);
        usedKeys += 1;
      }

      if (detailsToCreate.length) {
        await this.orderDetailRepository.createAll(detailsToCreate as any[]);
        createdOrderDetails += detailsToCreate.length;
      }

      createdOrders += 1;
    }

    return {
      seededForPublisherId: publisherId,
      demoCustomerId: String((customer as any).id),
      demoGames: (games as any[]).map(g => ({id: String(g.id), name: String(g.name)})),
      created: {
        availableKeys: createdKeys,
        orders: createdOrders,
        orderDetails: createdOrderDetails,
      },
      usedKeys,
      note:
        'Dev seed endpoint. Enable with ALLOW_DEV_SEED=true. Creates [Demo] games, keys, and completed orders for dashboard testing.',
    };
  }

  @post('/dev/seed/admin-statistics', {
    responses: {
      '200': {description: 'Seed demo data for admin statistics (multiple publishers)'},
    },
  })
  @authenticate('jwt')
  async seedAdminStatistics(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              publishers: {type: 'number', minimum: 1, maximum: 5},
              gamesPerPublisher: {type: 'number', minimum: 1, maximum: 10},
              keysPerGame: {type: 'number', minimum: 10, maximum: 500},
              ordersPerPublisher: {type: 'number', minimum: 1, maximum: 200},
            },
          },
        },
      },
    })
    body: {publishers?: number; gamesPerPublisher?: number; keysPerGame?: number; ordersPerPublisher?: number} = {},
  ) {
    this.ensureDevSeedAllowed();
    this.ensureAdmin(currentUser);

    const publishers = this.clampInt(body.publishers, 1, 5, 3);
    const gamesPerPublisher = this.clampInt(body.gamesPerPublisher, 1, 10, 3);
    const keysPerGame = this.clampInt(body.keysPerGame, 10, 500, 60);
    const ordersPerPublisher = this.clampInt(body.ordersPerPublisher, 1, 200, 12);

    const results: any[] = [];

    for (let i = 1; i <= publishers; i++) {
      const publisher = await this.getOrCreateDemoPublisherByIndex(i);
      const customer = await this.getOrCreateDemoCustomerByIndex(i);

      const publisherId = String((publisher as any).id);
      const games = await this.ensureDemoGames(publisherId, gamesPerPublisher);

      let createdKeys = 0;
      for (const g of games as any[]) {
        const res = await this.ensureAvailableKeys(String(g.id), String(g.version ?? '1.0'), keysPerGame);
        createdKeys += res.created;
      }

      let createdOrders = 0;
      let createdOrderDetails = 0;
      let usedKeys = 0;

      const now = new Date();
      for (let j = 1; j <= ordersPerPublisher; j++) {
        const txId = `seed-admin-${i}-${publisherId.slice(-6)}-${j}`;
        const exists = await this.orderRepository.findOne({where: {transactionId: txId}});
        if (exists) continue;

        const orderDate = new Date(now);
        orderDate.setDate(orderDate.getDate() - j * (i + 1));

        const linesCount = j % 4 === 0 ? 2 : 1;
        const picked = this.pickGames(games as any[], linesCount, j + i);

        const items: any[] = [];
        const detailsToCreate: any[] = [];
        const keysToSell: string[] = [];
        let totalValue = 0;

        for (const game of picked) {
          const unit = typeof game.discountPrice === 'number' ? game.discountPrice : game.originalPrice;
          const unitCents = Math.max(0, Math.floor(unit * 100));
          const quantity = 1;

          let keys = await this.gameKeyRepository.find({
            where: {gameId: String(game.id), businessStatus: 'Available'} as any,
            limit: quantity,
          });
          if (keys.length < quantity) {
            const res = await this.ensureAvailableKeys(String(game.id), String(game.version ?? '1.0'), quantity);
            createdKeys += res.created;
            keys = await this.gameKeyRepository.find({
              where: {gameId: String(game.id), businessStatus: 'Available'} as any,
              limit: quantity,
            });
          }
          if (keys.length < quantity) {
            throw new HttpErrors.UnprocessableEntity('Not enough keys to seed orders');
          }

          const keyCodes = (keys as any[]).map(k => String((k as any).keyCode ?? (k as any).id));
          for (const k of keys as any[]) keysToSell.push(String(k.id));

          items.push({
            slug: String(game.id),
            name: String(game.name),
            quantity,
            unitPriceCents: unitCents,
            image: String(game.imageUrl ?? ''),
            keyCodes,
          });
          totalValue += (unitCents * quantity) / 100;
        }

        const order = await this.orderRepository.create({
          customerId: String((customer as any).id),
          orderDate,
          totalValue: Math.round(totalValue * 100) / 100,
          paymentMethod: 'Wallet',
          transactionId: txId,
          paymentStatus: 'Completed',
          items,
          createdAt: orderDate,
          updatedAt: orderDate,
        } as any);

        for (const item of items) {
          const gameId = String(item.slug);
          const value = (Number(item.unitPriceCents) || 0) / 100;
          for (const keyCode of item.keyCodes as string[]) {
            const key = await this.gameKeyRepository.findOne({where: {gameId, keyCode} as any});
            if (!key) continue;
            detailsToCreate.push({
              orderId: String((order as any).id),
              gameId,
              gameKeyId: String((key as any).id),
              value,
              createdAt: orderDate,
              updatedAt: orderDate,
            });
          }
        }

        for (const keyId of keysToSell) {
          const key = await this.gameKeyRepository.findById(keyId).catch(() => null);
          if (!key) continue;
          if ((key as any).businessStatus !== 'Available') continue;
          await this.gameKeyRepository.updateById(keyId, {
            businessStatus: 'Sold',
            ownedByCustomerId: String((customer as any).id),
            customerOwnershipDate: orderDate,
            updatedAt: orderDate,
          } as any);
          usedKeys += 1;
        }

        if (detailsToCreate.length) {
          await this.orderDetailRepository.createAll(detailsToCreate as any[]);
          createdOrderDetails += detailsToCreate.length;
        }

        createdOrders += 1;
      }

      results.push({
        publisherId,
        publisherEmail: String((publisher as any).email),
        customerEmail: String((customer as any).email),
        games: (games as any[]).map(g => ({id: String(g.id), name: String(g.name)})),
        created: {availableKeys: createdKeys, orders: createdOrders, orderDetails: createdOrderDetails},
        usedKeys,
      });
    }

    return {
      publishers,
      results,
      note:
        'Dev seed endpoint for admin statistics. Enable with ALLOW_DEV_SEED=true. Creates multiple demo publishers, games, keys, and completed orders.',
    };
  }
}
