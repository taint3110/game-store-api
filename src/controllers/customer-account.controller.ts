import { inject } from '@loopback/core';
import { repository } from '@loopback/repository';
import { get, patch, post, del, param, requestBody, HttpErrors } from '@loopback/rest';
import { authenticate } from '@loopback/authentication';
import { SecurityBindings, UserProfile, securityId } from '@loopback/security';
import { CustomerAccount } from '../models';
import {
    CustomerAccountRepository,
    OrderRepository,
    GameRepository,
    GameKeyRepository,
    OrderDetailRepository,
} from '../repositories';
import { PasswordService } from '../services';

export class CustomerAccountController {
    constructor(
        @repository(CustomerAccountRepository)
        public customerAccountRepository: CustomerAccountRepository,
        @repository(OrderRepository)
        public orderRepository: OrderRepository,
        @repository(GameRepository)
        public gameRepository: GameRepository,
        @repository(GameKeyRepository)
        public gameKeyRepository: GameKeyRepository,
        @repository(OrderDetailRepository)
        public orderDetailRepository: OrderDetailRepository,
        @inject('services.PasswordService')
        public passwordService: PasswordService,
    ) {}

    @get('/customers/me', {
        responses: {
            '200': {
                description: 'Customer profile',
                content: { 'application/json': { schema: { 'x-ts-type': CustomerAccount } } },
            },
        },
    })
    @authenticate('jwt')
    async getProfile(
        @inject(SecurityBindings.USER) currentUser: UserProfile,
    ): Promise<Omit<CustomerAccount, 'password'>> {
        const customerId = currentUser[securityId];
        const customer = await this.customerAccountRepository.findById(customerId, {
            include: [{ relation: 'gender' }],
        });

        const customerJson = customer.toJSON() as any;
        delete customerJson.password;
        return customerJson;
    }

    @patch('/customers/me', {
        responses: {
            '200': {
                description: 'Customer profile updated',
                content: { 'application/json': { schema: { 'x-ts-type': CustomerAccount } } },
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
                            username: { type: 'string', minLength: 3, maxLength: 50 },
                            phoneNumber: { type: 'string', pattern: '^(0|\\+84)[0-9]{9,10}$' },
                            bankType: { type: 'string' },
                            bankName: { type: 'string' },
                            description: { type: 'string' },
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
            const existingPhone = await this.customerAccountRepository.findByPhoneNumber(updateData.phoneNumber);
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
                            currentPassword: { type: 'string' },
                            newPassword: { type: 'string', minLength: 8 },
                        },
                    },
                },
            },
        })
        passwordData: { currentPassword: string; newPassword: string },
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
                            items: { type: 'object' },
                        },
                    },
                },
            },
        },
    })
    @authenticate('jwt')
    async getOrderHistory(@inject(SecurityBindings.USER) currentUser: UserProfile): Promise<any[]> {
        const customerId = currentUser[securityId];

        const orders = await this.orderRepository.find({
            where: { customerId },
            order: ['orderDate DESC'],
        });

        // Fetch order details for each order
        const ordersWithDetails = await Promise.all(
            orders.map(async (order) => {
                const orderDetails = await this.orderDetailRepository.find({
                    where: { orderId: order.id },
                    include: [{ relation: 'game' }, { relation: 'gameKey' }],
                });
                return {
                    ...order,
                    orderDetails,
                };
            }),
        );

        return ordersWithDetails;
    }

    @post('/customers/me/orders', {
        responses: {
            '201': {
                description: 'Order created successfully',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean' },
                                message: { type: 'string' },
                                order: { type: 'object' },
                                transactionId: { type: 'string' },
                            },
                        },
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
                        required: ['games', 'paymentMethod'],
                        properties: {
                            games: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    required: ['gameId'],
                                    properties: {
                                        gameId: { type: 'string' },
                                    },
                                },
                                minItems: 1,
                            },
                            paymentMethod: {
                                type: 'string',
                                enum: ['Wallet', 'CreditCard', 'PayPal'],
                            },
                        },
                    },
                },
            },
        })
        orderData: {
            games: Array<{ gameId: string }>;
            paymentMethod: 'Wallet' | 'CreditCard' | 'PayPal';
        },
    ): Promise<any> {
        const customerId = currentUser[securityId];

        // Validate customer account
        const customer = await this.customerAccountRepository.findById(customerId);
        if (customer.accountStatus !== 'Active') {
            throw new HttpErrors.Forbidden('Account is not active');
        }

        // Validate games and check availability
        const gameDetails: Array<{
            game: any;
            price: number;
        }> = [];

        let totalValue = 0;

        for (const item of orderData.games) {
            // Check if game exists and is released
            const game = await this.gameRepository.findById(item.gameId);
            if (game.releaseStatus !== 'Released') {
                throw new HttpErrors.BadRequest(`Game "${game.name}" is not available for purchase`);
            }

            // Check if customer already owns this game
            const existingKey = await this.gameKeyRepository.findOne({
                where: {
                    gameId: item.gameId,
                    ownedByCustomerId: customerId,
                },
            });

            if (existingKey) {
                throw new HttpErrors.Conflict(`You already own the game "${game.name}"`);
            }

            // Calculate price (use discount price if available)
            const price = game.discountPrice || game.originalPrice;
            totalValue += price;

            gameDetails.push({
                game,
                price,
            });
        }

        // Validate payment method
        if (orderData.paymentMethod === 'Wallet') {
            if (customer.accountBalance < totalValue) {
                throw new HttpErrors.BadRequest(
                    `Insufficient balance. Required: ${totalValue}, Available: ${customer.accountBalance}`,
                );
            }
        }

        // Generate unique transaction ID
        const transactionId = `TXN-${Date.now()}-${customerId.substring(0, 8)}`;

        // Create order
        const order = await this.orderRepository.create({
            customerId,
            orderDate: new Date(),
            totalValue,
            paymentMethod: orderData.paymentMethod,
            transactionId,
            paymentStatus: 'Pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        try {
            // Process payment
            if (orderData.paymentMethod === 'Wallet') {
                // Deduct from wallet
                await this.customerAccountRepository.updateById(customerId, {
                    accountBalance: customer.accountBalance - totalValue,
                    updatedAt: new Date(),
                });
            }
            // For CreditCard and PayPal, integrate with payment gateway here

            // Create order details and generate game keys
            const orderDetails = [];
            for (const detail of gameDetails) {
                // Generate and create game key
                const gameKey = await this.gameKeyRepository.create({
                    gameId: detail.game.id ?? detail.game._id,
                    gameVersion: detail.game.version || '1.0.0',
                    businessStatus: 'Sold',
                    activationStatus: 'NotActivated',
                    ownedByCustomerId: customerId,
                    customerOwnershipDate: new Date(),
                    publishRegistrationDate: new Date(),
                });

                // Create order detail
                const orderDetail = await this.orderDetailRepository.create({
                    orderId: order.id!,
                    gameId: detail.game.id ?? detail.game._id,
                    gameKeyId: gameKey.id!,
                    value: detail.price,
                });

                orderDetails.push(orderDetail);
            }

            // Update order status to completed
            await this.orderRepository.updateById(order.id, {
                paymentStatus: 'Completed',
                updatedAt: new Date(),
            });

            // Fetch complete order
            const completeOrder = await this.orderRepository.findById(order.id);

            // Fetch order details with game info
            const completeOrderDetails = await this.orderDetailRepository.find({
                where: { orderId: order.id },
                include: [{ relation: 'game' }, { relation: 'gameKey' }],
            });

            return {
                success: true,
                message: 'Order completed successfully',
                order: {
                    ...completeOrder,
                    orderDetails: completeOrderDetails,
                },
                transactionId,
            };
        } catch (error: any) {
            // Rollback order if payment fails
            await this.orderRepository.updateById(order.id!, {
                paymentStatus: 'Failed',
                updatedAt: new Date(),
            });

            console.error('Order creation error:', error);
            throw new HttpErrors.InternalServerError(`Order failed: ${error.message || 'Unknown error'}`);
        }
    }

    @get('/customers/me/library', {
        responses: {
            '200': {
                description: 'Customer game library (owned games)',
                content: {
                    'application/json': {
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    gameKey: { type: 'object' },
                                    game: { type: 'object' },
                                },
                            },
                        },
                    },
                },
            },
        },
    })
    @authenticate('jwt')
    async getGameLibrary(@inject(SecurityBindings.USER) currentUser: UserProfile): Promise<any[]> {
        const customerId = currentUser[securityId];

        const gameKeys = await this.gameKeyRepository.find({
            where: {
                ownedByCustomerId: customerId,
                businessStatus: 'Sold',
            },
            include: [{ relation: 'game' }],
            order: ['customerOwnershipDate DESC'],
        });

        return gameKeys.map((key) => {
            const keyJson = key.toJSON() as any;
            return {
                gameKey: {
                    id: keyJson.id,
                    gameVersion: keyJson.gameVersion,
                    activationStatus: keyJson.activationStatus,
                    purchaseDate: keyJson.customerOwnershipDate,
                },
                game: keyJson.game,
            };
        });
    }

    @get('/customers/me/wishlist', {
        responses: {
            '200': {
                description: 'Customer wishlist with game details',
                content: {
                    'application/json': {
                        schema: {
                            type: 'array',
                            items: { type: 'object' },
                        },
                    },
                },
            },
        },
    })
    @authenticate('jwt')
    async getWishlist(@inject(SecurityBindings.USER) currentUser: UserProfile): Promise<any[]> {
        const customerId = currentUser[securityId];
        const customer = await this.customerAccountRepository.findById(customerId);

        if (!customer.wishlist || customer.wishlist.length === 0) {
            return [];
        }

        const games = await this.gameRepository.find({
            where: {
                id: { inq: customer.wishlist },
                releaseStatus: 'Released',
            },
            include: [{ relation: 'publisher' }],
        });

        return games;
    }

    @post('/customers/me/wishlist/{gameId}', {
        responses: {
            '200': {
                description: 'Game added to wishlist',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean' },
                                message: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
    })
    @authenticate('jwt')
    async addToWishlist(
        @inject(SecurityBindings.USER) currentUser: UserProfile,
        @param.path.string('gameId') gameId: string,
    ): Promise<{ success: boolean; message: string }> {
        const customerId = currentUser[securityId];

        // Verify game exists
        const game = await this.gameRepository.findById(gameId);
        if (!game) {
            throw new HttpErrors.NotFound('Game not found');
        }

        // Check if customer already owns this game
        const existingKey = await this.gameKeyRepository.findOne({
            where: {
                gameId: gameId,
                ownedByCustomerId: customerId,
            },
        });

        if (existingKey) {
            throw new HttpErrors.Conflict('You already own this game');
        }

        const customer = await this.customerAccountRepository.findById(customerId);
        const wishlist = customer.wishlist || [];

        if (wishlist.includes(gameId)) {
            throw new HttpErrors.Conflict('Game is already in your wishlist');
        }

        wishlist.push(gameId);

        await this.customerAccountRepository.updateById(customerId, {
            wishlist,
            updatedAt: new Date(),
        });

        return { success: true, message: `"${game.name}" added to wishlist` };
    }

    @del('/customers/me/wishlist/{gameId}', {
        responses: {
            '200': {
                description: 'Game removed from wishlist',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean' },
                                message: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
    })
    @authenticate('jwt')
    async removeFromWishlist(
        @inject(SecurityBindings.USER) currentUser: UserProfile,
        @param.path.string('gameId') gameId: string,
    ): Promise<{ success: boolean; message: string }> {
        const customerId = currentUser[securityId];
        const customer = await this.customerAccountRepository.findById(customerId);
        const wishlist = customer.wishlist || [];

        const index = wishlist.indexOf(gameId);
        if (index === -1) {
            throw new HttpErrors.NotFound('Game is not in your wishlist');
        }

        wishlist.splice(index, 1);

        await this.customerAccountRepository.updateById(customerId, {
            wishlist,
            updatedAt: new Date(),
        });

        return { success: true, message: 'Game removed from wishlist' };
    }
}
