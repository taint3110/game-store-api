import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, post, patch, del, param, requestBody, HttpErrors} from '@loopback/rest';
import {authenticate} from '@loopback/authentication';
import {SecurityBindings, UserProfile, securityId} from '@loopback/security';
import {Game} from '../models';
import {GameRepository, ReviewRepository} from '../repositories';

export class GameController {
  constructor(
    @repository(GameRepository)
    public gameRepository: GameRepository,
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

    return this.gameRepository.find({
      where,
      include: [{relation: 'publisher'}],
    });
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

    return {
      ...game.toJSON(),
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
    const publisherId = currentUser.accountType === 'admin' 
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
        content: {'application/json': {schema: {'x-ts-type': Game}}},
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
            schema: {type: 'object'},
          },
        },
      },
    },
  })
  async getReviews(
    @param.path.string('id') id: string,
    @param.query.string('sort') sort?: string,
  ): Promise<any> {
    const reviews = await this.reviewRepository.find({
      where: {gameId: id},
      include: [{relation: 'customer'}],
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
    const sanitizedReviews = reviews.map(review => {
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
