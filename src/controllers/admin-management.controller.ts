import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, patch, del, param, requestBody, HttpErrors} from '@loopback/rest';
import {authenticate} from '@loopback/authentication';
import {SecurityBindings, UserProfile} from '@loopback/security';
import {
  CustomerAccountRepository,
  PublisherAccountRepository,
  OrderRepository,
  GameRepository,
  ReviewRepository,
} from '../repositories';

export class AdminManagementController {
  constructor(
    @repository(CustomerAccountRepository)
    public customerAccountRepository: CustomerAccountRepository,
    @repository(PublisherAccountRepository)
    public publisherAccountRepository: PublisherAccountRepository,
    @repository(OrderRepository)
    public orderRepository: OrderRepository,
    @repository(GameRepository)
    public gameRepository: GameRepository,
    @repository(ReviewRepository)
    public reviewRepository: ReviewRepository,
  ) {}

  // Customer Management
  @get('/admin/customers', {
    responses: {
      '200': {
        description: 'List all customers',
      },
    },
  })
  @authenticate('jwt')
  async listCustomers(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<any[]> {
    if (currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }

    const customers = await this.customerAccountRepository.find({
      include: [{relation: 'gender'}],
    });

    return customers.map(customer => {
      const customerJson = customer.toJSON() as any;
      delete customerJson.password;
      return customerJson;
    });
  }

  @get('/admin/customers/{id}', {
    responses: {
      '200': {
        description: 'Customer details',
      },
    },
  })
  @authenticate('jwt')
  async getCustomer(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<any> {
    if (currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }

    const customer = await this.customerAccountRepository.findById(id, {
      include: [{relation: 'gender'}],
    });

    const customerJson = customer.toJSON() as any;
    delete customerJson.password;
    return customerJson;
  }

  @patch('/admin/customers/{id}', {
    responses: {
      '200': {
        description: 'Customer updated',
      },
    },
  })
  @authenticate('jwt')
  async updateCustomer(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              username: {type: 'string'},
              phoneNumber: {type: 'string'},
              accountStatus: {type: 'string', enum: ['Active', 'Suspended', 'Banned']},
              accountBalance: {type: 'number'},
              genderId: {type: 'string'},
            },
          },
        },
      },
    })
    updateData: any,
  ): Promise<void> {
    if (currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }

    delete updateData.email;
    delete updateData.password;

    await this.customerAccountRepository.updateById(id, {
      ...updateData,
      updatedAt: new Date(),
    });
  }

  @del('/admin/customers/{id}', {
    responses: {
      '204': {
        description: 'Customer deleted',
      },
    },
  })
  @authenticate('jwt')
  async deleteCustomer(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<void> {
    if (currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }

    await this.customerAccountRepository.deleteById(id);
  }

  // Publisher Management
  @get('/admin/publishers', {
    responses: {
      '200': {
        description: 'List all publishers',
      },
    },
  })
  @authenticate('jwt')
  async listPublishers(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<any[]> {
    if (currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }

    const publishers = await this.publisherAccountRepository.find();

    return publishers.map(publisher => {
      const publisherJson = publisher.toJSON() as any;
      delete publisherJson.password;
      return publisherJson;
    });
  }

  @get('/admin/publishers/{id}', {
    responses: {
      '200': {
        description: 'Publisher details',
      },
    },
  })
  @authenticate('jwt')
  async getPublisher(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<any> {
    if (currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }

    const publisher = await this.publisherAccountRepository.findById(id);

    const publisherJson = publisher.toJSON() as any;
    delete publisherJson.password;
    return publisherJson;
  }

  @patch('/admin/publishers/{id}', {
    responses: {
      '200': {
        description: 'Publisher updated',
      },
    },
  })
  @authenticate('jwt')
  async updatePublisher(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              publisherName: {type: 'string'},
              phoneNumber: {type: 'string'},
              activityStatus: {type: 'string', enum: ['Active', 'Inactive']},
              contractDate: {type: 'string', format: 'date'},
              contractDuration: {type: 'number'},
            },
          },
        },
      },
    })
    updateData: any,
  ): Promise<void> {
    if (currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }

    delete updateData.email;
    delete updateData.password;

    await this.publisherAccountRepository.updateById(id, updateData);
  }

  @del('/admin/publishers/{id}', {
    responses: {
      '204': {
        description: 'Publisher deleted',
      },
    },
  })
  @authenticate('jwt')
  async deletePublisher(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<void> {
    if (currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }

    await this.publisherAccountRepository.deleteById(id);
  }

  // Order Management
  @get('/admin/orders', {
    responses: {
      '200': {
        description: 'List all orders',
      },
    },
  })
  @authenticate('jwt')
  async listOrders(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<any[]> {
    if (currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }

    return this.orderRepository.find({
      include: [
        {relation: 'customer'},
        {
          relation: 'orderDetails',
          scope: {
            include: [{relation: 'game'}],
          },
        },
      ],
      order: ['orderDate DESC'],
    });
  }

  @get('/admin/orders/{id}', {
    responses: {
      '200': {
        description: 'Order details',
      },
    },
  })
  @authenticate('jwt')
  async getOrder(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<any> {
    if (currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }

    return this.orderRepository.findById(id, {
      include: [
        {relation: 'customer'},
        {
          relation: 'orderDetails',
          scope: {
            include: [{relation: 'game'}, {relation: 'gameKey'}],
          },
        },
      ],
    });
  }

  // Game Management (Admin view)
  @get('/admin/games', {
    responses: {
      '200': {
        description: 'List all games including delisted',
      },
    },
  })
  @authenticate('jwt')
  async listAllGames(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<any[]> {
    if (currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }

    return this.gameRepository.find({
      include: [{relation: 'publisher'}],
    });
  }

  // Review Management
  @get('/admin/reviews', {
    responses: {
      '200': {
        description: 'List all reviews',
      },
    },
  })
  @authenticate('jwt')
  async listReviews(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<any[]> {
    if (currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }

    return this.reviewRepository.find({
      include: [{relation: 'customer'}, {relation: 'game'}],
    });
  }

  @del('/admin/reviews/{id}', {
    responses: {
      '204': {
        description: 'Review deleted',
      },
    },
  })
  @authenticate('jwt')
  async deleteReview(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<void> {
    if (currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }

    await this.reviewRepository.deleteById(id);
  }

  // Statistics
  @get('/admin/statistics', {
    responses: {
      '200': {
        description: 'Platform statistics',
      },
    },
  })
  @authenticate('jwt')
  async getStatistics(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<any> {
    if (currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }

    const [
      totalCustomers,
      totalPublishers,
      totalGames,
      totalOrders,
      totalReviews,
    ] = await Promise.all([
      this.customerAccountRepository.count(),
      this.publisherAccountRepository.count(),
      this.gameRepository.count(),
      this.orderRepository.count(),
      this.reviewRepository.count(),
    ]);

    return {
      totalCustomers: totalCustomers.count,
      totalPublishers: totalPublishers.count,
      totalGames: totalGames.count,
      totalOrders: totalOrders.count,
      totalReviews: totalReviews.count,
    };
  }
}
