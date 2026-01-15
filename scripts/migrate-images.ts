
import { PrismaClient } from '../src/generated/prisma';
import cloudinary from '../src/config/cloudinary';

const prisma = new PrismaClient();

const uploadUrlToCloudinary = async (url: string, folder: string = 'products') => {
    try {
        const result = await cloudinary.uploader.upload(url, {
            folder: `licrorice/${folder}`,
            resource_type: 'image',
            transformation: [
                { width: 1000, height: 1000, crop: 'limit' },
                { quality: 'auto:good' },
                { fetch_format: 'auto' },
            ],
        });
        return {
            url: result.secure_url,
            public_id: result.public_id,
        };
    } catch (error) {
        console.error(`Failed to upload URL ${url}:`, error);
        return null;
    }
};

async function migrateImages() {
    console.log('🚀 Starting image migration script...');

    try {
        // 1. Fetch all products
        const products = await prisma.product.findMany();
        console.log(`📦 Found ${products.length} products to check.`);

        let deletedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const product of products) {
            // Check if product has no images
            if (!product.images || product.images.length === 0) {
                console.log(`🗑️ Deleting product ${product.name} (ID: ${product.id}) - No images`);
                await prisma.product.delete({ where: { id: product.id } });
                deletedCount++;
                continue;
            }

            // Check for Unsplash links
            const newImages: string[] = [];
            const newCloudinaryIds: string[] = [...product.cloudinaryIds]; // Keep existing IDs
            let needsUpdate = false;

            for (const imgUrl of product.images) {
                if (imgUrl.includes('images.unsplash.com')) {
                    console.log(`🔄 Migrating image for ${product.name}: ${imgUrl}`);
                    const uploadResult = await uploadUrlToCloudinary(imgUrl);

                    if (uploadResult) {
                        newImages.push(uploadResult.url);
                        newCloudinaryIds.push(uploadResult.public_id);
                        needsUpdate = true;
                    } else {
                        // If upload fails, maybe keep original? Or skip?
                        // User put "delete product which don't have any entry image"
                        // If we fail to upload valid unsplash link, effectively we lose the image.
                        console.warn(`⚠️ Failed to migrate image for ${product.name}. Keeping original URL.`);
                        newImages.push(imgUrl);
                    }
                } else {
                    // Already likely cloudinary or other
                    newImages.push(imgUrl);
                }
            }

            // If we made changes, update the product
            if (needsUpdate) {
                await prisma.product.update({
                    where: { id: product.id },
                    data: {
                        images: newImages,
                        cloudinaryIds: newCloudinaryIds,
                    },
                });
                console.log(`✅ Updated product ${product.name}`);
                updatedCount++;
            } else {
                skippedCount++;
            }
        }

        console.log('\n==========================================');
        console.log(`🎉 Migration Completed!`);
        console.log(`Updated: ${updatedCount}`);
        console.log(`Deleted: ${deletedCount}`);
        console.log(`Skipped: ${skippedCount}`);
        console.log('==========================================\n');

    } catch (error) {
        console.error('❌ Script failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migrateImages();
