// lib/result-types.ts
// Result pattern for consistent error handling

/**
 * Result type للتعامل الموحد مع الأخطاء
 * بدلاً من إرجاع null أو throwing exceptions
 */
export type Result<T, E = string> =
    | { success: true; data: T }
    | { success: false; error: E };

/**
 * Paginated result type
 */
export interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

/**
 * نوع للـ pagination parameters
 */
export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

/**
 * نوع لنتائج الـ stored procedures
 */
export interface StoredProcedureResult {
    success: boolean;
    [key: string]: any;
}

/**
 * Helper function لإنشاء Result ناجح
 */
export function ok<T>(data: T): Result<T> {
    return { success: true, data };
}

/**
 * Helper function لإنشاء Result فاشل
 */
export function err<E = string>(error: E): Result<never, E> {
    return { success: false, error };
}

/**
 * Helper function لحساب pagination metadata
 */
export function calculatePagination(
    total: number,
    page: number,
    limit: number
): PaginatedResult<never>['pagination'] {
    const totalPages = Math.ceil(total / limit);
    return {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
    };
}

/**
 * Helper function لإنشاء PaginatedResult
 */
export function paginated<T>(
    data: T[],
    total: number,
    params: Required<PaginationParams>
): PaginatedResult<T> {
    return {
        data,
        pagination: calculatePagination(total, params.page, params.limit),
    };
}
