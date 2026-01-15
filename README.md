# Thrift Backend – E-commerce API for Second-Hand & Vintage Clothing

A modern, production-ready backend API for a thrift/vintage clothing e-commerce platform. Built with Express 5, TypeScript, and Prisma/PostgreSQL.

---

## Features

### Core E-commerce
- **Product Management** - Full CRUD with images, categories, conditions, sizes, brands
- **Shopping Cart** - Guest + authenticated user support with cart merging
- **Orders** - Complete order lifecycle with status tracking
- **Wishlist** - Save favorite items

### Admin Dashboard
- **Dashboard Analytics** - Sales stats, revenue tracking, performance metrics
- **Product Management** - Create, update, delete, bulk operations
- **Category Management** - Categories with nested subcategories
- **Order Management** - Status updates, bulk processing
- **Inventory Tracking** - Stock levels, low stock alerts

### Pricing & Promotions
- **Dynamic Pricing Rules** - Markup/markdown by category, condition, brand
- **Sales & Promotions** - Time-limited sales with countdown timers
- **Bulk Price Updates** - Mass price adjustments

### Authentication & Security
- **JWT Authentication** - Secure HTTP-only cookies
- **Email Verification** - Code-based verification system
- **Password Reset** - Secure 6-digit code flow
- **Role-based Access** - User and admin separation

---

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express 5
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with HTTP-only cookies
- **Image Storage**: Cloudinary
- **Email**: Nodemailer (Gmail or Ethereal fallback)
- **Language**: TypeScript

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Cloudinary account (for images)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/thriftbackend.git
cd thriftbackend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL, JWT secret, etc.

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Authentication
JWT_SECRET=your_secure_jwt_secret

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email (optional - falls back to Ethereal in development)
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password

# Client URL (for email links)
CLIENT_URL=http://localhost:3000
```

---

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `GET /auth/me` - Get current user
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with code
- `POST /auth/verify-email` - Verify email address

### Products (Public)
- `GET /products` - List products with filters
- `GET /products/:id` - Get product details
- `GET /products/featured` - Featured products
- `GET /products/on-sale` - Products on sale
- `GET /products/categories` - All categories

### Products (Admin)
- `GET /products/admin/all` - All products (any status)
- `GET /products/admin/:id` - Product details (any status)
- `POST /products/admin/products` - Create product
- `PUT /products/admin/:id` - Update product
- `DELETE /products/admin/:id` - Delete/archive product
- `POST /products/admin/:id/publish` - Publish draft
- `POST /products/admin/bulk/*` - Bulk operations

### Cart
- `GET /cart` - Get cart
- `POST /cart` - Add to cart
- `DELETE /cart/:id` - Remove item
- `DELETE /cart` - Clear cart
- `POST /cart/merge` - Merge guest cart on login

### Orders
- `POST /orders` - Create order
- `GET /orders` - User's orders
- `GET /orders/:id` - Order details
- `POST /orders/:id/cancel` - Cancel order

### Orders (Admin)
- `GET /orders/admin/all` - All orders
- `PUT /orders/:id/status` - Update status
- `PUT /orders/admin/bulk-update` - Bulk status update

### Wishlist
- `GET /wishlist` - Get wishlist
- `POST /wishlist/:productId` - Add to wishlist
- `DELETE /wishlist/:productId` - Remove from wishlist

### Admin
- `GET /admin/dashboard` - Dashboard stats
- `GET /admin/dashboard/sales` - Sales data
- `GET /admin/categories` - All categories
- `POST /admin/categories` - Create category
- `PUT /admin/categories/:id` - Update category
- `DELETE /admin/categories/:id` - Delete category

### Pricing (Admin)
- `GET /pricing/rules` - Pricing rules
- `POST /pricing/rules` - Create rule
- `PUT /pricing/rules/:id` - Update rule
- `DELETE /pricing/rules/:id` - Delete rule
- `POST /pricing/bulk-update` - Bulk price update

### Sales
- `GET /sales/active` - Active sales (public)
- `GET /sales` - All sales (admin)
- `POST /sales` - Create sale (admin)
- `PUT /sales/:id` - Update sale (admin)
- `DELETE /sales/:id` - Delete sale (admin)

---

## Project Structure

```
src/
  controller/       # Business logic
  routes/           # Express routers
  middlewares/      # Auth, admin, upload
  services/         # External services
  config/           # Database, cloudinary
  utils/            # JWT, mailer, logger
  generated/        # Prisma client
prisma/
  schema.prisma     # Database schema
  migrations/       # Migration history
scripts/            # Utility scripts
```

---

## Scripts

```bash
npm run dev         # Start development server
npm run build       # Build for production
npm run start       # Start production server
npm run seed        # Seed database
npm test            # Run tests
npx prisma studio   # Open Prisma Studio
```

---

## Deployment

### Build for Production

```bash
npm run build
npm start
```

### Database Migration

```bash
npx prisma migrate deploy
```

---

## License

MIT

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request
