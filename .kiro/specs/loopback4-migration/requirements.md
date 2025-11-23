# Requirements Document

## Introduction

This document outlines the requirements for migrating the Game Store backend system from a C# WPF application with SQL Server and Entity Framework to a modern TypeScript-based REST API using LoopBack 4 framework with MongoDB as the database. The migration includes translating all Vietnamese model names to English, preserving all existing functionality, and establishing a scalable API architecture that can support both the existing WPF client and future web/mobile clients.

## Glossary

- **GameStoreAPI**: The new LoopBack 4 REST API system that will replace the current C# backend
- **CustomerAccount**: User account for customers who purchase games (formerly TAIKHOANKHACHHANG)
- **PublisherAccount**: Account for game publishers who list games on the platform (formerly TAIKHOANPHATHANH)
- **AdminAccount**: Administrative account for system management (formerly TAIKHOANQUANTRIVIEN)
- **Game**: Digital game product available for purchase (formerly GAME)
- **GameKey**: Unique activation key for a game purchase (formerly KEYGAME)
- **Order**: Customer purchase transaction (formerly DONHANG)
- **OrderDetail**: Line items within an order (formerly CHITIETDONHANG)
- **Review**: Customer review and rating for a game (formerly DANHGIA)
- **Promotion**: Discount or promotional offer (formerly UUDAI)
- **Gender**: Gender reference data (formerly GIOITINH)
- **MongoDB**: NoSQL document database that will replace SQL Server
- **JWT**: JSON Web Token used for authentication
- **LoopBack4**: Node.js framework for building REST APIs

## Requirements

### Requirement 1

**User Story:** As a system architect, I want to establish the LoopBack 4 project infrastructure with MongoDB connectivity, so that the development team has a solid foundation for building the API.

#### Acceptance Criteria

1. WHEN the project is initialized, THE GameStoreAPI SHALL create a LoopBack 4 application with TypeScript configuration
2. WHEN MongoDB connection is configured, THE GameStoreAPI SHALL establish a datasource connection to MongoDB database with connection pooling
3. WHEN environment variables are loaded, THE GameStoreAPI SHALL read configuration from .env file including database URL, JWT secret, and port settings
4. THE GameStoreAPI SHALL install all required dependencies including MongoDB connector, authentication packages, and validation libraries
5. WHEN the application starts, THE GameStoreAPI SHALL verify MongoDB connectivity and log connection status

### Requirement 2

**User Story:** As a developer, I want all data models translated from Vietnamese to English with proper MongoDB schema definitions, so that the codebase is internationally maintainable and follows best practices.

#### Acceptance Criteria

1. WHEN defining the CustomerAccount model, THE GameStoreAPI SHALL create a model with properties id, email, phoneNumber, username, password, genderId, registrationDate, accountStatus, accountBalance, bankType, bankName, description, createdAt, and updatedAt
2. WHEN defining the PublisherAccount model, THE GameStoreAPI SHALL create a model with properties id, publisherName, email, phoneNumber, socialMedia, bankType, bankName, contractDate, contractDuration, activityStatus, password, createdAt, and updatedAt
3. WHEN defining the AdminAccount model, THE GameStoreAPI SHALL create a model with properties id, email, genderId, phoneNumber, role, password, createdAt, and updatedAt
4. WHEN defining the Game model, THE GameStoreAPI SHALL create a model with properties id, name, genre, description, imageUrl, videoUrl, releaseDate, publisherId, releaseStatus, version, originalPrice, discountPrice, createdAt, and updatedAt
5. WHEN defining the GameKey model, THE GameStoreAPI SHALL create a model with properties id, gameId, gameVersion, ownedByCustomerId, publishRegistrationDate, customerOwnershipDate, businessStatus, activationStatus, createdAt, and updatedAt
6. WHEN defining the Order model, THE GameStoreAPI SHALL create a model with properties id, customerId, orderDate, totalValue, paymentMethod, transactionId, paymentStatus, createdAt, and updatedAt
7. WHEN defining the OrderDetail model, THE GameStoreAPI SHALL create a model with properties id, orderId, gameId, gameKeyId, value, createdAt, and updatedAt
8. WHEN defining the Review model, THE GameStoreAPI SHALL create a model with properties id, customerId, gameId, reviewText, rating, createdAt, and updatedAt
9. WHEN defining the Promotion model, THE GameStoreAPI SHALL create a model with properties id, promotionName, discountType, applicableScope, applicationCondition, startDate, expirationDate, endDate, quantityIssued, status, publisherId, createdAt, and updatedAt
10. WHEN defining the Gender model, THE GameStoreAPI SHALL create a model with properties id and name
11. WHEN any model is saved to MongoDB, THE GameStoreAPI SHALL automatically set createdAt timestamp on creation
12. WHEN any model is updated in MongoDB, THE GameStoreAPI SHALL automatically update the updatedAt timestamp

### Requirement 3

**User Story:** As a developer, I want to establish proper relationships between models using LoopBack 4 relation decorators, so that data integrity is maintained and related data can be efficiently queried.

#### Acceptance Criteria

1. WHEN CustomerAccount relates to Gender, THE GameStoreAPI SHALL define a belongsTo relationship from CustomerAccount to Gender
2. WHEN CustomerAccount relates to Orders, THE GameStoreAPI SHALL define a hasMany relationship from CustomerAccount to Order
3. WHEN CustomerAccount relates to Reviews, THE GameStoreAPI SHALL define a hasMany relationship from CustomerAccount to Review
4. WHEN Game relates to PublisherAccount, THE GameStoreAPI SHALL define a belongsTo relationship from Game to PublisherAccount
5. WHEN Game relates to GameKeys, THE GameStoreAPI SHALL define a hasMany relationship from Game to GameKey
6. WHEN Game relates to Reviews, THE GameStoreAPI SHALL define a hasMany relationship from Game to Review
7. WHEN Order relates to CustomerAccount, THE GameStoreAPI SHALL define a belongsTo relationship from Order to CustomerAccount
8. WHEN Order relates to OrderDetails, THE GameStoreAPI SHALL define a hasMany relationship from Order to OrderDetail
9. WHEN GameKey relates to Game, THE GameStoreAPI SHALL define a belongsTo relationship from GameKey to Game
10. WHEN Promotion relates to PublisherAccount, THE GameStoreAPI SHALL define a belongsTo relationship from Promotion to PublisherAccount

### Requirement 4

**User Story:** As a developer, I want to create repositories for all models with proper MongoDB configuration, so that data access operations are standardized and efficient.

#### Acceptance Criteria

1. WHEN a repository is created for any model, THE GameStoreAPI SHALL extend DefaultCrudRepository with MongoDB datasource injection
2. WHEN CustomerAccountRepository is initialized, THE GameStoreAPI SHALL configure relation accessors for gender, orders, and reviews
3. WHEN GameRepository is initialized, THE GameStoreAPI SHALL configure relation accessors for publisher, gameKeys, and reviews
4. WHEN OrderRepository is initialized, THE GameStoreAPI SHALL configure relation accessors for customer and orderDetails
5. THE GameStoreAPI SHALL create repositories for all ten models: CustomerAccount, PublisherAccount, AdminAccount, Gender, Game, GameKey, Order, OrderDetail, Review, and Promotion

### Requirement 5

**User Story:** As a security engineer, I want to implement JWT-based authentication with password hashing, so that user credentials are protected and API access is secured.

#### Acceptance Criteria

1. WHEN a user registers, THE GameStoreAPI SHALL hash the password using bcrypt with minimum 10 salt rounds before storing
2. WHEN a user attempts to login with email and password, THE GameStoreAPI SHALL verify credentials against stored hashed password
3. IF login credentials are valid, THEN THE GameStoreAPI SHALL generate a JWT token with user profile information and 7-day expiration
4. IF login credentials are invalid, THEN THE GameStoreAPI SHALL return HTTP 401 Unauthorized status
5. IF account status is not Active, THEN THE GameStoreAPI SHALL reject login attempt with HTTP 401 status
6. WHEN a protected endpoint is accessed, THE GameStoreAPI SHALL validate JWT token from Authorization header
7. IF JWT token is invalid or expired, THEN THE GameStoreAPI SHALL return HTTP 401 Unauthorized status
8. THE GameStoreAPI SHALL never expose password fields in API responses

### Requirement 6

**User Story:** As a customer, I want to register a new account with email, phone number, username, and password, so that I can access the game store platform.

#### Acceptance Criteria

1. WHEN a registration request is received, THE GameStoreAPI SHALL validate that email format is valid
2. WHEN a registration request is received, THE GameStoreAPI SHALL validate that phone number matches pattern for Vietnamese phone numbers (0 or +84 followed by 9-10 digits)
3. WHEN a registration request is received, THE GameStoreAPI SHALL validate that username is between 3 and 50 characters
4. WHEN a registration request is received, THE GameStoreAPI SHALL validate that password is minimum 8 characters
5. IF email already exists in database, THEN THE GameStoreAPI SHALL return HTTP 409 Conflict with error message
6. IF phone number already exists in database, THEN THE GameStoreAPI SHALL return HTTP 409 Conflict with error message
7. WHEN registration validation passes, THE GameStoreAPI SHALL create new CustomerAccount with accountStatus set to Active and accountBalance set to 0
8. WHEN registration is successful, THE GameStoreAPI SHALL return HTTP 201 Created with account details excluding password

### Requirement 7

**User Story:** As a customer, I want to login using my email or phone number with password, so that I can access my account and purchase games.

#### Acceptance Criteria

1. WHEN a login request is received, THE GameStoreAPI SHALL accept either email or phone number as username identifier
2. WHEN credentials are verified successfully, THE GameStoreAPI SHALL return JWT token with user profile including id, email, and username
3. WHEN login is successful, THE GameStoreAPI SHALL return HTTP 200 OK with token and user profile
4. THE GameStoreAPI SHALL support login for CustomerAccount, PublisherAccount, and AdminAccount with separate endpoints

### Requirement 8

**User Story:** As a customer, I want to view my account profile information, so that I can verify my account details and balance.

#### Acceptance Criteria

1. WHEN an authenticated customer requests their profile, THE GameStoreAPI SHALL return account information including email, phoneNumber, username, genderId, registrationDate, accountStatus, accountBalance, bankType, bankName, and description
2. WHEN profile is returned, THE GameStoreAPI SHALL exclude password field from response
3. IF user is not authenticated, THEN THE GameStoreAPI SHALL return HTTP 401 Unauthorized
4. WHEN profile includes genderId, THE GameStoreAPI SHALL optionally include related Gender information if requested

### Requirement 9

**User Story:** As a customer, I want to update my account information including username, phone number, and bank details, so that I can keep my profile current.

#### Acceptance Criteria

1. WHEN an authenticated customer updates their profile, THE GameStoreAPI SHALL validate all input fields according to model constraints
2. IF phone number is being changed and new number already exists, THEN THE GameStoreAPI SHALL return HTTP 409 Conflict
3. WHEN profile update is successful, THE GameStoreAPI SHALL update the updatedAt timestamp
4. WHEN profile update is successful, THE GameStoreAPI SHALL return HTTP 200 OK with updated profile
5. THE GameStoreAPI SHALL not allow customers to update email, password, accountStatus, or accountBalance through profile update endpoint

### Requirement 10

**User Story:** As a customer, I want to change my password by providing current password and new password, so that I can maintain account security.

#### Acceptance Criteria

1. WHEN a password change request is received, THE GameStoreAPI SHALL verify that current password matches stored password
2. IF current password is incorrect, THEN THE GameStoreAPI SHALL return HTTP 401 Unauthorized
3. WHEN current password is verified, THE GameStoreAPI SHALL validate that new password is minimum 8 characters
4. WHEN password change is successful, THE GameStoreAPI SHALL hash new password with bcrypt before storing
5. WHEN password change is successful, THE GameStoreAPI SHALL return HTTP 204 No Content

### Requirement 11

**User Story:** As a publisher, I want to register a publisher account with company information and contract details, so that I can list games on the platform.

#### Acceptance Criteria

1. WHEN a publisher registration request is received, THE GameStoreAPI SHALL validate publisherName, email, phoneNumber, contractDate, and contractDuration are provided
2. IF email already exists for any account type, THEN THE GameStoreAPI SHALL return HTTP 409 Conflict
3. WHEN publisher registration is successful, THE GameStoreAPI SHALL set activityStatus to Active
4. WHEN publisher registration is successful, THE GameStoreAPI SHALL return HTTP 201 Created with publisher account details

### Requirement 12

**User Story:** As a publisher, I want to create and manage game listings with details like name, genre, description, price, and media, so that customers can discover and purchase my games.

#### Acceptance Criteria

1. WHEN an authenticated publisher creates a game, THE GameStoreAPI SHALL validate that name, genre, description, releaseDate, version, and originalPrice are provided
2. WHEN a game is created, THE GameStoreAPI SHALL set publisherId to the authenticated publisher's id
3. WHEN a game is created, THE GameStoreAPI SHALL set releaseStatus to Released by default
4. WHEN a game is created, THE GameStoreAPI SHALL return HTTP 201 Created with game details
5. WHEN an authenticated publisher updates their own game, THE GameStoreAPI SHALL allow modification of all game fields except id and publisherId
6. IF a publisher attempts to update a game they do not own, THEN THE GameStoreAPI SHALL return HTTP 403 Forbidden
7. WHEN a publisher deletes their game, THE GameStoreAPI SHALL set releaseStatus to Delisted instead of removing from database

### Requirement 13

**User Story:** As a customer, I want to browse and search games by genre, name, or publisher, so that I can find games I'm interested in purchasing.

#### Acceptance Criteria

1. WHEN a customer requests game list, THE GameStoreAPI SHALL return games with releaseStatus of Released
2. WHEN a customer searches games by name, THE GameStoreAPI SHALL perform case-insensitive partial match on game name
3. WHEN a customer filters games by genre, THE GameStoreAPI SHALL return only games matching the specified genre
4. WHEN a customer filters games by publisher, THE GameStoreAPI SHALL return only games from the specified publisherId
5. WHEN game list is returned, THE GameStoreAPI SHALL support pagination with configurable page size and page number
6. WHEN game details are requested, THE GameStoreAPI SHALL include publisher information and average rating

### Requirement 14

**User Story:** As a publisher, I want to generate and manage game keys for my games, so that customers can receive activation keys when they purchase.

#### Acceptance Criteria

1. WHEN an authenticated publisher creates game keys, THE GameStoreAPI SHALL validate that gameId belongs to a game owned by the publisher
2. WHEN game keys are created, THE GameStoreAPI SHALL set businessStatus to Available and activationStatus to NotActivated
3. WHEN game keys are created, THE GameStoreAPI SHALL set publishRegistrationDate to current timestamp
4. WHEN a publisher views their game keys, THE GameStoreAPI SHALL filter to show only keys for games they own
5. WHEN a publisher requests available key count for a game, THE GameStoreAPI SHALL return count of keys with businessStatus Available

### Requirement 15

**User Story:** As a customer, I want to create an order to purchase games, so that I can add games to my library.

#### Acceptance Criteria

1. WHEN an authenticated customer creates an order, THE GameStoreAPI SHALL validate that all requested games have available keys
2. WHEN an order is created, THE GameStoreAPI SHALL calculate totalValue based on current game prices (discountPrice if available, otherwise originalPrice)
3. WHEN an order is created, THE GameStoreAPI SHALL set paymentStatus to Pending
4. WHEN an order is created, THE GameStoreAPI SHALL generate unique transactionId
5. WHEN an order is created, THE GameStoreAPI SHALL create OrderDetail records for each game in the order
6. WHEN OrderDetail is created, THE GameStoreAPI SHALL assign an available GameKey to the order and update key businessStatus to Sold
7. WHEN order creation is successful, THE GameStoreAPI SHALL return HTTP 201 Created with order details including assigned game keys

### Requirement 16

**User Story:** As a customer, I want to complete payment for my order using my account balance or external payment method, so that I can receive my game keys.

#### Acceptance Criteria

1. WHEN a customer pays with account balance, THE GameStoreAPI SHALL verify that accountBalance is sufficient for order totalValue
2. IF account balance is insufficient, THEN THE GameStoreAPI SHALL return HTTP 400 Bad Request with error message
3. WHEN payment with account balance is successful, THE GameStoreAPI SHALL deduct totalValue from customer accountBalance
4. WHEN payment is successful, THE GameStoreAPI SHALL update order paymentStatus to Completed
5. WHEN payment is successful, THE GameStoreAPI SHALL update assigned GameKey customerOwnershipDate to current timestamp
6. WHEN payment is successful, THE GameStoreAPI SHALL return HTTP 200 OK with updated order and game keys

### Requirement 17

**User Story:** As a customer, I want to view my order history with details of purchased games and keys, so that I can track my purchases and access my game keys.

#### Acceptance Criteria

1. WHEN an authenticated customer requests order history, THE GameStoreAPI SHALL return only orders belonging to that customer
2. WHEN order history is returned, THE GameStoreAPI SHALL include OrderDetail records with game information
3. WHEN order history is returned, THE GameStoreAPI SHALL include assigned GameKey information for each order item
4. WHEN order details are requested, THE GameStoreAPI SHALL return complete order information including payment status and transaction details
5. THE GameStoreAPI SHALL support pagination for order history with configurable page size

### Requirement 18

**User Story:** As a customer, I want to write reviews and ratings for games I have purchased, so that I can share my experience with other customers.

#### Acceptance Criteria

1. WHEN a customer submits a review, THE GameStoreAPI SHALL verify that the customer has purchased the game
2. IF customer has not purchased the game, THEN THE GameStoreAPI SHALL return HTTP 403 Forbidden
3. WHEN a review is submitted, THE GameStoreAPI SHALL validate that rating is between 1 and 5
4. WHEN a review is submitted, THE GameStoreAPI SHALL validate that reviewText is provided
5. IF customer has already reviewed the game, THEN THE GameStoreAPI SHALL update existing review instead of creating duplicate
6. WHEN review is created or updated, THE GameStoreAPI SHALL return HTTP 200 OK with review details

### Requirement 19

**User Story:** As a customer, I want to view reviews and ratings for a game, so that I can make informed purchase decisions.

#### Acceptance Criteria

1. WHEN reviews are requested for a game, THE GameStoreAPI SHALL return all reviews for that game with customer information
2. WHEN reviews are returned, THE GameStoreAPI SHALL calculate and include average rating for the game
3. WHEN reviews are returned, THE GameStoreAPI SHALL support pagination with configurable page size
4. WHEN reviews are returned, THE GameStoreAPI SHALL exclude customer password and sensitive information
5. THE GameStoreAPI SHALL support sorting reviews by date (newest first or oldest first) or rating (highest first or lowest first)

### Requirement 20

**User Story:** As a publisher, I want to create promotional offers for my games with discount percentages and validity periods, so that I can attract more customers.

#### Acceptance Criteria

1. WHEN an authenticated publisher creates a promotion, THE GameStoreAPI SHALL validate that promotionName, discountType, startDate, expirationDate, and quantityIssued are provided
2. WHEN a promotion is created, THE GameStoreAPI SHALL set publisherId to the authenticated publisher's id
3. WHEN a promotion is created, THE GameStoreAPI SHALL validate that expirationDate is after startDate
4. WHEN a promotion is created, THE GameStoreAPI SHALL set status to Active if startDate is current or past, otherwise Inactive
5. WHEN a promotion is updated, THE GameStoreAPI SHALL only allow publisher who owns the promotion to modify it
6. WHEN current date exceeds expirationDate, THE GameStoreAPI SHALL automatically set promotion status to Expired

### Requirement 21

**User Story:** As an administrator, I want to manage all accounts, games, and orders in the system, so that I can maintain platform integrity and resolve issues.

#### Acceptance Criteria

1. WHEN an authenticated admin requests any account list, THE GameStoreAPI SHALL return all accounts of that type with full details
2. WHEN an authenticated admin updates any account, THE GameStoreAPI SHALL allow modification including accountStatus changes
3. WHEN an authenticated admin views all orders, THE GameStoreAPI SHALL return orders from all customers with filtering options
4. WHEN an authenticated admin updates order paymentStatus, THE GameStoreAPI SHALL allow status changes including refunds
5. IF admin sets order paymentStatus to Refunded, THEN THE GameStoreAPI SHALL return payment amount to customer accountBalance
6. WHEN an authenticated admin views all games, THE GameStoreAPI SHALL return games from all publishers including delisted games

### Requirement 22

**User Story:** As a developer, I want comprehensive error handling with appropriate HTTP status codes and error messages, so that API consumers can handle errors gracefully.

#### Acceptance Criteria

1. WHEN validation fails for any request, THE GameStoreAPI SHALL return HTTP 400 Bad Request with detailed validation error messages
2. WHEN authentication fails, THE GameStoreAPI SHALL return HTTP 401 Unauthorized with error message
3. WHEN authorization fails for protected resources, THE GameStoreAPI SHALL return HTTP 403 Forbidden with error message
4. WHEN a requested resource is not found, THE GameStoreAPI SHALL return HTTP 404 Not Found with error message
5. WHEN a unique constraint is violated, THE GameStoreAPI SHALL return HTTP 409 Conflict with error message
6. WHEN an unexpected server error occurs, THE GameStoreAPI SHALL return HTTP 500 Internal Server Error and log error details
7. THE GameStoreAPI SHALL never expose sensitive information like passwords or internal system details in error messages

### Requirement 23

**User Story:** As a developer, I want API documentation automatically generated from code, so that API consumers have up-to-date reference documentation.

#### Acceptance Criteria

1. WHEN the GameStoreAPI application starts, THE GameStoreAPI SHALL generate OpenAPI 3.0 specification from controller definitions
2. WHEN API explorer is accessed at /explorer endpoint, THE GameStoreAPI SHALL display interactive API documentation
3. WHEN API documentation is viewed, THE GameStoreAPI SHALL include request/response schemas, parameter descriptions, and example values
4. WHEN API documentation is viewed, THE GameStoreAPI SHALL indicate which endpoints require authentication
5. THE GameStoreAPI SHALL allow testing API endpoints directly from the explorer interface

### Requirement 24

**User Story:** As a system administrator, I want the API to log important events and errors, so that I can monitor system health and troubleshoot issues.

#### Acceptance Criteria

1. WHEN the application starts, THE GameStoreAPI SHALL log startup information including environment and database connection status
2. WHEN authentication events occur, THE GameStoreAPI SHALL log login attempts with timestamp and user identifier
3. WHEN errors occur, THE GameStoreAPI SHALL log error details including stack trace and request context
4. WHEN database operations fail, THE GameStoreAPI SHALL log database error details
5. THE GameStoreAPI SHALL support configurable log levels (debug, info, warn, error) through environment variables
