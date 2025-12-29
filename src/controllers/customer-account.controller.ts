import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, patch, post, requestBody, HttpErrors} from '@loopback/rest';
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
