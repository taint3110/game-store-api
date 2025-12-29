import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, patch, post, requestBody, HttpErrors} from '@loopback/rest';
import {authenticate} from '@loopback/authentication';
import {SecurityBindings, UserProfile, securityId} from '@loopback/security';
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
}
