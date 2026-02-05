# Implementation Plan - Treasury & Hybrid Deduction

## Goal
Remove Inventory management, introduce USDT Treasury (Wallet), and implement hybrid cost deduction (Shein Card + USDT) for orders.

## Database Changes
### [NEW] `treasury_transactions_v4`
- `id` (uuid)
- `amount` (float)
- `type` ('deposit' | 'withdrawal')
- `description` (text)
- `relatedOrderId` (text, optional)
- `createdAt` (timestamp)

### [MODIFY] `system_settings`
- Add `usdt_treasury_balance` column to `system_settings` (singleton).

## Backend Changes (`actions.ts`)
1.  **Treasury Management**:
    -   `getTreasuryBalance()`
    -   `addTreasuryFunds(amount, notes)`
    -   `processCostDeduction(orderId, totalCost, selectedCardId?)`
        -   Transaction logic:
            1. If `selectedCardId`:
                - Deduct `min(balance, cost)` from card.
                - `cost -= deducted`.
            2. If `cost > 0`:
                - Deduct `cost` from Treasury.
                - Check sufficient funds? (User implied auto-deduct, so we assume yes or fail if not enough).

## Frontend Changes
### 1. `src/app/admin/shein-cards/page.tsx`
- Add "USDT Treasury" Section:
    - Display Balance.
    - "Add Funds" Button.
    - Rename Page Header to "إدارة البطاقات والخزينة" (Cards & Treasury).

### 2. `src/app/admin/orders/add/form.tsx`
- **Remove** Deduction Radio Group.
- **Add** "Shein Card" Select (Optional).
- **Add** Summary Component:
    - Total Cost.
    - Paid via Card.
    - Paid via Treasury.

### 3. Cleanup
- Remove Inventory from Navigation.
