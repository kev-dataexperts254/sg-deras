import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { OrderItemSnapshot } from '../types.ts';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  image: text('image').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  salePrice: integer('sale_price').notNull().default(0),
  stock: integer('stock').notNull().default(0),
  images: jsonb('images').$type<string[]>().notNull(),
  variants: jsonb('variants').$type<string[]>().notNull(),
  isNewArrival: boolean('is_new_arrival').notNull().default(false),
  isBestSeller: boolean('is_best_seller').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  deliveryLocation: text('delivery_location').notNull(),
  notes: text('notes').notNull().default(''),
  deliveryMethod: text('delivery_method').notNull(),
  status: text('status').notNull().default('Pending'),
  items: jsonb('items').$type<OrderItemSnapshot[]>().notNull(),
  totalAmount: integer('total_amount').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const adminCredentials = pgTable('admin_credentials', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  salt: text('salt').notNull(),
  passwordHash: text('password_hash').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
