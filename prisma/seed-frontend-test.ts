
import { PrismaClient, ProductStatus, ItemCondition } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
    {
        name: "Vintage Cotton Kurta",
        price: 499,
        image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&h=800&fit=crop",
        badge: "NEW",
        category: "Ethnic Wear",
        subcategory: "Kurtas",
        description: "A beautiful vintage cotton kurta, perfect for summer days. Breathable fabric with traditional box print.",
        condition: ItemCondition.GOOD,
        size: "M",
        color: "Blue"
    },
    {
        name: "Pre-Loved Silk Saree",
        price: 799,
        originalRetailPrice: 1299,
        image: "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=600&h=800&fit=crop",
        badge: "SALE",
        category: "Ethnic Wear",
        subcategory: "Sarees",
        description: "Elegant silk saree with golden border. Pre-loved but in excellent condition.",
        condition: ItemCondition.LIKE_NEW,
        size: "Free Size",
        color: "Red",
        isOnSale: true,
        salePercentage: 38
    },
    {
        name: "Retro Denim Jacket",
        price: 649,
        image: "https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=600&h=800&fit=crop",
        category: "Western Wear",
        subcategory: "Jackets",
        description: "Classic 90s style denim jacket. Sturdy material with a cool retro vibe.",
        condition: ItemCondition.GOOD,
        size: "L",
        color: "Denim Blue"
    },
    {
        name: "Vintage Palazzo Pants",
        price: 399,
        image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&h=800&fit=crop",
        badge: "NEW",
        category: "Western Wear",
        subcategory: "Pants",
        description: "High-waisted palazzo pants. Very comfortable and flowy.",
        condition: ItemCondition.GOOD,
        size: "S",
        color: "Beige"
    },
    {
        name: "Classic Chikankari Top",
        price: 549,
        image: "https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=600&h=800&fit=crop",
        category: "Ethnic Wear",
        subcategory: "Tops",
        description: "Hand-embroidered Chikankari top. Delicate work on soft cotton.",
        condition: ItemCondition.GOOD,
        size: "M",
        color: "White"
    },
    {
        name: "Bohemian Maxi Dress",
        price: 699,
        originalRetailPrice: 999,
        image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=800&fit=crop",
        badge: "SALE",
        category: "Western Wear",
        subcategory: "Dresses",
        description: "Flowy bohemian maxi dress with floral prints. Perfect for beach vacations.",
        condition: ItemCondition.LIKE_NEW,
        size: "L",
        color: "Floral",
        isOnSale: true,
        salePercentage: 30
    },
    {
        name: "Vintage Wool Shawl",
        price: 899,
        image: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600&h=800&fit=crop",
        category: "Accessories",
        subcategory: "Scarves & Shawls",
        description: "Warm wool shawl with intricate patterns. Vintage collection.",
        condition: ItemCondition.GOOD,
        size: "Free Size",
        color: "Brown"
    },
    {
        name: "Upcycled Block Print Blouse",
        price: 349,
        image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=800&fit=crop",
        badge: "NEW",
        category: "Ethnic Wear",
        subcategory: "Tops",
        description: "Upcycled fabric blouse with traditional block prints.",
        condition: ItemCondition.NEW_WITH_TAGS,
        size: "S",
        color: "Mustard"
    },
    {
        name: "Handloom Cotton Dupatta",
        price: 299,
        image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&h=800&fit=crop",
        category: "Ethnic Wear",
        subcategory: "Dupattas",
        description: "Pure cotton handloom dupatta. Adds elegance to any outfit.",
        condition: ItemCondition.GOOD,
        size: "Free Size",
        color: "Green"
    },
    {
        name: "Vintage Leather Belt",
        price: 199,
        originalRetailPrice: 399,
        image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=800&fit=crop",
        badge: "SALE",
        category: "Accessories",
        subcategory: "Belts",
        description: "Genuine leather belt with vintage buckle.",
        condition: ItemCondition.FAIR,
        size: "32",
        color: "Brown",
        isOnSale: true,
        salePercentage: 50
    },
    {
        name: "Embroidered Jacket",
        price: 1299,
        image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&h=800&fit=crop",
        category: "Western Wear",
        subcategory: "Jackets",
        description: "Heavily embroidered statement jacket. A unique piece for your wardrobe.",
        condition: ItemCondition.LIKE_NEW,
        size: "M",
        color: "Multi"
    },
    {
        name: "Kalamkari Print Skirt",
        price: 549,
        image: "https://images.unsplash.com/photo-1583496661160-fb5886a0uj9a?w=600&h=800&fit=crop",
        badge: "NEW",
        category: "Western Wear",
        subcategory: "Skirts",
        description: "Cotton skirt with traditional Kalamkari art.",
        condition: ItemCondition.NEW_WITH_TAGS,
        size: "M",
        color: "Maroon"
    },
    {
        name: "Hand-painted Silk Scarf",
        price: 449,
        image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&h=800&fit=crop",
        category: "Accessories",
        subcategory: "Scarves & Shawls",
        description: "Luxurious silk scarf with hand-painted floral motifs. A piece of wearable art.",
        condition: ItemCondition.NEW_WITH_TAGS,
        size: "Free Size",
        color: "Multicolor"
    },
    {
        name: "Distressed Denim Mini Skirt",
        price: 349,
        image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=800&fit=crop",
        category: "Western Wear",
        subcategory: "Skirts",
        description: "Trendy distressed denim mini skirt. Perfect for casual outings.",
        condition: ItemCondition.GOOD,
        size: "S",
        color: "Blue"
    },
    {
        name: "Embroidered Anarkali Kurta",
        price: 999,
        image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&h=800&fit=crop",
        category: "Ethnic Wear",
        subcategory: "Kurtas",
        description: "Heavy embroidered Anarkali kurta in georgette fabric. Ideal for festive occasions.",
        condition: ItemCondition.GOOD,
        size: "L",
        color: "Pink"
    },
    {
        name: "Vintage Leather Biker Jacket",
        price: 1899,
        image: "https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=600&h=800&fit=crop",
        category: "Western Wear",
        subcategory: "Jackets",
        description: "Authentic vintage leather biker jacket. Rugged look with metal zippers.",
        condition: ItemCondition.FAIR,
        size: "M",
        color: "Black"
    },
    {
        name: "Linen Trousers",
        price: 599,
        image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&h=800&fit=crop",
        category: "Western Wear",
        subcategory: "Pants",
        description: "Breathable linen trousers in a relaxed fit. Great for summer.",
        condition: ItemCondition.LIKE_NEW,
        size: "34",
        color: "White"
    },
    {
        name: "Phulkari Dupatta",
        price: 699,
        image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&h=800&fit=crop",
        category: "Ethnic Wear",
        subcategory: "Dupattas",
        description: "Traditional Phulkari dupatta with vibrant thread work.",
        condition: ItemCondition.GOOD,
        size: "Free Size",
        color: "Orange"
    },
    {
        name: "Banarasi Silk Saree",
        price: 2499,
        image: "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=600&h=800&fit=crop",
        category: "Ethnic Wear",
        subcategory: "Sarees",
        description: "Rich Banarasi silk saree with zari border. A timeless classic.",
        condition: ItemCondition.LIKE_NEW,
        size: "Free Size",
        color: "Red"
    },
    {
        name: "Floral Summer Dress",
        price: 499,
        image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=800&fit=crop",
        category: "Western Wear",
        subcategory: "Dresses",
        description: "Lightweight cotton dress with floral print. Sleeveless and knee-length.",
        condition: ItemCondition.GOOD,
        size: "S",
        color: "Yellow"
    },
    {
        name: "Braided Leather Belt",
        price: 299,
        image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=800&fit=crop",
        category: "Accessories",
        subcategory: "Belts",
        description: "Hand-braided leather belt. Adds a rustic touch to your outfit.",
        condition: ItemCondition.GOOD,
        size: "36",
        color: "Tan"
    },
    {
        name: "Cotton Printed Kurti",
        price: 249,
        image: "https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=600&h=800&fit=crop",
        category: "Ethnic Wear",
        subcategory: "Kurtas",
        description: "Simple cotton kurti for daily wear. Comfortable and stylish.",
        condition: ItemCondition.GOOD,
        size: "M",
        color: "Green"
    },
];

const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
};

async function main() {
    console.log('🌱 Starting frontend test seed...');

    // 1. Clean existing products to avoid duplicates during testing? 
    // Maybe not clear EVERYTHING, but let's clear these specific categories if we want a clean slate 
    // or just upsert. Let's upsert categories first.

    // 2. Ensure Categories exist
    const categories = [
        { name: "Ethnic Wear", sub: ["Kurtas", "Sarees", "Tops", "Dupattas"] },
        { name: "Western Wear", sub: ["Jackets", "Pants", "Dresses", "Skirts"] },
        { name: "Accessories", sub: ["Scarves & Shawls", "Belts"] }
    ];

    const categoryMap = new Map();
    const subcategoryMap = new Map();

    for (const cat of categories) {
        const category = await prisma.category.upsert({
            where: { slug: generateSlug(cat.name) },
            update: {},
            create: {
                name: cat.name,
                slug: generateSlug(cat.name),
                description: `Collection of ${cat.name}`,
                isActive: true,
                imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=500&h=500&fit=crop"
            }
        });
        categoryMap.set(cat.name, category.id);
        console.log(`✅ Category: ${cat.name}`);

        for (const subName of cat.sub) {
            const subSlug = generateSlug(subName);
            const subcategory = await prisma.subCategory.upsert({
                where: { categoryId_slug: { slug: subSlug, categoryId: category.id } },
                // Actually generalized schema typically uses just id or compound unique. 
                // Let's rely on findFirst or just create. 
                // The schema check showed SubCategory has a composite unique on slug+categoryId? 
                // Let's check schema.prisma first to be sure about unique constraints.
                // Assuming standard generalized schema: slug is unique per category usually.
                // For safety, let's just findFirst then create/update.
                update: {},
                create: {
                    name: subName,
                    slug: subSlug,
                    categoryId: category.id,
                    isActive: true
                }
            });
            subcategoryMap.set(subName, subcategory.id);
        }
    }

    // 3. Create Products
    for (const p of products) {
        const catId = categoryMap.get(p.category);
        const subId = subcategoryMap.get(p.subcategory);
        const slug = generateSlug(p.name);
        // Add random suffix to slug to avoid collisions if re-running
        const uniqueSlug = `${slug}-${Math.floor(Math.random() * 1000)}`;

        await prisma.product.create({
            data: {
                name: p.name,
                // description: p.description,
                description: p.description,
                price: p.price,
                originalRetailPrice: p.originalRetailPrice || null,
                compareAtPrice: p.originalRetailPrice || null, // Mapping originalPrice to compareAtPrice for "SALE" logic
                condition: p.condition,
                size: p.size,
                color: p.color,
                images: [p.image], // Array of strings
                categoryId: catId,
                subcategoryId: subId,
                status: ProductStatus.ACTIVE,
                isFeatured: p.badge === "NEW", // Simple logic: NEW = Featured? Or separate. Let's just make badge logic separate.
                isOnSale: p.badge === "SALE",
                salePercentage: p.salePercentage || null,
                saleEndsAt: p.badge === "SALE" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null, // 7 days from now
                sku: `TEST-${generateSlug(p.category).substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 10000)}`,
                publishedAt: new Date(),
                stock: 1, // Default stock
                tags: [p.badge, p.category, "Thrift"].filter((t): t is string => !!t)
            }
        });
        console.log(`✨ Created Product: ${p.name}`);
    }

    console.log('🎉 Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
