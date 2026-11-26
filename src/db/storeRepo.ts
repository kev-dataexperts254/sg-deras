import { asc, desc, eq } from 'drizzle-orm';
import { CORE_CATEGORIES, STARTER_PRODUCTS } from '../data/seedCatalog.ts';
import type {
  CategoryItem,
  DeliveryMethod,
  Order,
  OrderItemSnapshot,
  OrderStatus,
  Product,
} from '../types.ts';
import { db } from './index.ts';
import { adminCredentials, categories, orders, products } from './schema.ts';

export interface StoredAdminCredential {
  username: string;
  salt: string;
  passwordHash: string;
  updatedAt: string;
}

function dbError(action: string, error: unknown): never {
  console.error(`Database query failed (${action}):`, error);
  throw new Error('Database query failed. Please try again later.', { cause: error });
}

function mapCategoryRow(row: typeof categories.$inferSelect): CategoryItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    image: row.image,
    sortOrder: row.sortOrder,
    active: row.active,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapProductRow(row: typeof products.$inferSelect): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    price: row.price,
    salePrice: row.salePrice,
    stock: row.stock,
    images: Array.isArray(row.images) ? row.images : [],
    variants: Array.isArray(row.variants) ? row.variants : ['Standard'],
    isNewArrival: row.isNewArrival,
    isBestSeller: row.isBestSeller,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapOrderRow(row: typeof orders.$inferSelect): Order {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    deliveryLocation: row.deliveryLocation,
    notes: row.notes,
    deliveryMethod: row.deliveryMethod as DeliveryMethod,
    status: row.status as OrderStatus,
    items: Array.isArray(row.items) ? row.items : [],
    totalAmount: row.totalAmount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCategories(): Promise<CategoryItem[]> {
  try {
    const rows = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name));
    return rows.map(mapCategoryRow);
  } catch (error) {
    dbError('listCategories', error);
  }
}

export async function listProducts(): Promise<Product[]> {
  try {
    const rows = await db.select().from(products).orderBy(desc(products.createdAt));
    return rows.map(mapProductRow);
  } catch (error) {
    dbError('listProducts', error);
  }
}

export async function seedCatalogIfEmpty(): Promise<{
  categories: CategoryItem[];
  products: Product[];
  seeded: boolean;
}> {
  try {
    let existingCats = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name));
    let existingProds = await db.select().from(products).orderBy(desc(products.createdAt));
    let seeded = false;

    if (existingCats.length === 0) {
      await db
        .insert(categories)
        .values(
          CORE_CATEGORIES.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            image: c.image,
            sortOrder: c.sortOrder,
            active: c.active,
          }))
        )
        .onConflictDoNothing();
      seeded = true;
      existingCats = await db
        .select()
        .from(categories)
        .orderBy(asc(categories.sortOrder), asc(categories.name));
    }

    if (existingProds.length === 0) {
      await db
        .insert(products)
        .values(
          STARTER_PRODUCTS.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            description: p.description,
            price: p.price,
            salePrice: p.salePrice,
            stock: p.stock,
            images: p.images,
            variants: p.variants,
            isNewArrival: p.isNewArrival,
            isBestSeller: p.isBestSeller,
            active: p.active,
          }))
        )
        .onConflictDoNothing();
      seeded = true;
      existingProds = await db.select().from(products).orderBy(desc(products.createdAt));
    }

    return {
      categories: existingCats.map(mapCategoryRow),
      products: existingProds.map(mapProductRow),
      seeded,
    };
  } catch (error) {
    dbError('seedCatalogIfEmpty', error);
  }
}

export async function upsertStarterCatalog(): Promise<{
  categories: CategoryItem[];
  products: Product[];
}> {
  try {
    for (const c of CORE_CATEGORIES) {
      await db
        .insert(categories)
        .values({
          id: c.id,
          name: c.name,
          description: c.description,
          image: c.image,
          sortOrder: c.sortOrder,
          active: c.active,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: categories.id,
          set: {
            name: c.name,
            description: c.description,
            image: c.image,
            sortOrder: c.sortOrder,
            active: c.active,
            updatedAt: new Date(),
          },
        });
    }

    for (const p of STARTER_PRODUCTS) {
      await db
        .insert(products)
        .values({
          id: p.id,
          name: p.name,
          category: p.category,
          description: p.description,
          price: p.price,
          salePrice: p.salePrice,
          stock: p.stock,
          images: p.images,
          variants: p.variants,
          isNewArrival: p.isNewArrival,
          isBestSeller: p.isBestSeller,
          active: p.active,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: products.id,
          set: {
            name: p.name,
            category: p.category,
            description: p.description,
            price: p.price,
            salePrice: p.salePrice,
            stock: p.stock,
            images: p.images,
            variants: p.variants,
            isNewArrival: p.isNewArrival,
            isBestSeller: p.isBestSeller,
            active: p.active,
            updatedAt: new Date(),
          },
        });
    }

    return {
      categories: await listCategories(),
      products: await listProducts(),
    };
  } catch (error) {
    dbError('upsertStarterCatalog', error);
  }
}

export async function upsertProduct(input: Product): Promise<Product> {
  try {
    const now = new Date();
    const [row] = await db
      .insert(products)
      .values({
        id: input.id,
        name: input.name,
        category: input.category,
        description: input.description,
        price: input.price,
        salePrice: input.salePrice,
        stock: input.stock,
        images: input.images,
        variants: input.variants,
        isNewArrival: input.isNewArrival,
        isBestSeller: input.isBestSeller,
        active: input.active,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: products.id,
        set: {
          name: input.name,
          category: input.category,
          description: input.description,
          price: input.price,
          salePrice: input.salePrice,
          stock: input.stock,
          images: input.images,
          variants: input.variants,
          isNewArrival: input.isNewArrival,
          isBestSeller: input.isBestSeller,
          active: input.active,
          updatedAt: now,
        },
      })
      .returning();

    return mapProductRow(row);
  } catch (error) {
    dbError('upsertProduct', error);
  }
}

export async function updateProductStock(productId: string, nextStock: number): Promise<Product | null> {
  try {
    const [row] = await db
      .update(products)
      .set({
        stock: Math.max(0, nextStock),
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId))
      .returning();

    return row ? mapProductRow(row) : null;
  } catch (error) {
    dbError('updateProductStock', error);
  }
}

export async function deleteProductById(productId: string): Promise<boolean> {
  try {
    const deleted = await db
      .delete(products)
      .where(eq(products.id, productId))
      .returning({ id: products.id });
    return deleted.length > 0;
  } catch (error) {
    dbError('deleteProductById', error);
  }
}

export async function upsertCategory(input: CategoryItem): Promise<CategoryItem> {
  try {
    const now = new Date();
    const [row] = await db
      .insert(categories)
      .values({
        id: input.id,
        name: input.name,
        description: input.description,
        image: input.image,
        sortOrder: input.sortOrder,
        active: input.active,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          name: input.name,
          description: input.description,
          image: input.image,
          sortOrder: input.sortOrder,
          active: input.active,
          updatedAt: now,
        },
      })
      .returning();

    return mapCategoryRow(row);
  } catch (error) {
    dbError('upsertCategory', error);
  }
}

export async function deleteCategoryById(catId: string): Promise<boolean> {
  try {
    const deleted = await db
      .delete(categories)
      .where(eq(categories.id, catId))
      .returning({ id: categories.id });
    return deleted.length > 0;
  } catch (error) {
    dbError('deleteCategoryById', error);
  }
}

export async function listOrders(): Promise<Order[]> {
  try {
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
    return rows.map(mapOrderRow);
  } catch (error) {
    dbError('listOrders', error);
  }
}

export async function createOrder(input: {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryLocation: string;
  notes: string;
  deliveryMethod: DeliveryMethod;
  items: OrderItemSnapshot[];
  totalAmount: number;
}): Promise<Order> {
  try {
    const now = new Date();
    const [row] = await db
      .insert(orders)
      .values({
        id: input.id,
        orderNumber: input.orderNumber,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        deliveryLocation: input.deliveryLocation,
        notes: input.notes,
        deliveryMethod: input.deliveryMethod,
        status: 'Pending',
        items: input.items,
        totalAmount: input.totalAmount,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return mapOrderRow(row);
  } catch (error) {
    dbError('createOrder', error);
  }
}

export async function updateOrderStatusById(orderId: string, status: OrderStatus): Promise<Order | null> {
  try {
    const [row] = await db
      .update(orders)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    return row ? mapOrderRow(row) : null;
  } catch (error) {
    dbError('updateOrderStatusById', error);
  }
}

export async function getStoredAdminCredFromDb(): Promise<StoredAdminCredential | null> {
  try {
    const rows = await db
      .select()
      .from(adminCredentials)
      .where(eq(adminCredentials.id, 'primary'))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return {
      username: row.username,
      salt: row.salt,
      passwordHash: row.passwordHash,
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch (error) {
    dbError('getStoredAdminCredFromDb', error);
  }
}

export async function saveStoredAdminCredToDb(cred: StoredAdminCredential): Promise<void> {
  try {
    await db
      .insert(adminCredentials)
      .values({
        id: 'primary',
        username: cred.username,
        salt: cred.salt,
        passwordHash: cred.passwordHash,
        updatedAt: new Date(cred.updatedAt),
      })
      .onConflictDoUpdate({
        target: adminCredentials.id,
        set: {
          username: cred.username,
          salt: cred.salt,
          passwordHash: cred.passwordHash,
          updatedAt: new Date(cred.updatedAt),
        },
      });
  } catch (error) {
    dbError('saveStoredAdminCredToDb', error);
  }
}
