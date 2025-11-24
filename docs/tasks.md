# Implementation Plan

- [ ] 1. Initialize LoopBack 4 project and configure MongoDB
  - Install LoopBack CLI globally and create new project named 'game-store-api'
  - Configure project with TypeScript, ESLint, Prettier, Mocha, and Docker support
  - Install required dependencies: MongoDB connector, authentication packages, bcrypt, validation libraries
  - Create MongoDB datasource configuration with connection to local MongoDB instance
  - Set up environment variables in .env file for database URL, JWT secret, and port settings
  - Verify MongoDB connectivity on application startup
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2. Create all data models with English naming
  - [ ] 2.1 Create CustomerAccount model
    - Define model with properties: id, email, phoneNumber, username, password, genderId, registrationDate, accountStatus, accountBalance, bankType, bankName, description, createdAt, updatedAt
    - Add validation decorators for email format, phone format, username length, password length
    - Mark password field as hidden from API responses
    - Set default values for accountStatus (Active), accountBalance (0), registrationDate (current date)
    - _Requirements: 2.1, 2.11, 2.12_

  - [ ] 2.2 Create PublisherAccount model
    - Define model with properties: id, publisherName, email, phoneNumber, socialMedia, bankType, bankName, contractDate, contractDuration, activityStatus, password, createdAt, updatedAt
    - Add validation decorators and mark password as hidden
    - Set default activityStatus to Active
    - _Requirements: 2.2, 2.11, 2.12_

  - [ ] 2.3 Create AdminAccount model
    - Define model with properties: id, email, genderId, phoneNumber, role, password, createdAt, updatedAt
    - Add validation decorators and mark password as hidden
    - _Requirements: 2.3, 2.11, 2.12_

  - [ ] 2.4 Create Game model
    - Define model with properties: id, name, genre, description, imageUrl, videoUrl, releaseDate, publisherId, releaseStatus, version, originalPrice, discountPrice, createdAt, updatedAt
    - Add validation for required fields and price constraints (minimum 0)
    - Set default releaseStatus to Released
    - _Requirements: 2.4, 2.11, 2.12_

  - [ ] 2.5 Create GameKey model
    - Define model with properties: id, gameId, gameVersion, ownedByCustomerId, publishRegistrationDate, customerOwnershipDate, businessStatus, activationStatus, createdAt, updatedAt
    - Set default businessStatus to Available and activationStatus to NotActivated
    - _Requirements: 2.5, 2.11, 2.12_

  - [ ] 2.6 Create Order model
    - Define model with properties: id, customerId, orderDate, totalValue, paymentMethod, transactionId, paymentStatus, createdAt, updatedAt
    - Add validation for totalValue (minimum 0)
    - Set default paymentStatus to Pending
    - _Requirements: 2.6, 2.11, 2.12_

  - [ ] 2.7 Create OrderDetail model
    - Define model with properties: id, orderId, gameId, gameKeyId, value, createdAt, updatedAt
    - Add validation for required fields
    - _Requirements: 2.7, 2.11, 2.12_

  - [ ] 2.8 Create Review model
    - Define model with properties: id, customerId, gameId, reviewText, rating, createdAt, updatedAt
    - Add validation for rating (1-5 range)
    - _Requirements: 2.8, 2.11, 2.12_

  - [ ] 2.9 Create Promotion model
    - Define model with properties: id, promotionName, discountType, applicableScope, applicationCondition, startDate, expirationDate, endDate, quantityIssued, status, publisherId, createdAt, updatedAt
    - Add validation for date constraints (expirationDate after startDate)
    - _Requirements: 2.9, 2.11, 2.12_

  - [ ] 2.10 Create Gender model
    - Define model with properties: id, name
    - _Requirements: 2.10_

- [ ] 3. Define model relationships using LoopBack decorators
  - [ ] 3.1 Configure CustomerAccount relationships
    - Add belongsTo relationship to Gender
    - Add hasMany relationship to Order
    - Add hasMany relationship to Review
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 3.2 Configure Game relationships
    - Add belongsTo relationship to PublisherAccount
    - Add hasMany relationship to GameKey
    - Add hasMany relationship to Review
    - _Requirements: 3.4, 3.5, 3.6_

  - [ ] 3.3 Configure Order relationships
    - Add belongsTo relationship to CustomerAccount
    - Add hasMany relationship to OrderDetail
    - _Requirements: 3.7, 3.8_

  - [ ] 3.4 Configure other model relationships
    - Add belongsTo relationship from GameKey to Game
    - Add belongsTo relationship from Promotion to PublisherAccount
    - Add belongsTo relationship from AdminAccount to Gender
    - _Requirements: 3.9, 3.10_

- [ ] 4. Create repositories for all models
  - [ ] 4.1 Create CustomerAccountRepository
    - Extend DefaultCrudRepository with MongoDB datasource
    - Configure relation accessors for gender, orders, and reviews
    - Implement findByEmail method
    - Implement findByPhoneNumber method
    - Implement findByCredentials method (email or phone)
    - _Requirements: 4.1, 4.2_

  - [ ] 4.2 Create GameRepository
    - Extend DefaultCrudRepository with MongoDB datasource
    - Configure relation accessors for publisher, gameKeys, and reviews
    - Implement findByPublisher method
    - Implement findByGenre method
    - Implement searchByName method (case-insensitive)
    - Implement findAvailableGames method (releaseStatus = Released)
    - _Requirements: 4.1, 4.3_

  - [ ] 4.3 Create OrderRepository
    - Extend DefaultCrudRepository with MongoDB datasource
    - Configure relation accessors for customer and orderDetails
    - Implement findByCustomer method
    - Implement findPendingOrders method
    - _Requirements: 4.1, 4.4_

  - [ ] 4.4 Create GameKeyRepository
    - Extend DefaultCrudRepository with MongoDB datasource
    - Implement findAvailableKeys method
    - Implement assignKeyToCustomer method
    - Implement countAvailableKeys method
    - _Requirements: 4.1_

  - [ ] 4.5 Create remaining repositories
    - Create PublisherAccountRepository with MongoDB datasource
    - Create AdminAccountRepository with MongoDB datasource
    - Create OrderDetailRepository with MongoDB datasource
    - Create ReviewRepository with MongoDB datasource (implement findByGame, findByCustomer, calculateAverageRating)
    - Create PromotionRepository with MongoDB datasource
    - Create GenderRepository with MongoDB datasource
    - _Requirements: 4.5_

- [ ] 5. Implement authentication services
  - [ ] 5.1 Create PasswordService
    - Implement hashPassword method using bcrypt with 10 salt rounds
    - Implement comparePassword method for verification
    - _Requirements: 5.1, 5.4_

  - [ ] 5.2 Create AuthService
    - Implement verifyCustomerCredentials method
    - Implement verifyPublisherCredentials method
    - Implement verifyAdminCredentials method
    - Implement generateToken method for JWT creation with 7-day expiration
    - Ensure password fields are never exposed in responses
    - Check accountStatus is Active before allowing login
    - _Requirements: 5.2, 5.3, 5.5, 5.6, 5.7, 5.8_

  - [ ] 5.3 Configure JWT authentication strategy
    - Install and configure @loopback/authentication-jwt
    - Set up JWT secret from environment variables
    - Configure token expiration to 7 days
    - Create authentication interceptor for protected endpoints
    - _Requirements: 5.3, 5.6, 5.7_

- [ ] 6. Implement AuthController for registration and login
  - [ ] 6.1 Create customer registration endpoint
    - POST /auth/customer/register
    - Validate email format, phone format (Vietnamese pattern), username length (3-50), password length (min 8)
    - Check for duplicate email and phone number, return 409 Conflict if exists
    - Hash password before storing
    - Set accountStatus to Active and accountBalance to 0
    - Return 201 Created with account details (excluding password)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ] 6.2 Create customer login endpoint
    - POST /auth/customer/login
    - Accept email or phone number as username identifier
    - Verify credentials using AuthService
    - Return 401 Unauthorized if credentials invalid or account not Active
    - Return 200 OK with JWT token and user profile on success
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 5.2, 5.3, 5.4, 5.5_

  - [ ] 6.3 Create publisher registration endpoint
    - POST /auth/publisher/register
    - Validate required fields: publisherName, email, phoneNumber, contractDate, contractDuration
    - Check for duplicate email across all account types, return 409 Conflict if exists
    - Hash password before storing
    - Set activityStatus to Active
    - Return 201 Created with publisher account details
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ] 6.4 Create publisher and admin login endpoints
    - POST /auth/publisher/login
    - POST /auth/admin/login
    - Both endpoints verify credentials and return JWT token with user profile
    - _Requirements: 7.4_

- [ ] 7. Implement CustomerAccountController
  - [ ] 7.1 Create get profile endpoint
    - GET /customers/me (authenticated)
    - Return customer account information excluding password
    - Include related Gender information if requested
    - Return 401 Unauthorized if not authenticated
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 7.2 Create update profile endpoint
    - PATCH /customers/me (authenticated)
    - Allow updating: username, phoneNumber, bankType, bankName, description
    - Validate all input fields according to model constraints
    - Check for duplicate phone number, return 409 Conflict if exists
    - Prevent updating: email, password, accountStatus, accountBalance
    - Update updatedAt timestamp
    - Return 200 OK with updated profile
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 7.3 Create change password endpoint
    - POST /customers/me/change-password (authenticated)
    - Verify current password matches stored password
    - Return 401 Unauthorized if current password incorrect
    - Validate new password is minimum 8 characters
    - Hash new password with bcrypt before storing
    - Return 204 No Content on success
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 7.4 Create get order history endpoint
    - GET /customers/me/orders (authenticated)
    - Return only orders belonging to authenticated customer
    - Include OrderDetail records with game information
    - Include assigned GameKey information for each order item
    - Support pagination with configurable page size
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [ ] 8. Implement GameController
  - [ ] 8.1 Create browse games endpoint
    - GET /games (public)
    - Return games with releaseStatus of Released
    - Support search by name (case-insensitive partial match)
    - Support filter by genre
    - Support filter by publisherId
    - Support pagination with configurable page size and page number
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ] 8.2 Create get game details endpoint
    - GET /games/{id} (public)
    - Return game details including publisher information and average rating
    - _Requirements: 13.6_

  - [ ] 8.3 Create game management endpoints for publishers
    - POST /games (authenticated publisher)
    - Validate required fields: name, genre, description, releaseDate, version, originalPrice
    - Set publisherId to authenticated publisher's id
    - Set releaseStatus to Released by default
    - Return 201 Created with game details
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ] 8.4 Create update and delete game endpoints
    - PATCH /games/{id} (authenticated publisher)
    - Allow modification of all game fields except id and publisherId
    - Return 403 Forbidden if publisher doesn't own the game
    - DELETE /games/{id} (authenticated publisher)
    - Set releaseStatus to Delisted instead of removing from database
    - _Requirements: 12.5, 12.6, 12.7_

  - [ ] 8.5 Create get game reviews endpoint
    - GET /games/{id}/reviews (public)
    - Return all reviews for the game with customer information
    - Calculate and include average rating
    - Support pagination with configurable page size
    - Exclude customer password and sensitive information
    - Support sorting by date or rating
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

- [ ] 9. Implement GameKeyController
  - [ ] 9.1 Create game key generation endpoint
    - POST /game-keys (authenticated publisher)
    - Validate that gameId belongs to a game owned by the publisher
    - Set businessStatus to Available and activationStatus to NotActivated
    - Set publishRegistrationDate to current timestamp
    - Return 201 Created with created keys count
    - _Requirements: 14.1, 14.2, 14.3_

  - [ ] 9.2 Create get game keys endpoint
    - GET /game-keys (authenticated publisher)
    - Filter to show only keys for games owned by the publisher
    - Support filtering by gameId and businessStatus
    - _Requirements: 14.4_

  - [ ] 9.3 Create get available key count endpoint
    - GET /game-keys/available/{gameId} (public)
    - Return count of keys with businessStatus Available
    - _Requirements: 14.5_

- [ ] 10. Implement OrderService for order processing
  - [ ] 10.1 Create order creation logic
    - Validate all requested games have available keys
    - Calculate totalValue based on current game prices (discountPrice if available, otherwise originalPrice)
    - Set paymentStatus to Pending
    - Generate unique transactionId
    - Create OrderDetail records for each game
    - Assign available GameKey to each order detail and update key businessStatus to Sold
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [ ] 10.2 Create payment processing logic
    - Implement wallet payment: verify accountBalance is sufficient, deduct totalValue from balance
    - Return 400 Bad Request if balance insufficient
    - Update order paymentStatus to Completed on successful payment
    - Update assigned GameKey customerOwnershipDate to current timestamp
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [ ] 10.3 Create refund processing logic
    - Return payment amount to customer accountBalance
    - Update order paymentStatus to Refunded
    - _Requirements: 21.5_

- [ ] 11. Implement OrderController
  - [ ] 11.1 Create order creation endpoint
    - POST /orders (authenticated customer)
    - Accept gameIds array and paymentMethod
    - Use OrderService to create order with game key assignment
    - Return 201 Created with order details including assigned game keys
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [ ] 11.2 Create get order details endpoint
    - GET /orders/{id} (authenticated, owner or admin)
    - Return order including order details and game keys
    - _Requirements: 17.4_

  - [ ] 11.3 Create payment processing endpoint
    - POST /orders/{id}/pay (authenticated customer, owner only)
    - Accept paymentMethod (Wallet, CreditCard, PayPal)
    - Use OrderService to process payment
    - Return 200 OK with updated order
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [ ] 11.4 Create admin order management endpoints
    - GET /orders (authenticated admin)
    - Support pagination and filtering by status and customerId
    - POST /orders/{id}/refund (authenticated admin)
    - Use OrderService to process refund
    - _Requirements: 21.3, 21.4, 21.5_

- [ ] 12. Implement ReviewController
  - [ ] 12.1 Create submit review endpoint
    - POST /reviews (authenticated customer)
    - Verify customer has purchased the game, return 403 Forbidden if not
    - Validate rating is between 1 and 5
    - Validate reviewText is provided
    - Update existing review if customer already reviewed the game
    - Return 200 OK with review details
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

  - [ ] 12.2 Create get customer reviews endpoint
    - GET /reviews/my-reviews (authenticated customer)
    - Return all reviews by the authenticated customer
    - _Requirements: 18.1_

  - [ ] 12.3 Create delete review endpoint
    - DELETE /reviews/{id} (authenticated customer, owner only)
    - Return 204 No Content on success
    - _Requirements: 18.1_

- [ ] 13. Implement PublisherAccountController
  - [ ] 13.1 Create get publisher profile endpoint
    - GET /publishers/me (authenticated publisher)
    - Return publisher account details excluding password
    - _Requirements: 8.1, 8.2_

  - [ ] 13.2 Create update publisher profile endpoint
    - PATCH /publishers/me (authenticated publisher)
    - Allow updating publisherName, phoneNumber, socialMedia, bank details
    - Validate all input fields
    - Return 200 OK with updated account
    - _Requirements: 9.1, 9.3, 9.4_

  - [ ] 13.3 Create get publisher games endpoint
    - GET /publishers/me/games (authenticated publisher)
    - Return all games owned by the publisher
    - _Requirements: 12.5_

- [ ] 14. Implement PromotionController
  - [ ] 14.1 Create promotion creation endpoint
    - POST /promotions (authenticated publisher)
    - Validate required fields: promotionName, discountType, startDate, expirationDate, quantityIssued
    - Set publisherId to authenticated publisher's id
    - Validate expirationDate is after startDate
    - Set status to Active if startDate is current or past, otherwise Inactive
    - Return 201 Created with promotion
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

  - [ ] 14.2 Create get promotions endpoints
    - GET /promotions (public)
    - Return active promotions with optional publisherId filter
    - GET /promotions/my-promotions (authenticated publisher)
    - Return all promotions owned by the publisher
    - _Requirements: 20.1_

  - [ ] 14.3 Create update promotion endpoint
    - PATCH /promotions/{id} (authenticated publisher, owner only)
    - Allow updating promotion fields
    - Automatically set status to Expired when current date exceeds expirationDate
    - Return 200 OK with updated promotion
    - _Requirements: 20.5, 20.6_

- [ ] 15. Implement AdminAccountController
  - [ ] 15.1 Create admin customer management endpoints
    - GET /admin/customers (authenticated admin)
    - Return all customer accounts with pagination and status filter
    - PATCH /admin/customers/{id} (authenticated admin)
    - Allow modification including accountStatus and accountBalance changes
    - Return 200 OK with updated account
    - _Requirements: 21.1, 21.2_

  - [ ] 15.2 Create admin publisher and game management endpoints
    - GET /admin/publishers (authenticated admin)
    - Return all publisher accounts
    - GET /admin/games (authenticated admin)
    - Return all games including delisted games
    - _Requirements: 21.6_

- [ ] 16. Implement comprehensive error handling
  - [ ] 16.1 Configure validation error responses
    - Return 400 Bad Request with detailed validation error messages
    - Use LoopBack's built-in validation with JSON Schema
    - _Requirements: 22.1_

  - [ ] 16.2 Configure authentication and authorization error responses
    - Return 401 Unauthorized for authentication failures
    - Return 403 Forbidden for authorization failures
    - Return 404 Not Found for missing resources
    - Return 409 Conflict for unique constraint violations
    - _Requirements: 22.2, 22.3, 22.4, 22.5_

  - [ ] 16.3 Configure server error handling and logging
    - Return 500 Internal Server Error for unexpected errors
    - Log error details with stack trace and request context
    - Never expose sensitive information in error messages
    - _Requirements: 22.6, 22.7_

- [ ] 17. Configure API documentation
  - [ ] 17.1 Set up OpenAPI specification generation
    - Configure LoopBack to generate OpenAPI 3.0 spec from controllers
    - Enable API explorer at /explorer endpoint
    - Include request/response schemas, parameter descriptions, and examples
    - Indicate which endpoints require authentication
    - Allow testing endpoints directly from explorer
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5_

- [ ] 18. Implement logging
  - [ ] 18.1 Configure application logging
    - Log startup information including environment and database connection status
    - Log authentication events with timestamp and user identifier
    - Log errors with stack trace and request context
    - Log database operation failures
    - Support configurable log levels through environment variables
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5_

- [ ] 19. Create data migration script
  - [ ] 19.1 Analyze and export SQL Server data
    - Review Entity Framework models and SQL Server schema
    - Export data from SQL Server to JSON format
    - Transform data structure to MongoDB document format
    - Convert Vietnamese names to English
    - Hash existing passwords with bcrypt if not already hashed
    - Generate MongoDB ObjectIds for existing records
    - _Requirements: All model requirements 2.1-2.10_

  - [ ] 19.2 Import data to MongoDB
    - Create migration script in src/migrate.ts
    - Import transformed data using repositories
    - Verify data integrity and relationships
    - Create necessary indexes
    - Validate record counts and sample data
    - _Requirements: All model requirements 2.1-2.10_

- [ ] 20. Create seed data for development
  - [ ] 20.1 Create seed script
    - Create Gender reference data (Male, Female, Other)
    - Create sample admin account
    - Create sample customer accounts
    - Create sample publisher accounts
    - Create sample games with keys
    - _Requirements: 2.10_

- [ ] 21. Wire everything together and test end-to-end
  - [ ] 21.1 Configure application startup
    - Bind all repositories, services, and controllers
    - Configure authentication strategy
    - Set up error handling middleware
    - Configure CORS for client applications
    - _Requirements: 1.5_

  - [ ] 21.2 Test complete user flows
    - Test customer registration and login flow
    - Test game browsing and purchase flow
    - Test publisher game management flow
    - Test review submission flow
    - Test admin management operations
    - Verify all API endpoints return correct responses
    - Verify error handling works correctly
    - _Requirements: All requirements_
