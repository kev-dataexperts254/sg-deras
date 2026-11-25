# SG Collections — Firestore Security Specification

## 1. Data Invariants
1. **Admin-Only Catalog Mutations**: Only verified store administrators (`email_verified == true` and authorized admin email or `/admins/{uid}` record) can create, update, or delete `/products/{productId}` and `/categories/{categoryId}`.
2. **PII Isolation on Orders**: Customer names, phone numbers, and delivery locations stored in `/orders/{orderId}` are strictly unreadable (`get` and `list` denied) to unauthenticated users and non-admin accounts.
3. **Order Initial State Integrity**: Any newly submitted storefront order in `/orders/{orderId}` must start with `status == "Pending"`, bounded item count (`1..50`), positive `totalAmount`, valid `deliveryMethod`, and server timestamps (`request.time`).
4. **Strict Key & Size Containment**: Every document enforces exact `hasAll` / `hasOnly` key allowlists, ID regex `^[a-zA-Z0-9_-]+$`, and explicit `.size()` bounds on all strings and lists.
5. **Immutable Audit Fields**: `id` and `createdAt` cannot be modified after creation.

## 2. Adversarial "Dirty Dozen" Payloads (All Must Return `PERMISSION_DENIED`)
1. **Unverified Admin Email Spoof**: Write to `/products/p1` with matching admin email where `email_verified == false`.
2. **Non-Admin Product Create**: Signed-in regular user attempts to create `/products/p2`.
3. **Shadow Field Injection on Product**: Admin attempts to create `/products/p3` with extra ghost field `isVerified: true`.
4. **Oversized ID Poisoning**: Attempt to write `/products/${"a".repeat(200)}` (fails `isValidId`).
5. **Negative Price / Invalid Sale Price**: Admin attempts to write product with `price: -500` or `salePrice >= price`.
6. **Public Order Scraping (`list`)**: Unauthenticated or non-admin user runs `getDocs(collection(db, "orders"))`.
7. **Public Order Read (`get`)**: Non-admin user attempts `getDoc(doc(db, "orders", "ord_1"))`.
8. **Order Status Bypass on Create**: Customer submits `/orders/ord_2` with `status: "Delivered"` instead of `"Pending"`.
9. **Order Ghost Field Injection**: Customer submits `/orders/ord_3` with extra field `adminNote: "free"`.
10. **Customer Order Update Tampering**: Customer attempts to `updateDoc` an existing order to change `totalAmount` or `status`.
11. **Self-Assigned Admin Escalation**: Non-admin user attempts to create `/admins/{myUid}` with `role: "admin"`.
12. **Client Timestamp Forgery**: Payload supplies a backdated `createdAt` instead of `serverTimestamp()` (`request.time`).
