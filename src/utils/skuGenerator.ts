// SKU Generation Functions for Thrift Store

/**
 * Generate category code from category name
 * "Ethnic Wear" → "ETH"
 * "Western Wear" → "WES"
 */
export const generateCategoryCode = (category: string): string => {
  return category.substring(0, 3).toUpperCase();
};

/**
 * Generate product code from product name
 * "Vintage Cotton Kurta" → "VIN-COT"
 */
export const generateProductCode = (name: string): string => {
  const words = name.split(" ");
  if (words.length >= 2) {
    return `${words[0].substring(0, 3).toUpperCase()}-${words[1].substring(0, 3).toUpperCase()}`;
  }
  return name.substring(0, 6).toUpperCase();
};

/**
 * Generate SKU for a product
 * @param categoryCode Category code
 * @param productCode Product code  
 * @param uniqueId Unique identifier (random or sequential)
 * @returns Generated SKU (e.g., "ETH-VIN-COT-1234")
 */
export const generateSKU = (
  categoryCode: string,
  productCode: string,
  uniqueId?: string
): string => {
  const id = uniqueId || Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${categoryCode}-${productCode}-${id}`;
};

/**
 * Generate a complete SKU from product details
 * @param categoryName Category name
 * @param productName Product name
 * @returns Generated SKU
 */
export const generateProductSKU = (
  categoryName: string,
  productName: string
): string => {
  const categoryCode = generateCategoryCode(categoryName);
  const productCode = generateProductCode(productName);
  return generateSKU(categoryCode, productCode);
};

/**
 * Get default price for product condition
 * @param condition Product condition
 * @returns Default minimum price
 */
export const getDefaultPriceByCondition = (condition: string): number => {
  const defaultPrices: { [key: string]: number } = {
    "NEW_WITH_TAGS": 50.00,
    "NEW_WITHOUT_TAGS": 40.00,
    "LIKE_NEW": 30.00,
    "GOOD": 20.00,
    "FAIR": 10.00,
    "POOR": 5.00,
  };

  return defaultPrices[condition] || 15.00;
};

/**
 * Validate SKU format
 * @param sku SKU to validate
 * @returns True if valid format
 */
export const isValidSKU = (sku: string): boolean => {
  // Format: XXX-XXX-XXX-XXXX (category-product-id)
  const skuPattern = /^[A-Z]{3}-[A-Z]{3}-[A-Z]{3}-\d{4}$/;
  return skuPattern.test(sku);
};
