import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, patch, del, param, post, requestBody, HttpErrors} from '@loopback/rest';
import {authenticate} from '@loopback/authentication';
import {SecurityBindings, UserProfile, securityId} from '@loopback/security';
import {
  CustomerAccountRepository,
  PublisherAccountRepository,
  OrderRepository,
  GameRepository,
  ReviewRepository,
  AdminAccountRepository,
  RefundRequestRepository,
} from '../repositories';
import {PasswordService} from '../services';

export class AdminManagementController {
  constructor(
    @repository(CustomerAccountRepository)
    public customerAccountRepository: CustomerAccountRepository,
    @repository(PublisherAccountRepository)
    public publisherAccountRepository: PublisherAccountRepository,
    @repository(AdminAccountRepository)
    public adminAccountRepository: AdminAccountRepository,
    @repository(OrderRepository)
    public orderRepository: OrderRepository,
    @repository(RefundRequestRepository)
    public refundRequestRepository: RefundRequestRepository,
    @repository(GameRepository)
    public gameRepository: GameRepository,
    @repository(ReviewRepository)
    public reviewRepository: ReviewRepository,
    @inject('services.PasswordService')
    public passwordService: PasswordService,
  ) {}

  private static ensureAdmin(currentUser: UserProfile) {
    if ((currentUser as any)?.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }
  }

  private async refundOrderIfNeeded(orderId: string, adminId: string): Promise<any> {
    const order = await this.orderRepository.findById(orderId);

    if (String(order.paymentStatus) === 'Refunded') {
      return order;
    }

    if (String(order.paymentStatus) !== 'Completed') {
      throw new HttpErrors.UnprocessableEntity('Only completed orders can be refunded');
    }

    const refundAmount = typeof order.totalValue === 'number' && Number.isFinite(order.totalValue) ? order.totalValue : 0;
    if (refundAmount < 0) {
      throw new HttpErrors.UnprocessableEntity('Invalid refund amount');
    }

    const customer = await this.customerAccountRepository.findById(order.customerId);
    const currentBalance =
      typeof (customer as any).accountBalance === 'number' && Number.isFinite((customer as any).accountBalance)
        ? (customer as any).accountBalance
        : 0;

    await this.customerAccountRepository.updateById(order.customerId, {
      accountBalance: currentBalance + refundAmount,
      updatedAt: new Date(),
    } as any);

    await this.orderRepository.updateById(orderId, {
      paymentStatus: 'Refunded',
      updatedAt: new Date(),
    } as any);

    const pending = await this.refundRequestRepository.find({
      where: {orderId, status: 'Pending'},
    });

    const resolvedAt = new Date();
    await Promise.all(
      pending.map(req =>
        this.refundRequestRepository.updateById(req.id!, {
          status: 'Approved',
          resolvedAt,
          processedByAdminId: adminId,
        } as any),
      ),
    );

    return this.orderRepository.findById(orderId);
  }

  // Admin creates a publisher account
  @post('/admin/publishers', {
    responses: {
      '201': {
        description: 'Publisher account created by admin',
      },
    },
  })
  @authenticate('jwt')
  async createPublisher(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['publisherName', 'email', 'phoneNumber', 'password', 'contractDate', 'contractDuration'],
            properties: {
              publisherName: {type: 'string'},
              email: {type: 'string', format: 'email'},
              phoneNumber: {type: 'string'},
              password: {type: 'string', minLength: 8},
              socialMedia: {type: 'string'},
              bankType: {type: 'string'},
              bankName: {type: 'string'},
              contractDate: {type: 'string', format: 'date'},
              contractDuration: {type: 'number', minimum: 1},
            },
          },
        },
      },
    })
    payload: any,
  ) {
    AdminManagementController.ensureAdmin(currentUser);

    const email = (payload?.email ?? '').trim().toLowerCase();
    if (!email) throw new HttpErrors.BadRequest('email is required');

    // Unique across all account types
    const dupCustomer = await this.customerAccountRepository.findByEmail(email);
    const dupPublisher = await this.publisherAccountRepository.findByEmail(email);
    const dupAdmin = await this.adminAccountRepository.findByEmail(email);
    if (dupCustomer || dupPublisher || dupAdmin) {
      throw new HttpErrors.Conflict('Email already exists');
    }

    const hashed = await this.passwordService.hashPassword(payload?.password ?? '');

    const publisher = await this.publisherAccountRepository.create({
      publisherName: payload.publisherName,
      email,
      phoneNumber: payload.phoneNumber,
      socialMedia: payload.socialMedia,
      bankType: payload.bankType,
      bankName: payload.bankName,
      contractDate: payload.contractDate ? new Date(payload.contractDate) : new Date(),
      contractDuration: payload.contractDuration ?? 1,
      activityStatus: 'Active',
      password: hashed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const json = publisher.toJSON() as any;
    delete json.password;
    return json;
  }

  // Admin creates another admin account
  @post('/admin/admins', {
    responses: {
      '201': {
        description: 'Admin account created by admin',
      },
    },
  })
  @authenticate('jwt')
  async createAdmin(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['email', 'password', 'phoneNumber'],
            properties: {
              email: {type: 'string', format: 'email'},
              password: {type: 'string', minLength: 8},
              phoneNumber: {type: 'string'},
              role: {type: 'string', enum: ['SuperAdmin', 'Admin', 'Moderator']},
              genderId: {type: 'string'},
            },
          },
        },
      },
    })
    payload: any,
  ) {
    AdminManagementController.ensureAdmin(currentUser);

    const email = (payload?.email ?? '').trim().toLowerCase();
    if (!email) throw new HttpErrors.BadRequest('email is required');

    const dupCustomer = await this.customerAccountRepository.findByEmail(email);
    const dupPublisher = await this.publisherAccountRepository.findByEmail(email);
    const dupAdmin = await this.adminAccountRepository.findByEmail(email);
    if (dupCustomer || dupPublisher || dupAdmin) {
      throw new HttpErrors.Conflict('Email already exists');
    }

    const hashed = await this.passwordService.hashPassword(payload?.password ?? '');

    const admin = await this.adminAccountRepository.create({
      email,
      password: hashed,
      phoneNumber: payload.phoneNumber,
      role: payload.role ?? 'Admin',
      genderId: payload.genderId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const json = admin.toJSON() as any;
    delete json.password;
    return json;
  }

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
    AdminManagementController.ensureAdmin(currentUser);

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
    AdminManagementController.ensureAdmin(currentUser);

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
              accountStatus: {type: 'string', enum: ['Active', 'Inactive', 'Suspended']},
              accountBalance: {type: 'number'},
              genderId: {type: 'string'},
            },
          },
        },
      },
    })
    updateData: any,
  ): Promise<void> {
    AdminManagementController.ensureAdmin(currentUser);

    delete updateData.email;
    delete updateData.password;

    await this.customerAccountRepository.updateById(id, {
      ...updateData,
      updatedAt: new Date(),
    });
  }

  @post('/admin/customers/{id}/wallet/topup', {
    responses: {
      '200': {
        description: 'Customer wallet topped up',
      },
    },
  })
  @authenticate('jwt')
  async topupCustomerWallet(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['amount'],
            properties: {
              amount: {type: 'number', minimum: 0.01},
            },
          },
        },
      },
    })
    body: {amount: number},
  ): Promise<any> {
    AdminManagementController.ensureAdmin(currentUser);

    const amount = typeof body?.amount === 'number' && Number.isFinite(body.amount) ? body.amount : NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpErrors.BadRequest('amount must be a positive number');
    }

    const customer = await this.customerAccountRepository.findById(id);
    const currentBalance =
      typeof (customer as any).accountBalance === 'number' && Number.isFinite((customer as any).accountBalance)
        ? Number((customer as any).accountBalance)
        : 0;

    const nextBalanceCents = Math.max(0, Math.round(currentBalance * 100)) + Math.round(amount * 100);
    const nextBalance = Number((nextBalanceCents / 100).toFixed(2));

    await this.customerAccountRepository.updateById(id, {
      accountBalance: nextBalance,
      updatedAt: new Date(),
    } as any);

    const updated = await this.customerAccountRepository.findById(id);
    const json = updated.toJSON() as any;
    delete json.password;
    return json;
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

  @get('/admin/publishers/{id}/games', {
    responses: {
      '200': {
        description: 'List all games for a publisher (admin only)',
      },
    },
  })
  @authenticate('jwt')
  async listPublisherGames(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ) {
    if (currentUser.accountType !== 'admin') {
      throw new HttpErrors.Forbidden('Admin access required');
    }

    return this.gameRepository.find({
      where: {publisherId: id},
      order: ['updatedAt DESC'],
    });
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

  @patch('/admin/orders/{id}', {
    responses: {
      '200': {
        description: 'Update order payment status',
      },
    },
  })
  @authenticate('jwt')
  async updateOrderStatus(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['paymentStatus'],
            properties: {
              paymentStatus: {
                type: 'string',
                enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
              },
            },
          },
        },
      },
    })
    body: {paymentStatus: string},
  ): Promise<any> {
    AdminManagementController.ensureAdmin(currentUser);

    const paymentStatus = String(body?.paymentStatus ?? '').trim();
    const allowed = new Set(['Pending', 'Completed', 'Failed', 'Refunded']);
    if (!allowed.has(paymentStatus)) {
      throw new HttpErrors.UnprocessableEntity('Invalid paymentStatus');
    }

    const existing = await this.orderRepository.findById(id);
    if (String(existing.paymentStatus) === 'Refunded' && paymentStatus !== 'Refunded') {
      throw new HttpErrors.UnprocessableEntity('Refunded orders cannot change status');
    }

    if (paymentStatus === 'Refunded') {
      const adminId = (currentUser as any)?.id || (currentUser as any)?.[securityId];
      await this.refundOrderIfNeeded(id, String(adminId || ''));
    } else {
      await this.orderRepository.updateById(id, {
        paymentStatus,
        updatedAt: new Date(),
      });
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

  @get('/admin/refund-requests', {
    responses: {
      '200': {
        description: 'List refund requests',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  @authenticate('jwt')
  async listRefundRequests(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.query.string('status') status?: string,
  ): Promise<any[]> {
    AdminManagementController.ensureAdmin(currentUser);

    const where: any = {};
    if (status) where.status = String(status).trim();

    return this.refundRequestRepository.find({
      where: Object.keys(where).length ? where : undefined,
      include: [{relation: 'order'}, {relation: 'customer'}],
      order: ['requestedAt DESC'],
    });
  }

  @post('/admin/refund-requests/{id}/approve', {
    responses: {
      '200': {description: 'Approve a refund request', content: {'application/json': {schema: {type: 'object'}}}},
    },
  })
  @authenticate('jwt')
  async approveRefundRequest(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              note: {type: 'string', maxLength: 500},
            },
          },
        },
      },
    })
    body: {note?: string},
  ): Promise<any> {
    AdminManagementController.ensureAdmin(currentUser);
    const adminId = (currentUser as any)?.id || (currentUser as any)?.[securityId];

    const req = await this.refundRequestRepository.findById(id);
    if (String(req.status) !== 'Pending') {
      throw new HttpErrors.Conflict('Refund request is not pending');
    }

    await this.refundOrderIfNeeded(req.orderId, String(adminId || ''));

    await this.refundRequestRepository.updateById(id, {
      status: 'Approved',
      resolvedAt: new Date(),
      processedByAdminId: String(adminId || ''),
      resolutionNote: body?.note ? String(body.note).trim().slice(0, 500) : undefined,
    } as any);

    return this.refundRequestRepository.findById(id, {
      include: [{relation: 'order'}, {relation: 'customer'}],
    });
  }

  @post('/admin/refund-requests/{id}/reject', {
    responses: {
      '200': {description: 'Reject a refund request', content: {'application/json': {schema: {type: 'object'}}}},
    },
  })
  @authenticate('jwt')
  async rejectRefundRequest(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              note: {type: 'string', maxLength: 500},
            },
            required: ['note'],
          },
        },
      },
    })
    body: {note: string},
  ): Promise<any> {
    AdminManagementController.ensureAdmin(currentUser);
    const adminId = (currentUser as any)?.id || (currentUser as any)?.[securityId];

    const req = await this.refundRequestRepository.findById(id);
    if (String(req.status) !== 'Pending') {
      throw new HttpErrors.Conflict('Refund request is not pending');
    }

    await this.refundRequestRepository.updateById(id, {
      status: 'Rejected',
      resolvedAt: new Date(),
      processedByAdminId: String(adminId || ''),
      resolutionNote: String(body.note).trim().slice(0, 500),
    } as any);

    return this.refundRequestRepository.findById(id, {
      include: [{relation: 'order'}, {relation: 'customer'}],
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

  @patch('/admin/reviews/{id}', {
    responses: {
      '200': {
        description: 'Review updated',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  @authenticate('jwt')
  async updateReview(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              rating: {type: 'number', minimum: 1, maximum: 5},
              reviewText: {type: 'string', minLength: 1, maxLength: 2000},
            },
          },
        },
      },
    })
    body: {rating?: number; reviewText?: string},
  ): Promise<any> {
    AdminManagementController.ensureAdmin(currentUser);

    const patch: any = {updatedAt: new Date()};

    if (body?.rating !== undefined) {
      const raw = Number(body.rating);
      const rating = Number.isFinite(raw) ? Math.floor(raw) : NaN;
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        throw new HttpErrors.UnprocessableEntity('rating must be 1-5');
      }
      patch.rating = rating;
    }

    if (body?.reviewText !== undefined) {
      const text = String(body.reviewText ?? '').trim();
      if (!text) throw new HttpErrors.UnprocessableEntity('reviewText is required');
      if (text.length > 2000) throw new HttpErrors.UnprocessableEntity('reviewText is too long');
      patch.reviewText = text;
    }

    await this.reviewRepository.updateById(id, patch);
    return this.reviewRepository.findById(id, {
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
