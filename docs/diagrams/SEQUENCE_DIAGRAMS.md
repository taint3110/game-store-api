# Sequence Diagrams

## Authentication Flows

### 1. Customer Registration

```mermaid
sequenceDiagram
    actor Customer
    participant Frontend
    participant AuthController
    participant CustomerRepo
    participant PasswordService
    participant Database

    Customer->>Frontend: Fill registration form
    Frontend->>AuthController: POST /auth/customer/register
    AuthController->>CustomerRepo: findByEmail(email)
    CustomerRepo->>Database: Query customer by email
    Database-->>CustomerRepo: null (not found)
    CustomerRepo-->>AuthController: null
    
    AuthController->>PasswordService: hashPassword(password)
    PasswordService-->>AuthController: hashedPassword
    
    AuthController->>CustomerRepo: create(customerData)
    CustomerRepo->>Database: Insert customer document
    Database-->>CustomerRepo: Created customer
    CustomerRepo-->>AuthController: Customer object
    
    AuthController-->>Frontend: 201 Created (without password)
    Frontend-->>Customer: Registration successful
```

### 2. Customer Login

```mermaid
sequenceDiagram
    actor Customer
    participant Frontend
    participant AuthController
    participant AuthService
    participant CustomerRepo
    participant PasswordService
    participant JWTService
    participant Database

    Customer->>Frontend: Enter credentials
    Frontend->>AuthController: POST /auth/customer/login
    AuthController->>AuthService: verifyCustomerCredentials(email, password)
    
    AuthService->>CustomerRepo: findByEmail(email)
    CustomerRepo->>Database: Query customer
    Database-->>CustomerRepo: Customer document
    CustomerRepo-->>AuthService: Customer object
    
    AuthService->>PasswordService: comparePassword(password, hashedPassword)
    PasswordService-->>AuthService: true
    
    AuthService-->>AuthController: UserProfile
    
    AuthController->>JWTService: generateToken(userProfile)
    JWTService-->>AuthController: JWT token
    
    AuthController-->>Frontend: 200 OK {token, user}
    Frontend->>Frontend: Store token in localStorage
    Frontend-->>Customer: Login successful
```

### 3. Admin Login

```mermaid
sequenceDiagram
    actor Admin
    participant Frontend
    participant AuthController
    participant AuthService
    participant AdminRepo
    participant PasswordService
    participant JWTService

    Admin->>Frontend: Enter admin credentials
    Frontend->>AuthController: POST /auth/admin/login
    AuthController->>AuthService: verifyAdminCredentials(email, password)
    
    AuthService->>AdminRepo: findByEmail(email)
    AdminRepo-->>AuthService: Admin object
    
    AuthService->>PasswordService: comparePassword(password, hashedPassword)
    PasswordService-->>AuthService: true
    
    AuthService-->>AuthController: UserProfile (with role)
    
    AuthController->>JWTService: generateToken(userProfile)
    JWTService-->>AuthController: JWT token (includes role)
    
    AuthController-->>Frontend: 200 OK {token, user}
    Frontend-->>Admin: Login successful with admin access
```

---

## Game Management Flows

### 4. Publisher Creates Game

```mermaid
sequenceDiagram
    actor Publisher
    participant Frontend
    participant GameController
    participant JWTService
    participant GameRepo
    participant Database

    Publisher->>Frontend: Fill game creation form
    Frontend->>GameController: POST /games (with JWT token)
    
    GameController->>JWTService: verifyToken(token)
    JWTService-->>GameController: UserProfile (accountType: publisher)
    
    GameController->>GameController: Check authorization
    Note over GameController: Verify accountType is 'publisher' or 'admin'
    
    GameController->>GameRepo: create(gameData)
    GameRepo->>Database: Insert game document
    Database-->>GameRepo: Created game
    GameRepo-->>GameController: Game object
    
    GameController-->>Frontend: 201 Created
    Frontend-->>Publisher: Game created successfully
```

### 5. Customer Views Game Details

```mermaid
sequenceDiagram
    actor Customer
    participant Frontend
    participant GameController
    participant GameRepo
    participant ReviewRepo
    participant Database

    Customer->>Frontend: Click on game
    Frontend->>GameController: GET /games/{id}
    
    GameController->>GameRepo: findById(id, {include: ['publisher']})
    GameRepo->>Database: Query game with publisher
    Database-->>GameRepo: Game with publisher data
    GameRepo-->>GameController: Game object
    
    GameController->>ReviewRepo: calculateAverageRating(gameId)
    ReviewRepo->>Database: Aggregate reviews
    Database-->>ReviewRepo: Average rating
    ReviewRepo-->>GameController: 4.5
    
    GameController-->>Frontend: 200 OK {game, averageRating}
    Frontend-->>Customer: Display game details
```

### 6. Admin Updates Any Game

```mermaid
sequenceDiagram
    actor Admin
    participant Frontend
    participant GameController
    participant JWTService
    participant GameRepo
    participant Database

    Admin->>Frontend: Edit game details
    Frontend->>GameController: PATCH /games/{id} (with JWT token)
    
    GameController->>JWTService: verifyToken(token)
    JWTService-->>GameController: UserProfile (accountType: admin)
    
    GameController->>GameController: Check authorization
    Note over GameController: Admin bypasses ownership check
    
    GameController->>GameRepo: updateById(id, gameData)
    GameRepo->>Database: Update game document
    Database-->>GameRepo: Success
    GameRepo-->>GameController: Updated game
    
    GameController-->>Frontend: 200 OK
    Frontend-->>Admin: Game updated successfully
```

---

## Order Processing Flow

### 7. Customer Places Order

```mermaid
sequenceDiagram
    actor Customer
    participant Frontend
    participant OrderController
    participant JWTService
    participant OrderRepo
    participant OrderDetailRepo
    participant GameKeyRepo
    participant Database

    Customer->>Frontend: Add games to cart & checkout
    Frontend->>OrderController: POST /orders (with JWT token)
    
    OrderController->>JWTService: verifyToken(token)
    JWTService-->>OrderController: UserProfile (customerId)
    
    OrderController->>OrderRepo: create(orderData)
    OrderRepo->>Database: Insert order
    Database-->>OrderRepo: Created order
    OrderRepo-->>OrderController: Order object
    
    loop For each game in order
        OrderController->>GameKeyRepo: findOne({gameId, keyStatus: 'Available'})
        GameKeyRepo->>Database: Query available key
        Database-->>GameKeyRepo: Game key
        GameKeyRepo-->>OrderController: GameKey object
        
        OrderController->>OrderDetailRepo: create(orderDetailData)
        OrderDetailRepo->>Database: Insert order detail
        Database-->>OrderDetailRepo: Created order detail
        
        OrderController->>GameKeyRepo: updateById(keyId, {keyStatus: 'Sold'})
        GameKeyRepo->>Database: Update key status
        Database-->>GameKeyRepo: Success
    end
    
    OrderController-->>Frontend: 201 Created
    Frontend-->>Customer: Order placed successfully
```

### 8. Customer Views Order History

```mermaid
sequenceDiagram
    actor Customer
    participant Frontend
    participant CustomerController
    participant JWTService
    participant OrderRepo
    participant Database

    Customer->>Frontend: Navigate to order history
    Frontend->>CustomerController: GET /customers/me/orders (with JWT token)
    
    CustomerController->>JWTService: verifyToken(token)
    JWTService-->>CustomerController: UserProfile (customerId)
    
    CustomerController->>OrderRepo: find({customerId, include: ['orderDetails']})
    OrderRepo->>Database: Query orders with details
    Database-->>OrderRepo: Orders array
    OrderRepo-->>CustomerController: Orders with details
    
    CustomerController-->>Frontend: 200 OK [orders]
    Frontend-->>Customer: Display order history with game keys
```

---

## Review System Flow

### 9. Customer Writes Review

```mermaid
sequenceDiagram
    actor Customer
    participant Frontend
    participant ReviewController
    participant JWTService
    participant ReviewRepo
    participant OrderRepo
    participant Database

    Customer->>Frontend: Write review for game
    Frontend->>ReviewController: POST /reviews (with JWT token)
    
    ReviewController->>JWTService: verifyToken(token)
    JWTService-->>ReviewController: UserProfile (customerId)
    
    ReviewController->>OrderRepo: findOne({customerId, gameId})
    OrderRepo->>Database: Check if customer purchased game
    Database-->>OrderRepo: Order found
    OrderRepo-->>ReviewController: Order exists
    
    ReviewController->>ReviewRepo: create(reviewData)
    ReviewRepo->>Database: Insert review
    Database-->>ReviewRepo: Created review
    ReviewRepo-->>ReviewController: Review object
    
    ReviewController-->>Frontend: 201 Created
    Frontend-->>Customer: Review posted successfully
```

### 10. View Game Reviews

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant GameController
    participant ReviewRepo
    participant Database

    User->>Frontend: View game reviews
    Frontend->>GameController: GET /games/{id}/reviews?sort=rating_desc
    
    GameController->>ReviewRepo: find({gameId, include: ['customer']})
    ReviewRepo->>Database: Query reviews with customer data
    Database-->>ReviewRepo: Reviews array
    ReviewRepo-->>GameController: Reviews with customer info
    
    GameController->>ReviewRepo: calculateAverageRating(gameId)
    ReviewRepo->>Database: Aggregate rating
    Database-->>ReviewRepo: Average rating
    ReviewRepo-->>GameController: 4.5
    
    GameController->>GameController: Sort reviews by rating
    
    GameController-->>Frontend: 200 OK {reviews, averageRating, totalReviews}
    Frontend-->>User: Display sorted reviews
```

---

## Admin Management Flows

### 11. Admin Views Platform Statistics

```mermaid
sequenceDiagram
    actor Admin
    participant Frontend
    participant AdminMgmtController
    participant JWTService
    participant CustomerRepo
    participant PublisherRepo
    participant GameRepo
    participant OrderRepo
    participant ReviewRepo
    participant Database

    Admin->>Frontend: Navigate to dashboard
    Frontend->>AdminMgmtController: GET /admin/statistics (with JWT token)
    
    AdminMgmtController->>JWTService: verifyToken(token)
    JWTService-->>AdminMgmtController: UserProfile (accountType: admin)
    
    AdminMgmtController->>AdminMgmtController: Check authorization
    
    par Parallel queries
        AdminMgmtController->>CustomerRepo: count()
        CustomerRepo->>Database: Count customers
        Database-->>CustomerRepo: 1500
        
        AdminMgmtController->>PublisherRepo: count()
        PublisherRepo->>Database: Count publishers
        Database-->>PublisherRepo: 50
        
        AdminMgmtController->>GameRepo: count()
        GameRepo->>Database: Count games
        Database-->>GameRepo: 200
        
        AdminMgmtController->>OrderRepo: count()
        OrderRepo->>Database: Count orders
        Database-->>OrderRepo: 5000
        
        AdminMgmtController->>ReviewRepo: count()
        ReviewRepo->>Database: Count reviews
        Database-->>ReviewRepo: 3000
    end
    
    AdminMgmtController-->>Frontend: 200 OK {statistics}
    Frontend-->>Admin: Display dashboard with stats
```

### 12. Admin Manages Customer Account

```mermaid
sequenceDiagram
    actor Admin
    participant Frontend
    participant AdminMgmtController
    participant JWTService
    participant CustomerRepo
    participant Database

    Admin->>Frontend: Update customer status
    Frontend->>AdminMgmtController: PATCH /admin/customers/{id} (with JWT token)
    
    AdminMgmtController->>JWTService: verifyToken(token)
    JWTService-->>AdminMgmtController: UserProfile (accountType: admin)
    
    AdminMgmtController->>AdminMgmtController: Check authorization
    Note over AdminMgmtController: Verify accountType is 'admin'
    
    AdminMgmtController->>CustomerRepo: updateById(id, {accountStatus: 'Suspended'})
    CustomerRepo->>Database: Update customer
    Database-->>CustomerRepo: Success
    CustomerRepo-->>AdminMgmtController: Updated customer
    
    AdminMgmtController-->>Frontend: 200 OK
    Frontend-->>Admin: Customer account suspended
```

### 13. SuperAdmin Creates New Admin

```mermaid
sequenceDiagram
    actor SuperAdmin
    participant Frontend
    participant AdminController
    participant JWTService
    participant AdminRepo
    participant CustomerRepo
    participant PublisherRepo
    participant PasswordService
    participant Database

    SuperAdmin->>Frontend: Fill new admin form
    Frontend->>AdminController: POST /admins (with JWT token)
    
    AdminController->>JWTService: verifyToken(token)
    JWTService-->>AdminController: UserProfile (role: SuperAdmin)
    
    AdminController->>AdminController: Check authorization
    Note over AdminController: Only SuperAdmin can create admins
    
    par Check email uniqueness across all account types
        AdminController->>AdminRepo: findByEmail(email)
        AdminRepo->>Database: Query admin
        Database-->>AdminRepo: null
        
        AdminController->>CustomerRepo: findByEmail(email)
        CustomerRepo->>Database: Query customer
        Database-->>CustomerRepo: null
        
        AdminController->>PublisherRepo: findByEmail(email)
        PublisherRepo->>Database: Query publisher
        Database-->>PublisherRepo: null
    end
    
    AdminController->>PasswordService: hashPassword(password)
    PasswordService-->>AdminController: hashedPassword
    
    AdminController->>AdminRepo: create(adminData)
    AdminRepo->>Database: Insert admin
    Database-->>AdminRepo: Created admin
    AdminRepo-->>AdminController: Admin object
    
    AdminController-->>Frontend: 201 Created
    Frontend-->>SuperAdmin: New admin created successfully
```

---

## Profile Management Flow

### 14. Customer Updates Profile

```mermaid
sequenceDiagram
    actor Customer
    participant Frontend
    participant CustomerController
    participant JWTService
    participant CustomerRepo
    participant Database

    Customer->>Frontend: Edit profile information
    Frontend->>CustomerController: PATCH /customers/me (with JWT token)
    
    CustomerController->>JWTService: verifyToken(token)
    JWTService-->>CustomerController: UserProfile (customerId)
    
    CustomerController->>CustomerRepo: findByPhoneNumber(newPhoneNumber)
    CustomerRepo->>Database: Check phone uniqueness
    Database-->>CustomerRepo: null (available)
    CustomerRepo-->>CustomerController: Phone available
    
    CustomerController->>CustomerRepo: updateById(customerId, updateData)
    CustomerRepo->>Database: Update customer
    Database-->>CustomerRepo: Success
    CustomerRepo-->>CustomerController: Updated customer
    
    CustomerController-->>Frontend: 200 OK
    Frontend-->>Customer: Profile updated successfully
```

### 15. Change Password

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant AccountController
    participant JWTService
    participant AccountRepo
    participant PasswordService
    participant Database

    User->>Frontend: Enter current & new password
    Frontend->>AccountController: POST /*/me/change-password (with JWT token)
    
    AccountController->>JWTService: verifyToken(token)
    JWTService-->>AccountController: UserProfile (userId)
    
    AccountController->>AccountRepo: findById(userId)
    AccountRepo->>Database: Query account
    Database-->>AccountRepo: Account object
    AccountRepo-->>AccountController: Account with hashed password
    
    AccountController->>PasswordService: comparePassword(currentPassword, hashedPassword)
    PasswordService-->>AccountController: true
    
    AccountController->>PasswordService: hashPassword(newPassword)
    PasswordService-->>AccountController: newHashedPassword
    
    AccountController->>AccountRepo: updateById(userId, {password: newHashedPassword})
    AccountRepo->>Database: Update password
    Database-->>AccountRepo: Success
    AccountRepo-->>AccountController: Updated
    
    AccountController-->>Frontend: 204 No Content
    Frontend-->>User: Password changed successfully
```

---

## Error Handling Flows

### 16. Authentication Failure

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant AuthController
    participant AuthService
    participant CustomerRepo

    User->>Frontend: Enter wrong credentials
    Frontend->>AuthController: POST /auth/customer/login
    AuthController->>AuthService: verifyCustomerCredentials(email, password)
    
    AuthService->>CustomerRepo: findByEmail(email)
    CustomerRepo-->>AuthService: Customer object
    
    AuthService->>AuthService: comparePassword(password, hashedPassword)
    Note over AuthService: Password doesn't match
    
    AuthService-->>AuthController: throw UnauthorizedError
    AuthController-->>Frontend: 401 Unauthorized {error}
    Frontend-->>User: Display error message
```

### 17. Authorization Failure

```mermaid
sequenceDiagram
    actor Customer
    participant Frontend
    participant GameController
    participant JWTService

    Customer->>Frontend: Try to create game
    Frontend->>GameController: POST /games (with JWT token)
    
    GameController->>JWTService: verifyToken(token)
    JWTService-->>GameController: UserProfile (accountType: customer)
    
    GameController->>GameController: Check authorization
    Note over GameController: Customer is not publisher or admin
    
    GameController-->>Frontend: 403 Forbidden {error}
    Frontend-->>Customer: Display "Insufficient permissions"
```

---

## Notes

- All authenticated requests include JWT token in Authorization header
- Tokens are verified and decoded to extract user information
- Authorization checks happen after authentication
- Admins have elevated privileges and can bypass ownership checks
- Database operations use MongoDB ObjectId for primary keys
- Passwords are always hashed before storage
- Soft deletes are used for games (status change to 'Delisted')
