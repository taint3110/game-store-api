import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, post, patch, del, param, requestBody, HttpErrors} from '@loopback/rest';
import {authenticate} from '@loopback/authentication';
import {SecurityBindings, UserProfile, securityId} from '@loopback/security';
import {Game} from '../models';
import {GameRepository, PromotionRepository, ReviewRepository} from '../repositories';

type PromotionLike = {
  id?: string;
  promotionName: string;
  discountType: string;
  applicableScope: string;
  applicationCondition: string;
  publisherId: string;
  scope?: string;
  gameIds?: string[];
  status: string;
  startDate: Date;
  expirationDate: Date;
  endDate: Date;
};

function parseNumericValue(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input !== 'string') return null;
  const match = input.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  if (!Number.isFinite(value)) return null;
  return value;
}

function isPromotionActive(promo: PromotionLike, now: Date) {
  if (promo.status !== 'Active') return false;
  const start = promo.startDate ? new Date(promo.startDate) : null;
  const exp = promo.expirationDate ? new Date(promo.expirationDate) : null;
  const end = promo.endDate ? new Date(promo.endDate) : null;
  if (start && now < start) return false;
  if (exp && now > exp) return false;
  if (end && now > end) return false;
  return true;
}

function promotionAppliesToGame(promo: PromotionLike, game: Game) {
  if (promo.applicableScope === 'AllGames') return true;
  if (promo.applicableScope === 'SpecificGames') {
    if (!Array.isArray(promo.gameIds)) return false;
    if (!game.id) return false;
    return promo.gameIds.includes(String(game.id));
  }
  if (promo.applicableScope === 'Category') {
    const category = String(promo.applicationCondition ?? '').trim();
    if (!category) return false;
    return String(game.genre ?? '').trim() === category;
  }
  return false;
}

function computePromoPrice(originalPrice: number, promo: PromotionLike): number | null {
  const raw = parseNumericValue(promo.applicationCondition);
  if (raw === null) return null;

  if (promo.discountType === 'Percentage') {
    const percent = Math.max(0, Math.min(100, Math.abs(raw)));
    const discounted = originalPrice * (1 - percent / 100);
    return Math.max(0, Math.round(discounted * 100) / 100);
  }

  if (promo.discountType === 'FixedAmount') {
    const amount = Math.max(0, Math.abs(raw));
    const discounted = originalPrice - amount;
    return Math.max(0, Math.round(discounted * 100) / 100);
  }

  return null;
}

function applyPromotionsToGame(game: Game, promos: PromotionLike[], now: Date): Game {
  const original =
    typeof game.originalPrice === 'number' && Number.isFinite(game.originalPrice)
      ? game.originalPrice
      : 0;

  const existingDiscount =
    typeof game.discountPrice === 'number' && Number.isFinite(game.discountPrice)
      ? game.discountPrice
      : undefined;
  const existingFinal =
    typeof existingDiscount === 'number' && existingDiscount > 0 && existingDiscount < original
      ? existingDiscount
      : original;

  let bestFinal = existingFinal;

  for (const promo of promos) {
    if (!isPromotionActive(promo, now)) continue;

    const scope = String((promo as any).scope ?? 'Publisher');
    if (scope !== 'Store' && String(promo.publisherId) !== String(game.publisherId)) continue;
    if (!promotionAppliesToGame(promo, game)) continue;

    const promoPrice = computePromoPrice(original, promo);
    if (typeof promoPrice !== 'number') continue;
    if (promoPrice < bestFinal) bestFinal = promoPrice;
  }

  if (bestFinal >= original) {
    return game;
  }

  // Return the same game shape but with an effective discountPrice so the frontend
  // can display original vs discounted (even for "AllGames" promotions).
  return Object.assign(game, {discountPrice: bestFinal});
}

export class GameController {
  constructor(
    @repository(GameRepository)
    public gameRepository: GameRepository,
    @repository(PromotionRepository)
    public promotionRepository: PromotionRepository,
    @repository(ReviewRepository)
    public reviewRepository: ReviewRepository,
  ) {}

  @get('/games', {
    responses: {
      '200': {
        description: 'Array of Game model instances',
        content: {
          'application/json': {
            schema: {type: 'array', items: {'x-ts-type': Game}},
          },
        },
      },
    },
  })
  async find(
    @param.query.string('search') search?: string,
    @param.query.string('genre') genre?: string,
    @param.query.string('publisherId') publisherId?: string,
  ): Promise<Game[]> {
    const where: any = {releaseStatus: 'Released'};

    if (search) {
      where.name = {regexp: new RegExp(search, 'i')};
    }

    if (genre) {
      where.genre = genre;
    }

    if (publisherId) {
      where.publisherId = publisherId;
    }

    const games = await this.gameRepository.find({
      where,
      include: [{relation: 'publisher'}],
    });

    if (games.length === 0) return games;

    const now = new Date();
    const publisherIds = Array.from(new Set(games.map(g => String(g.publisherId)).filter(Boolean)));

    if (publisherIds.length === 0) return games;

    const promos = (await this.promotionRepository.find({
      where: {
        status: 'Active',
        or: [{publisherId: {inq: publisherIds}}, {scope: 'Store'}],
      } as any,
    })) as unknown as PromotionLike[];

    if (promos.length === 0) return games;

    return games.map(game => applyPromotionsToGame(game, promos, now));
  }

  @get('/games/{id}', {
    responses: {
      '200': {
        description: 'Game model instance',
        content: {'application/json': {schema: {'x-ts-type': Game}}},
      },
    },
  })
  async findById(@param.path.string('id') id: string): Promise<any> {
    const game = await this.gameRepository.findById(id, {
      include: [{relation: 'publisher'}],
    });

    const averageRating = await this.reviewRepository.calculateAverageRating(id);

    const now = new Date();
    const promos = (await this.promotionRepository.find({
      where: {
        status: 'Active',
        or: [{publisherId: String(game.publisherId)}, {scope: 'Store'}],
      } as any,
    })) as unknown as PromotionLike[];

    const gameWithPromo = promos.length ? applyPromotionsToGame(game, promos, now) : game;

    return {
      ...gameWithPromo.toJSON(),
      averageRating,
    };
  }

  @post('/games', {
    responses: {
      '201': {
        description: 'Game model instance',
        content: {'application/json': {schema: {'x-ts-type': Game}}},
      },
    },
  })
  @authenticate('jwt')
  async create(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name', 'genre', 'description', 'releaseDate', 'version', 'originalPrice'],
            properties: {
              name: {type: 'string'},
              genre: {type: 'string'},
              description: {type: 'string'},
              imageUrl: {type: 'string'},
              videoUrl: {type: 'string'},
              steamAppId: {type: 'number', minimum: 0},
              releaseDate: {type: 'string', format: 'date'},
              version: {type: 'string'},
              originalPrice: {type: 'number', minimum: 0},
              discountPrice: {type: 'number', minimum: 0},
              publisherId: {type: 'string'},
            },
        },
    })
    async findPaginated(
        @param.query.string('search') search?: string,
        @param.query.string('genre') genre?: string,
        @param.query.string('publisherId') publisherId?: string,
        @param.query.boolean('onSale') onSale?: boolean,
        @param.query.number('page') page: number = 1,
        @param.query.number('limit') limit: number = 20,
    ): Promise<{ data: Game[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
        const where: any = { releaseStatus: 'Released' };

        if (search) {
            where.name = { regexp: new RegExp(search, 'i') };
        }

        if (genre) {
            where.genre = genre;
        }

        if (publisherId) {
            where.publisherId = publisherId;
        }

        if (onSale === true) {
            where.discountPrice = {
                exists: true,
                ne: null,
                gt: 0,
            };
        }

        // Ensure valid pagination values
        const safePage = Math.max(1, page);
        const safeLimit = Math.min(Math.max(1, limit), 100); // Max 100 per page
        const skip = (safePage - 1) * safeLimit;

        const [data, total] = await Promise.all([
            this.gameRepository.find({
                where,
                include: [{ relation: 'publisher' }],
                limit: safeLimit,
                skip,
                order: ['createdAt DESC'],
            }),
            this.gameRepository.count(where),
        ]);

        return {
            data,
            meta: {
                total: total.count,
                page: safePage,
                limit: safeLimit,
                totalPages: Math.ceil(total.count / safeLimit),
            },
        };
    }

    @get('/games/{id}', {
        responses: {
            '200': {
                description: 'Game model instance',
                content: { 'application/json': { schema: { 'x-ts-type': Game } } },
            },
        },
    })
    async findById(@param.path.string('id') id: string): Promise<any> {
        const game = await this.gameRepository.findById(id, {
            include: [{ relation: 'publisher' }],
        });

        const averageRating = await this.reviewRepository.calculateAverageRating(id);

        return {
            ...game.toJSON(),
            averageRating,
        };
    }

    @post('/games', {
        responses: {
            '201': {
                description: 'Game model instance',
                content: { 'application/json': { schema: { 'x-ts-type': Game } } },
            },
        },
    })
    @authenticate('jwt')
    async create(
        @inject(SecurityBindings.USER) currentUser: UserProfile,
        @requestBody({
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        required: ['name', 'genre', 'description', 'releaseDate', 'version', 'originalPrice'],
                        properties: {
                            name: { type: 'string' },
                            genre: { type: 'string' },
                            description: { type: 'string' },
                            imageUrl: { type: 'string' },
                            videoUrl: { type: 'string' },
                            releaseDate: { type: 'string', format: 'date' },
                            version: { type: 'string' },
                            originalPrice: { type: 'number', minimum: 0 },
                            discountPrice: { type: 'number', minimum: 0 },
                            publisherId: { type: 'string' },
                        },
                    },
                },
            },
        })
        gameData: Omit<Game, 'id'>,
    ): Promise<Game> {
        // Admins have full access, publishers can create games
        if (currentUser.accountType !== 'publisher' && currentUser.accountType !== 'admin') {
            throw new HttpErrors.Forbidden('Only publishers and admins can create games');
        }

        // For publishers, use their ID; for admins, use provided publisherId or their ID
        const publisherId =
            currentUser.accountType === 'admin'
                ? (gameData as any).publisherId || currentUser[securityId]
                : currentUser[securityId];

        const game = await this.gameRepository.create({
            ...gameData,
            publisherId,
            releaseStatus: 'Released',
        });

        return game;
    }

    @patch('/games/{id}', {
        responses: {
            '200': {
                description: 'Game PATCH success',
                content: { 'application/json': { schema: { 'x-ts-type': Game } } },
            },
        },
    })
    @authenticate('jwt')
    async updateById(
        @inject(SecurityBindings.USER) currentUser: UserProfile,
        @param.path.string('id') id: string,
        @requestBody({
            content: {
                'application/json': {
                    schema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            genre: { type: 'string' },
                            description: { type: 'string' },
                            imageUrl: { type: 'string' },
                            videoUrl: { type: 'string' },
                            releaseDate: { type: 'string', format: 'date' },
                            version: { type: 'string' },
                            originalPrice: { type: 'number', minimum: 0 },
                            discountPrice: { type: 'number', minimum: 0 },
                        },
                    },
                },
            },
        })
        gameData: Partial<Game>,
    ): Promise<Game> {
        // Admins have full access
        if (currentUser.accountType === 'admin') {
            // Prevent updating restricted fields
            delete (gameData as any).id;

            await this.gameRepository.updateById(id, {
                ...gameData,
                updatedAt: new Date(),
            });

            return this.gameRepository.findById(id);
        }

        // Only publishers can update games
        if (currentUser.accountType !== 'publisher') {
            throw new HttpErrors.Forbidden('Only publishers and admins can update games');
        }

        const publisherId = currentUser[securityId];
        const game = await this.gameRepository.findById(id);

        // Check ownership
        if (game.publisherId !== publisherId) {
            throw new HttpErrors.Forbidden('You can only update your own games');
        }

        // Prevent updating restricted fields
        delete (gameData as any).id;
        delete (gameData as any).publisherId;

        await this.gameRepository.updateById(id, {
            ...gameData,
            updatedAt: new Date(),
        });

        return this.gameRepository.findById(id);
    }

    @del('/games/{id}', {
        responses: {
            '204': {
                description: 'Game DELETE success',
            },
        },
    })
    @authenticate('jwt')
    async deleteById(
        @inject(SecurityBindings.USER) currentUser: UserProfile,
        @param.path.string('id') id: string,
    ): Promise<void> {
        // Admins have full access
        if (currentUser.accountType === 'admin') {
            await this.gameRepository.updateById(id, {
                releaseStatus: 'Delisted',
                updatedAt: new Date(),
            });
            return;
        }

        // Only publishers can delete games
        if (currentUser.accountType !== 'publisher') {
            throw new HttpErrors.Forbidden('Only publishers and admins can delete games');
        }

        const publisherId = currentUser[securityId];
        const game = await this.gameRepository.findById(id);

        // Check ownership
        if (game.publisherId !== publisherId) {
            throw new HttpErrors.Forbidden('You can only delete your own games');
        }

        // Soft delete by setting status to Delisted
        await this.gameRepository.updateById(id, {
            releaseStatus: 'Delisted',
            updatedAt: new Date(),
        });
    }

    @get('/games/{id}/reviews', {
        responses: {
            '200': {
                description: 'Array of Review model instances for a game',
                content: {
                    'application/json': {
                        schema: { type: 'object' },
                    },
                },
            },
        },
    })
    async getReviews(@param.path.string('id') id: string, @param.query.string('sort') sort?: string): Promise<any> {
        const reviews = await this.reviewRepository.find({
            where: { gameId: id },
            include: [{ relation: 'customer' }],
        });

        // Sort reviews
        if (sort === 'date_desc') {
            reviews.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } else if (sort === 'date_asc') {
            reviews.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        } else if (sort === 'rating_desc') {
            reviews.sort((a, b) => b.rating - a.rating);
        } else if (sort === 'rating_asc') {
            reviews.sort((a, b) => a.rating - b.rating);
        }

        const averageRating = await this.reviewRepository.calculateAverageRating(id);

        // Remove password from customer data
        const sanitizedReviews = reviews.map((review) => {
            const reviewJson = review.toJSON() as any;
            if (reviewJson.customer) {
                delete reviewJson.customer.password;
            }
            return reviewJson;
        });

        return {
            reviews: sanitizedReviews,
            averageRating,
            totalReviews: reviews.length,
        };
    }
}
