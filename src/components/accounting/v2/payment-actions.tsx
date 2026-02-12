'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { deletePaymentV2 } from '@/lib/treasury-v2-actions';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import Link from 'next/link';

export function PaymentActionsV2({ id, reference }: { id: string, reference: string }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleDelete = async () => {
        setLoading(true);
        try {
            const result = await deletePaymentV2(id);
            if (result.success) {
                toast({ title: 'تم الحذف بنجاح', description: 'تم حذف سند الصرف والقيد المرتبط' });
                setOpen(false);
            } else {
                toast({ title: 'خطأ', description: result.error, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center gap-2">
            {/* Edit Button - Placeholder for now, can perform redirect */}
            <Link href={`/accounting/payments-v2/edit/${id}`}>
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-slate-500 hover:text-slate-700">
                    <Edit className="w-3.5 h-3.5" />
                    تعديل
                </Button>
            </Link>

            {/* Delete Dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>حذف سند الصرف</DialogTitle>
                        <DialogDescription>
                            هل أنت متأكد من حذف سند الصرف رقم <span className="font-mono font-bold">{reference}</span>؟
                            <br />
                            سيتم أيضاً حذف القيد المحاسبي المرتبط به وتحديث الأرصدة.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                            {loading ? 'جاري الحذف...' : 'تأكيد الحذف'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
