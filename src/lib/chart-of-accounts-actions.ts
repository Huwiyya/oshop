import { supabaseAdmin } from './supabase-admin'
import type { AccountV2 } from './accounting-v2-types'
import { unstable_noStore as noStore } from 'next/cache'

interface AccountWithChildren extends AccountV2 {
    children: AccountWithChildren[]
}

type ActionResponse =
    | { success: true; data: AccountWithChildren[]; flatAccounts: AccountV2[] }
    | { success: false; error: string; data?: never; flatAccounts?: never }

/**
 * Fetch Chart of Accounts with complete hierarchy
 * Uses supabaseAdmin to bypass RLS and ensure all accounts are returned
 */
export async function getChartOfAccountsTree(): Promise<ActionResponse> {
    noStore() // Prevent caching

    try {
        // Fetch ALL accounts using pagination loop
        let allAccounts: any[] = []
        let page = 0
        const pageSize = 1000
        let hasMore = true

        while (hasMore) {
            console.log(`[getChartOfAccountsTree] Fetching page ${page} (size: ${pageSize})`)

            const { data, error } = await supabaseAdmin
                .from('accounts_v2')
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1)
                .order('code', { ascending: true })

            if (error) {
                console.error('[getChartOfAccountsTree] Error fetching page:', error)
                return { success: false, error: error.message }
            }

            if (data) {
                allAccounts = [...allAccounts, ...data]
                if (data.length < pageSize) {
                    hasMore = false
                } else {
                    page++
                }
            } else {
                hasMore = false
            }
        }

        const accountsData = allAccounts

        if (accountsData.length === 0) {
            console.error('[getChartOfAccountsTree] No accounts found in database')
            return { success: false, error: 'No accounts found in database' }
        }

        console.log(`[getChartOfAccountsTree] Fetched ${accountsData.length} accounts`)
        console.log(`[getChartOfAccountsTree] Account codes:`, accountsData.map(a => a.code).join(', '))

        // Fetch account types separately
        const { data: typesData, error: typesError } = await supabaseAdmin
            .from('account_types_v2')
            .select('*')

        if (typesError) {
            console.error('[getChartOfAccountsTree] Types Error:', typesError)
            // Continue without types - we can still show accounts
        }

        // Map types to accounts
        const typesMap = new Map()
        typesData?.forEach(type => {
            typesMap.set(type.id, type)
        })

        // Combine accounts with their types
        const accounts = accountsData.map(acc => ({
            ...acc,
            account_type: typesMap.get(acc.type_id)
        }))

        console.log(`[getChartOfAccountsTree] Accounts with types:`, accounts.length)

        // Build hierarchy
        const accountMap = new Map<string, AccountWithChildren>()
        const rootAccounts: AccountWithChildren[] = []

        // First pass: create all nodes with empty children arrays
        accounts.forEach(acc => {
            accountMap.set(acc.id, { ...acc as any, children: [] })
        })

        // Second pass: build tree structure
        accounts.forEach(acc => {
            const node = accountMap.get(acc.id)!

            // Check if parent_id is truly null (not "null" string or undefined)
            const hasParent = acc.parent_id !== null && acc.parent_id !== undefined && acc.parent_id !== ''

            if (hasParent && accountMap.has(acc.parent_id)) {
                // Add to parent's children
                const parent = accountMap.get(acc.parent_id)!
                parent.children.push(node)
            } else {
                // Root account (no parent or parent not found)
                rootAccounts.push(node)
            }
        })

        console.log(`[getChartOfAccountsTree] Built tree with ${rootAccounts.length} root accounts`)
        console.log(`[getChartOfAccountsTree] Root codes:`, rootAccounts.map(a => a.code).join(', '))

        // Debug logging removed

        return {
            success: true,
            data: rootAccounts,
            flatAccounts: accounts as AccountV2[]
        }
    } catch (error) {
        console.error('[getChartOfAccountsTree] Exception:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

/**
 * Helper to categorize accounts for Balance Sheet vs Income Statement
 * NOT EXPORTED - use client-side filtering instead
 */
// Removed: export function categorizeAccounts()
// Use client-side filtering directly in the component
