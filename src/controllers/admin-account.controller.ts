import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {get, patch, post, del, param, requestBody, HttpErrors} from '@loopback/rest';
import {authenticate} from '@loopback/authentication';
import {SecurityBindings, UserProfile, securityId} from '@loopback/security';
import {AdminAccount} from '../models';
import {AdminAccountRepository, CustomerAccountRepository, PublisherAccountRepository} from '../repositories';
import {PasswordService} from '../services';

export class AdminAccountController {
  constructor(
    @repository(AdminAccountRepository)
    public adminAccountRepository: AdminAccountRepository,
    @repository(CustomerAccountRepository)
    public customerAccountRepository: CustomerAccountRepository,
    @repository(PublisherAccountRepository)
    public publisherAccountRepository: PublisherAccountRepository,
    @inject('services.PasswordService')
    public passwordService: PasswordService,
  ) {}

  @get('/admins/me', {
    responses: {
      '200': {
        description: 'Admin profile',
        content: {'application/json': {schema: {'x-ts-type': AdminAccount}}},
      },
    },
  })
  @authenticate('jwt')
  async getProfile(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<Omit<AdminAccount, 'password'>> {
    const adminId = currentUser[securityId];
    const admin = await this.adminAccountRepository.findById(adminId, {
      include: [{relation: 'gender'}],
    });

    const adminJson = admin.toJSON() as any;
    delete adminJson.password;
    return adminJson;
  }

  @patch('/admins/me', {
    responses: {
      '200': {
        description: 'Admin profile updated',
        content: {'application/json': {schema: {'x-ts-type': AdminAccount}}},
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
              phoneNumber: {type: 'string'},
              genderId: {type: 'string'},
            },
          },
        },
      },
    })
    updateData: Partial<AdminAccount>,
  ): Promise<Omit<AdminAccount, 'password'>> {
    const adminId = currentUser[securityId];

    // Prevent updating restricted fields
    delete (updateData as any).email;
    delete (updateData as any).password;
    delete (updateData as any).role;

    await this.adminAccountRepository.updateById(adminId, {
      ...updateData,
      updatedAt: new Date(),
    });

    const updatedAdmin = await this.adminAccountRepository.findById(adminId);
    const adminJson = updatedAdmin.toJSON() as any;
    delete adminJson.password;
    return adminJson;
  }

  @post('/admins/me/change-password', {
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
    const adminId = currentUser[securityId];
    const admin = await this.adminAccountRepository.findById(adminId);

    const isPasswordValid = await this.passwordService.comparePassword(
      passwordData.currentPassword,
      admin.password,
    );

    if (!isPasswordValid) {
      throw new HttpErrors.Unauthorized('Current password is incorrect');
    }

    const hashedPassword = await this.passwordService.hashPassword(passwordData.newPassword);

    await this.adminAccountRepository.updateById(adminId, {
      password: hashedPassword,
      updatedAt: new Date(),
    });
  }

  @post('/admins', {
    responses: {
      '201': {
        description: 'Admin account created',
        content: {'application/json': {schema: {'x-ts-type': AdminAccount}}},
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
            required: ['email', 'phoneNumber', 'role', 'password'],
            properties: {
              email: {type: 'string', format: 'email'},
              phoneNumber: {type: 'string'},
              role: {type: 'string', enum: ['SuperAdmin', 'Admin', 'Moderator']},
              password: {type: 'string', minLength: 8},
              genderId: {type: 'string'},
            },
          },
        },
      },
    })
    adminData: Omit<AdminAccount, 'id'>,
  ): Promise<Omit<AdminAccount, 'password'>> {
    // Only SuperAdmin can create new admins
    if (currentUser.role !== 'SuperAdmin') {
      throw new HttpErrors.Forbidden('Only SuperAdmin can create admin accounts');
    }

    // Check for duplicate email
    const existingAdmin = await this.adminAccountRepository.findByEmail(adminData.email);
    const existingCustomer = await this.customerAccountRepository.findByEmail(adminData.email);
    const existingPublisher = await this.publisherAccountRepository.findByEmail(adminData.email);

    if (existingAdmin || existingCustomer || existingPublisher) {
      throw new HttpErrors.Conflict('Email already exists');
    }

    const hashedPassword = await this.passwordService.hashPassword(adminData.password);

    const admin = await this.adminAccountRepository.create({
      ...adminData,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const adminJson = admin.toJSON() as any;
    delete adminJson.password;
    return adminJson;
  }

  @get('/admins', {
    responses: {
      '200': {
        description: 'List of admin accounts',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: {'x-ts-type': AdminAccount},
            },
          },
        },
      },
    },
  })
  @authenticate('jwt')
  async listAdmins(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<Omit<AdminAccount, 'password'>[]> {
    if (currentUser.role !== 'SuperAdmin' && currentUser.role !== 'Admin') {
      throw new HttpErrors.Forbidden('Insufficient permissions');
    }

    const admins = await this.adminAccountRepository.find({
      include: [{relation: 'gender'}],
    });

    return admins.map(admin => {
      const adminJson = admin.toJSON() as any;
      delete adminJson.password;
      return adminJson;
    });
  }

  @get('/admins/{id}', {
    responses: {
      '200': {
        description: 'Admin account details',
        content: {'application/json': {schema: {'x-ts-type': AdminAccount}}},
      },
    },
  })
  @authenticate('jwt')
  async getAdminById(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<Omit<AdminAccount, 'password'>> {
    if (currentUser.role !== 'SuperAdmin' && currentUser.role !== 'Admin') {
      throw new HttpErrors.Forbidden('Insufficient permissions');
    }

    const admin = await this.adminAccountRepository.findById(id, {
      include: [{relation: 'gender'}],
    });

    const adminJson = admin.toJSON() as any;
    delete adminJson.password;
    return adminJson;
  }

  @patch('/admins/{id}', {
    responses: {
      '200': {
        description: 'Admin account updated',
      },
    },
  })
  @authenticate('jwt')
  async updateAdmin(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              phoneNumber: {type: 'string'},
              role: {type: 'string', enum: ['SuperAdmin', 'Admin', 'Moderator']},
              genderId: {type: 'string'},
            },
          },
        },
      },
    })
    updateData: Partial<AdminAccount>,
  ): Promise<void> {
    if (currentUser.role !== 'SuperAdmin') {
      throw new HttpErrors.Forbidden('Only SuperAdmin can update admin accounts');
    }

    // Prevent updating restricted fields
    delete (updateData as any).email;
    delete (updateData as any).password;

    await this.adminAccountRepository.updateById(id, {
      ...updateData,
      updatedAt: new Date(),
    });
  }

  @del('/admins/{id}', {
    responses: {
      '204': {
        description: 'Admin account deleted',
      },
    },
  })
  @authenticate('jwt')
  async deleteAdmin(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<void> {
    if (currentUser.role !== 'SuperAdmin') {
      throw new HttpErrors.Forbidden('Only SuperAdmin can delete admin accounts');
    }

    // Prevent self-deletion
    if (currentUser[securityId] === id) {
      throw new HttpErrors.BadRequest('Cannot delete your own account');
    }

    await this.adminAccountRepository.deleteById(id);
  }
}
