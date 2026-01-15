import {
  PrismaClient,
  ItemCondition,
  ProductStatus,
  CouponType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database with sample data...\n");

  // ==================== CATEGORIES ====================
  console.log("Creating categories...");

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: "mens-clothing" },
      update: {},
      create: {
        name: "Men's Clothing",
        slug: "mens-clothing",
        description: "Quality men's apparel",
        displayOrder: 1,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { slug: "womens-clothing" },
      update: {},
      create: {
        name: "Women's Clothing",
        slug: "womens-clothing",
        description: "Stylish women's apparel",
        displayOrder: 2,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { slug: "accessories" },
      update: {},
      create: {
        name: "Accessories",
        slug: "accessories",
        description: "Bags, jewelry, and more",
        displayOrder: 3,
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // ==================== SUBCATEGORIES ====================
  console.log("Creating subcategories...");

  const mensCategory = categories.find((c) => c.slug === "mens-clothing")!;
  const womensCategory = categories.find((c) => c.slug === "womens-clothing")!;
  const accessoriesCategory = categories.find((c) => c.slug === "accessories")!;

  const subcategories = await Promise.all([
    prisma.subCategory.upsert({
      where: { categoryId_slug: { categoryId: mensCategory.id, slug: "shirts" } },
      update: {},
      create: {
        name: "Shirts",
        slug: "shirts",
        categoryId: mensCategory.id,
        displayOrder: 1,
      },
    }),
    prisma.subCategory.upsert({
      where: { categoryId_slug: { categoryId: mensCategory.id, slug: "pants" } },
      update: {},
      create: {
        name: "Pants",
        slug: "pants",
        categoryId: mensCategory.id,
        displayOrder: 2,
      },
    }),
    prisma.subCategory.upsert({
      where: { categoryId_slug: { categoryId: womensCategory.id, slug: "dresses" } },
      update: {},
      create: {
        name: "Dresses",
        slug: "dresses",
        categoryId: womensCategory.id,
        displayOrder: 1,
      },
    }),
    prisma.subCategory.upsert({
      where: { categoryId_slug: { categoryId: accessoriesCategory.id, slug: "bags" } },
      update: {},
      create: {
        name: "Bags",
        slug: "bags",
        categoryId: accessoriesCategory.id,
        displayOrder: 1,
      },
    }),
  ]);

  console.log(`✅ Created ${subcategories.length} subcategories`);

  // ==================== PRODUCTS ====================
  console.log("Creating products...");

  const shirtsSubcategory = subcategories.find((s) => s.slug === "shirts")!;
  const pantsSubcategory = subcategories.find((s) => s.slug === "pants")!;
  const dressesSubcategory = subcategories.find((s) => s.slug === "dresses")!;
  const bagsSubcategory = subcategories.find((s) => s.slug === "bags")!;

  // Helper to generate unique SKU
  const generateSKU = (category: string, name: string) => {
    const prefix = category.substring(0, 3).toUpperCase();
    const suffix = name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 6).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${suffix}-${random}`;
  };

  // Product with variants (new product - no condition)
  const tshirtProduct = await prisma.product.upsert({
    where: { sku: "MEN-TSHIRT-BASE" },
    update: {},
    create: {
      name: "Classic Cotton T-Shirt",
      description: "Premium soft cotton t-shirt available in multiple colors and sizes.",
      price: 29.99,
      originalRetailPrice: 45.00,
      brand: "Basics Co",
      material: "100% Cotton",
      categoryId: mensCategory.id,
      subcategoryId: shirtsSubcategory.id,
      stock: 0, // Stock managed at variant level
      status: ProductStatus.ACTIVE,
      tags: ["cotton", "casual", "basic", "everyday"],
      sku: "MEN-TSHIRT-BASE",
      images: [],
    },
  });

  // Create variants for the t-shirt
  const tshirtVariants = [
    { size: "S", color: "White", stock: 10 },
    { size: "M", color: "White", stock: 15 },
    { size: "L", color: "White", stock: 12 },
    { size: "S", color: "Black", stock: 8 },
    { size: "M", color: "Black", stock: 20 },
    { size: "L", color: "Black", stock: 14 },
    { size: "M", color: "Navy", stock: 10 },
    { size: "L", color: "Navy", stock: 6 },
  ];

  for (const variant of tshirtVariants) {
    const variantSku = `TSH-${variant.color.toUpperCase().substring(0, 3)}-${variant.size}`;
    await prisma.productVariant.upsert({
      where: { sku: variantSku },
      update: { stock: variant.stock },
      create: {
        productId: tshirtProduct.id,
        sku: variantSku,
        name: `${variant.color} / ${variant.size}`,
        size: variant.size,
        color: variant.color,
        stock: variant.stock,
        lowStockThreshold: 5,
        isActive: true,
      },
    });
  }

  console.log(`✅ Created T-Shirt with ${tshirtVariants.length} variants`);

  // Thrift product (with condition)
  const thriftProducts = [
    {
      name: "Vintage Leather Jacket",
      description: "Classic brown leather jacket from the 90s. Minor wear adds character.",
      price: 89.99,
      originalRetailPrice: 250.00,
      condition: ItemCondition.GOOD,
      size: "M",
      brand: "Wilson's Leather",
      color: "Brown",
      material: "Genuine Leather",
      categoryId: mensCategory.id,
      subcategoryId: null,
      stock: 1, // Unique thrift item
      status: ProductStatus.ACTIVE,
      tags: ["vintage", "leather", "90s", "jacket"],
      sku: generateSKU("MEN", "VintageLeather"),
    },
    {
      name: "Designer Silk Dress",
      description: "Beautiful silk dress in excellent condition. Perfect for special occasions.",
      price: 65.00,
      originalRetailPrice: 450.00,
      condition: ItemCondition.LIKE_NEW,
      size: "S",
      brand: "Diane von Furstenberg",
      color: "Red",
      material: "100% Silk",
      categoryId: womensCategory.id,
      subcategoryId: dressesSubcategory.id,
      stock: 1,
      status: ProductStatus.ACTIVE,
      tags: ["silk", "designer", "occasion", "dress"],
      sku: generateSKU("WOM", "SilkDress"),
    },
    {
      name: "Coach Leather Handbag",
      description: "Authentic Coach handbag with some light patina. Adds to the charm!",
      price: 75.00,
      originalRetailPrice: 350.00,
      condition: ItemCondition.GOOD,
      brand: "Coach",
      color: "Tan",
      material: "Leather",
      categoryId: accessoriesCategory.id,
      subcategoryId: bagsSubcategory.id,
      stock: 1,
      status: ProductStatus.ACTIVE,
      tags: ["coach", "handbag", "leather", "designer"],
      sku: generateSKU("ACC", "CoachBag"),
    },
  ];

  for (const product of thriftProducts) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }

  console.log(`✅ Created ${thriftProducts.length} thrift products`);

  // ==================== COUPONS ====================
  console.log("Creating coupons...");

  const coupons = await Promise.all([
    prisma.coupon.upsert({
      where: { code: "WELCOME10" },
      update: {},
      create: {
        code: "WELCOME10",
        description: "10% off your first order",
        type: CouponType.PERCENTAGE,
        value: 10,
        minimumOrderAmount: 25,
        perUserLimit: 1,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        isActive: true,
      },
    }),
    prisma.coupon.upsert({
      where: { code: "FREESHIP" },
      update: {},
      create: {
        code: "FREESHIP",
        description: "Free shipping on orders over $50",
        type: CouponType.FREE_SHIPPING,
        value: 0,
        minimumOrderAmount: 50,
        usageLimit: 1000,
        perUserLimit: 3,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        isActive: true,
      },
    }),
    prisma.coupon.upsert({
      where: { code: "SAVE20" },
      update: {},
      create: {
        code: "SAVE20",
        description: "$20 off orders over $100",
        type: CouponType.FIXED_AMOUNT,
        value: 20,
        minimumOrderAmount: 100,
        maximumDiscount: 20,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ Created ${coupons.length} coupons`);

  // ==================== PRICING CONFIG ====================
  console.log("Creating pricing configuration...");

  await prisma.pricingConfig.upsert({
    where: { id: "default-config" },
    update: {},
    create: {
      id: "default-config",
      defaultMarkupPercent: 30,
      minimumMargin: 10,
      roundingRule: "nearest_99",
      minPriceNewWithTags: 15.0,
      minPriceNewWithoutTags: 12.0,
      minPriceLikeNew: 10.0,
      minPriceGood: 8.0,
      minPriceFair: 5.0,
      minPricePoor: 3.0,
    },
  });

  console.log("✅ Created pricing configuration");

  // ==================== SUMMARY ====================
  console.log("\n🎉 Database seeding completed!");
  console.log("📊 Summary:");
  console.log(`   - Categories: ${categories.length}`);
  console.log(`   - Subcategories: ${subcategories.length}`);
  console.log(`   - Products: ${thriftProducts.length + 1} (1 with ${tshirtVariants.length} variants)`);
  console.log(`   - Coupons: ${coupons.length}`);
  console.log("   - Pricing Config: 1");
  console.log("\n💡 Sample Data Includes:");
  console.log("   - New product with variants (T-Shirt in multiple sizes/colors)");
  console.log("   - Thrift products with condition (Vintage Leather Jacket, Silk Dress)");
  console.log("   - Promotional coupons (WELCOME10, FREESHIP, SAVE20)");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
