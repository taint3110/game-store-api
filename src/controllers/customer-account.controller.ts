import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {del, get, param, patch, post, requestBody, HttpErrors} from '@loopback/rest';
import {authenticate} from '@loopback/authentication';
import {SecurityBindings, UserProfile, securityId} from '@loopback/security';
import {randomBytes} from 'crypto';
import {CustomerAccount} from '../models';
import {CustomerAccountRepository, OrderRepository} from '../repositories';
import {PasswordService} from '../services';

export class CustomerAccountController {
  constructor(
    @repository(CustomerAccountRepository)
    public customerAccountRepository: CustomerAccountRepository,
    @repository(OrderRepository)
    public orderRepository: OrderRepository,
    @inject('services.PasswordService')
    public passwordService: PasswordService,
  ) {}

  private static safeString(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private static clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(parsed)));
  }

  private static ensureCustomerAccount(currentUser: UserProfile) {
    const accountType = (currentUser as any)?.accountType;
    if (accountType && accountType !== 'customer') {
      throw new HttpErrors.Forbidden('Only customer accounts can perform this action');
    }
  }

  private static generateKeyCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(16);
    const chars = Array.from(bytes, b => alphabet[b % alphabet.length]);
    return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars
      .slice(8, 12)
      .join('')}-${chars.slice(12, 16).join('')}`;
  }

  private static generateTransactionId(): string {
    return `tx_${Date.now()}_${randomBytes(6).toString('hex')}`;
  }

  @get('/customers/me', {
    responses: {
      '200': {
        description: 'Customer profile',
        content: {'application/json': {schema: {'x-ts-type': CustomerAccount}}},
      },
    },
  })
  @authenticate('jwt')
  async getProfile(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<Omit<CustomerAccount, 'password'>> {
    const customerId = currentUser[securityId];
    const customer = await this.customerAccountRepository.findById(customerId, {
      include: [{relation: 'gender'}],
    });

    const customerJson = customer.toJSON() as any;
    delete customerJson.password;
    return customerJson;
  }

  @patch('/customers/me', {
    responses: {
      '200': {
        description: 'Customer profile updated',
        content: {'application/json': {schema: {'x-ts-type': CustomerAccount}}},
      },
    },
  })
  @authenticate('jwt')
  async updateProfile(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              username: {type: 'string', minLength: 3, maxLength: 50},
              phoneNumber: {type: 'string', pattern: '^(0|\\+84)[0-9]{9,10}$'},
              bankType: {type: 'string'},
              bankName: {type: 'string'},
              description: {type: 'string'},
            },
          },
        },
      },
    })
    updateData: Partial<CustomerAccount>,
  ): Promise<Omit<CustomerAccount, 'password'>> {
    const customerId = currentUser[securityId];

    // Check if phone number is being changed and already exists
    if (updateData.phoneNumber) {
      const existingPhone = await this.customerAccountRepository.findByPhoneNumber(
        updateData.phoneNumber,
      );
      if (existingPhone && existingPhone.id !== customerId) {
        throw new HttpErrors.Conflict('Phone number already exists');
      }
    }

    // Prevent updating restricted fields
    delete (updateData as any).email;
    delete (updateData as any).password;
    delete (updateData as any).accountStatus;
    delete (updateData as any).accountBalance;

    // Update the customer
    await this.customerAccountRepository.updateById(customerId, {
      ...updateData,
      updatedAt: new Date(),
    });

    const updatedCustomer = await this.customerAccountRepository.findById(customerId);
    const customerJson = updatedCustomer.toJSON() as any;
    delete customerJson.password;
    return customerJson;
  }

  @post('/customers/me/change-password', {
    responses: {
      '204': {
        description: 'Password changed successfully',
      },
    },
  })
  @authenticate('jwt')
  async changePassword(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['currentPassword', 'newPassword'],
            properties: {
              currentPassword: {type: 'string'},
              newPassword: {type: 'string', minLength: 8},
            },
          },
        },
      },
    })
    passwordData: {currentPassword: string; newPassword: string},
  ): Promise<void> {
    const customerId = currentUser[securityId];
    const customer = await this.customerAccountRepository.findById(customerId);

    // Verify current password
    const isPasswordValid = await this.passwordService.comparePassword(
      passwordData.currentPassword,
      customer.password,
    );

    if (!isPasswordValid) {
      throw new HttpErrors.Unauthorized('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await this.passwordService.hashPassword(passwordData.newPassword);

    // Update password
    await this.customerAccountRepository.updateById(customerId, {
      password: hashedPassword,
      updatedAt: new Date(),
    });
  }

  @get('/customers/me/wishlist', {
    responses: {
      '200': {
        description: 'Customer wishlist',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  @authenticate('jwt')
  async getWishlist(@inject(SecurityBindings.USER) currentUser: UserProfile): Promise<any[]> {
    CustomerAccountController.ensureCustomerAccount(currentUser);
    const customerId = currentUser[securityId];
    const customer = await this.customerAccountRepository.findById(customerId);
    const wishlist = Array.isArray((customer as any).wishlist) ? (customer as any).wishlist : [];
    return wishlist;
  }

  @post('/customers/me/wishlist', {
    responses: {
      '200': {
        description: 'Add an item to wishlist (returns updated wishlist)',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  @authenticate('jwt')
  async addWishlistItem(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['name', 'image'],
            properties: {
              id: {type: 'string'},
              steamAppId: {type: 'number', minimum: 0},
              slug: {type: 'string'},
              name: {type: 'string'},
              image: {type: 'string'},
              priceLabel: {type: 'string'},
              originalPriceLabel: {type: 'string'},
              unitPriceCents: {type: 'number', minimum: 0},
            },
          },
        },
      },
    })
    payload: any,
  ): Promise<any[]> {
    CustomerAccountController.ensureCustomerAccount(currentUser);
    const customerId = currentUser[securityId];

    const steamAppIdRaw =
      typeof payload?.steamAppId === 'number' && Number.isFinite(payload.steamAppId)
        ? Math.floor(payload.steamAppId)
        : undefined;
    const steamAppId =
      typeof steamAppIdRaw === 'number' && steamAppIdRaw >= 0 ? steamAppIdRaw : undefined;
    const slug = CustomerAccountController.safeString(payload?.slug) || undefined;
    const name =
      CustomerAccountController.safeString(payload?.name) ||
      (steamAppId ? `Steam #${steamAppId}` : slug ? `Item ${slug}` : 'Game');
    const image = CustomerAccountController.safeString(payload?.image);
    if (!image) throw new HttpErrors.BadRequest('Image is required');

    const idFromPayload = CustomerAccountController.safeString(payload?.id);
    const id =
      idFromPayload ||
      (typeof steamAppId === 'number'
        ? `steam:${steamAppId}`
        : slug
          ? `slug:${slug}`
          : `item:${name}`);

    const unitPriceCents = CustomerAccountController.clampInt(
      payload?.unitPriceCents,
      0,
      100_000_000,
      0,
    );

    const priceLabel = CustomerAccountController.safeString(payload?.priceLabel) || undefined;
    const originalPriceLabel =
      CustomerAccountController.safeString(payload?.originalPriceLabel) || undefined;

    const customer = await this.customerAccountRepository.findById(customerId);
    const current = Array.isArray((customer as any).wishlist) ? (customer as any).wishlist : [];

    const next = [
      {
        id,
        steamAppId,
        slug,
        name,
        image,
        priceLabel: priceLabel ?? null,
        originalPriceLabel: originalPriceLabel ?? null,
        unitPriceCents,
      },
      ...current.filter((entry: any) => CustomerAccountController.safeString(entry?.id) !== id),
    ].slice(0, 200);

    await this.customerAccountRepository.updateById(customerId, {
      wishlist: next,
      updatedAt: new Date(),
    } as any);

    return next;
  }

  @del('/customers/me/wishlist/{id}', {
    responses: {
      '200': {
        description: 'Remove an item from wishlist (returns updated wishlist)',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  @authenticate('jwt')
  async removeWishlistItem(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<any[]> {
    CustomerAccountController.ensureCustomerAccount(currentUser);
    const customerId = currentUser[securityId];
    const safeId = CustomerAccountController.safeString(id);
    if (!safeId) throw new HttpErrors.BadRequest('id is required');

    const customer = await this.customerAccountRepository.findById(customerId);
    const current = Array.isArray((customer as any).wishlist) ? (customer as any).wishlist : [];
    const next = current.filter(
      (entry: any) => CustomerAccountController.safeString(entry?.id) !== safeId,
    );

    await this.customerAccountRepository.updateById(customerId, {
      wishlist: next,
      updatedAt: new Date(),
    } as any);

    return next;
  }

  @del('/customers/me/wishlist', {
    responses: {
      '200': {
        description: 'Clear wishlist (returns updated wishlist)',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  @authenticate('jwt')
  async clearWishlist(@inject(SecurityBindings.USER) currentUser: UserProfile): Promise<any[]> {
    CustomerAccountController.ensureCustomerAccount(currentUser);
    const customerId = currentUser[securityId];
    const next: any[] = [];

    await this.customerAccountRepository.updateById(customerId, {
      wishlist: next,
      updatedAt: new Date(),
    } as any);

    return next;
  }

  @get('/customers/me/cart', {
    responses: {
      '200': {
        description: 'Customer cart',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  @authenticate('jwt')
  async getCart(@inject(SecurityBindings.USER) currentUser: UserProfile): Promise<any[]> {
    CustomerAccountController.ensureCustomerAccount(currentUser);
    const customerId = currentUser[securityId];
    const customer = await this.customerAccountRepository.findById(customerId);
    const cart = Array.isArray((customer as any).cart) ? (customer as any).cart : [];
    return cart;
  }

  @post('/customers/me/cart', {
    responses: {
      '200': {
        description: 'Add/update cart item (returns updated cart)',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  @authenticate('jwt')
  async upsertCartItem(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['item', 'quantity'],
            properties: {
              quantity: {type: 'number', minimum: 1},
              item: {
                type: 'object',
                required: ['name', 'image'],
                properties: {
                  id: {type: 'string'},
                  steamAppId: {type: 'number', minimum: 0},
                  slug: {type: 'string'},
                  name: {type: 'string'},
                  image: {type: 'string'},
                  priceLabel: {type: 'string'},
                  originalPriceLabel: {type: 'string'},
                  unitPriceCents: {type: 'number', minimum: 0},
                },
              },
            },
          },
        },
      },
    })
    payload: any,
  ): Promise<any[]> {
    CustomerAccountController.ensureCustomerAccount(currentUser);
    const customerId = currentUser[securityId];

    const quantity = CustomerAccountController.clampInt(payload?.quantity, 1, 99, 1);
    const rawItem = payload?.item ?? {};

    const steamAppIdRaw =
      typeof rawItem?.steamAppId === 'number' && Number.isFinite(rawItem.steamAppId)
        ? Math.floor(rawItem.steamAppId)
        : undefined;
    const steamAppId =
      typeof steamAppIdRaw === 'number' && steamAppIdRaw >= 0 ? steamAppIdRaw : undefined;
    const slug = CustomerAccountController.safeString(rawItem?.slug) || undefined;
    const name =
      CustomerAccountController.safeString(rawItem?.name) ||
      (steamAppId ? `Steam #${steamAppId}` : slug ? `Item ${slug}` : 'Game');
    const image = CustomerAccountController.safeString(rawItem?.image);
    if (!image) throw new HttpErrors.BadRequest('Image is required');

    const idFromPayload = CustomerAccountController.safeString(rawItem?.id);
    const id =
      idFromPayload ||
      (typeof steamAppId === 'number'
        ? `steam:${steamAppId}`
        : slug
          ? `slug:${slug}`
          : `item:${name}`);

    const unitPriceCents = CustomerAccountController.clampInt(
      rawItem?.unitPriceCents,
      0,
      100_000_000,
      0,
    );

    const priceLabel = CustomerAccountController.safeString(rawItem?.priceLabel) || undefined;
    const originalPriceLabel =
      CustomerAccountController.safeString(rawItem?.originalPriceLabel) || undefined;

    const customer = await this.customerAccountRepository.findById(customerId);
    const current = Array.isArray((customer as any).cart) ? (customer as any).cart : [];

    const next = [
      {
        id,
        steamAppId,
        slug,
        name,
        image,
        priceLabel: priceLabel ?? null,
        originalPriceLabel: originalPriceLabel ?? null,
        unitPriceCents,
        quantity,
      },
      ...current.filter((entry: any) => CustomerAccountController.safeString(entry?.id) !== id),
    ].slice(0, 300);

    await this.customerAccountRepository.updateById(customerId, {
      cart: next,
      updatedAt: new Date(),
    } as any);

    return next;
  }

  @patch('/customers/me/cart/{id}', {
    responses: {
      '200': {
        description: 'Update cart quantity (returns updated cart)',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  @authenticate('jwt')
  async updateCartItem(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['quantity'],
            properties: {
              quantity: {type: 'number', minimum: 0},
            },
          },
        },
      },
    })
    body: {quantity: number},
  ): Promise<any[]> {
    CustomerAccountController.ensureCustomerAccount(currentUser);
    const customerId = currentUser[securityId];
    const safeId = CustomerAccountController.safeString(id);
    if (!safeId) throw new HttpErrors.BadRequest('id is required');

    const quantity = CustomerAccountController.clampInt(body?.quantity, 0, 99, 0);

    const customer = await this.customerAccountRepository.findById(customerId);
    const current = Array.isArray((customer as any).cart) ? (customer as any).cart : [];

    const filtered = current.filter(
      (entry: any) => CustomerAccountController.safeString(entry?.id) !== safeId,
    );

    const next =
      quantity <= 0
        ? filtered
        : filtered.concat(
            current
              .filter((entry: any) => CustomerAccountController.safeString(entry?.id) === safeId)
              .map((entry: any) => ({...entry, quantity: quantity})),
          );

    await this.customerAccountRepository.updateById(customerId, {
      cart: next,
      updatedAt: new Date(),
    } as any);

    return next;
  }

  @del('/customers/me/cart/{id}', {
    responses: {
      '200': {
        description: 'Remove cart item (returns updated cart)',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  @authenticate('jwt')
  async removeCartItem(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<any[]> {
    CustomerAccountController.ensureCustomerAccount(currentUser);
    const customerId = currentUser[securityId];
    const safeId = CustomerAccountController.safeString(id);
    if (!safeId) throw new HttpErrors.BadRequest('id is required');

    const customer = await this.customerAccountRepository.findById(customerId);
    const current = Array.isArray((customer as any).cart) ? (customer as any).cart : [];
    const next = current.filter(
      (entry: any) => CustomerAccountController.safeString(entry?.id) !== safeId,
    );

    await this.customerAccountRepository.updateById(customerId, {
      cart: next,
      updatedAt: new Date(),
    } as any);

    return next;
  }

  @del('/customers/me/cart', {
    responses: {
      '200': {
        description: 'Clear cart (returns updated cart)',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  @authenticate('jwt')
  async clearCart(@inject(SecurityBindings.USER) currentUser: UserProfile): Promise<any[]> {
    CustomerAccountController.ensureCustomerAccount(currentUser);
    const customerId = currentUser[securityId];
    const next: any[] = [];

    await this.customerAccountRepository.updateById(customerId, {
      cart: next,
      updatedAt: new Date(),
    } as any);

    return next;
  }

  @get('/customers/me/orders', {
    responses: {
      '200': {
        description: 'Customer order history',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {type: 'object'},
            },
          },
        },
      },
    },
  })
  @authenticate('jwt')
  async getOrderHistory(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<any[]> {
    const customerId = currentUser[securityId];
    
    const orders = await this.orderRepository.find({
      where: {customerId},
      include: [
        {
          relation: 'orderDetails',
          scope: {
            include: [
              {relation: 'game'},
              {relation: 'gameKey'},
            ],
          },
        },
      ],
      order: ['orderDate DESC'],
    });

    return orders;
  }

  @post('/customers/me/orders', {
    responses: {
      '201': {
        description: 'Create customer order',
        content: {
          'application/json': {
            schema: {type: 'object'},
          },
        },
      },
    },
  })
  @authenticate('jwt')
  async createOrder(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['items', 'paymentMethod'],
            properties: {
              paymentMethod: {
                type: 'string',
                enum: ['Wallet', 'CreditCard', 'PayPal'],
              },
              items: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  required: ['quantity', 'unitPriceCents', 'name'],
                  properties: {
                    steamAppId: {type: 'number', minimum: 0},
                    slug: {type: 'string'},
                    name: {type: 'string'},
                    quantity: {type: 'number', minimum: 1, maximum: 99},
                    unitPriceCents: {type: 'number', minimum: 0},
                    image: {type: 'string'},
                  },
                },
              },
            },
          },
        },
      },
    })
    payload: {
      paymentMethod: 'Wallet' | 'CreditCard' | 'PayPal';
      items: Array<{
        steamAppId?: number;
        slug?: string;
        name: string;
        quantity: number;
        unitPriceCents: number;
        image?: string;
      }>;
    },
  ): Promise<any> {
    const customerId = currentUser[securityId];
    const accountType = (currentUser as any)?.accountType;
    if (accountType && accountType !== 'customer') {
      throw new HttpErrors.Forbidden('Only customer accounts can create orders');
    }

    const paymentMethod = payload.paymentMethod;
    const itemsInput = Array.isArray(payload.items) ? payload.items : [];
    if (itemsInput.length === 0) {
      throw new HttpErrors.BadRequest('Items are required');
    }

    let totalCents = 0;
    const items = itemsInput.map(item => {
      const steamAppIdRaw =
        typeof item.steamAppId === 'number' && Number.isFinite(item.steamAppId)
          ? Math.floor(item.steamAppId)
          : undefined;
      const steamAppId =
        typeof steamAppIdRaw === 'number' && steamAppIdRaw >= 0 ? steamAppIdRaw : undefined;
      const slug = CustomerAccountController.safeString(item.slug) || undefined;
      const quantity = CustomerAccountController.clampInt(item.quantity, 1, 99, 1);
      const unitPriceCents = CustomerAccountController.clampInt(
        item.unitPriceCents,
        0,
        100_000_000,
        0,
      );
      const name =
        CustomerAccountController.safeString(item.name) ||
        (steamAppId ? `Steam #${steamAppId}` : slug ? `Item ${slug}` : 'Game');
      const image = CustomerAccountController.safeString(item.image) || undefined;

      const keyCodes = Array.from({length: quantity}, () =>
        CustomerAccountController.generateKeyCode(),
      );

      totalCents += unitPriceCents * quantity;

      return {steamAppId, slug, name, quantity, unitPriceCents, image, keyCodes};
    });

    const order = await this.orderRepository.create({
      customerId,
      orderDate: new Date(),
      totalValue: totalCents / 100,
      paymentMethod,
      transactionId: CustomerAccountController.generateTransactionId(),
      paymentStatus: 'Completed',
      items,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    return order;
  }
}
