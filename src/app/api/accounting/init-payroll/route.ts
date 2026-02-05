import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
    try {
        // 1. Ensure "Current Liabilities" (2100) exists
        const { data: currentLiab } = await supabaseAdmin
            .from('accounts')
            .select('id, account_code')
            .eq('account_code', '2100')
            .single();

        if (!currentLiab) {
            return NextResponse.json({ success: false, error: 'Current Liabilities account (2100) not found' }, { status: 400 });
        }

        // 2. Create "Accrued Salaries" (2130) if not exists
        const { data: accruedSalaries } = await supabaseAdmin
            .from('accounts')
            .select('id')
            .eq('account_code', '2130')
            .single();

        if (!accruedSalaries) {
            const { error } = await supabaseAdmin
                .from('accounts')
                .insert({
                    id: 'acc_accrued_salaries',
                    account_code: '2130',
                    name_ar: 'الرواتب والأجور المستحقة',
                    name_en: 'Accrued Salaries',
                    account_type_id: 'type_liability',
                    parent_id: currentLiab.id,
                    level: 3,
                    is_parent: true, // It acts as a parent for individual employee accounts
                    is_active: true
                });

            if (error) throw error;
        }

        return NextResponse.json({
            success: true,
            message: 'تم تهيئة حسابات الرواتب بنجاح'
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
