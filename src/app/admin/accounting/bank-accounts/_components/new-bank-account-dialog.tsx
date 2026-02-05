'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { createBankAccount } from '@/lib/accounting-actions';
import { useRouter } from 'next/navigation';

export default function NewBankAccountDialog() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [currency, setCurrency] = useState<'LYD' | 'USD'>('LYD');
    const [accountNumber, setAccountNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async () => {
        if (!name) return;
        setIsLoading(true);
        const res = await createBankAccount({ name, currency, accountNumber });
        setIsLoading(false);

        if (res.success) {
            setOpen(false);
            setName('');
            setAccountNumber('');
            router.refresh();
        } else {
            alert('Error: ' + res.error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    حساب بنكي جديد
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>إنشاء حساب بنكي جديد</DialogTitle>
                    <DialogDescription>
                        أضف حساب مصرفي جديد للنظام.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            اسم البنك/الحساب
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                            placeholder="مثال: مصرف الجمهورية"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="currency" className="text-right">
                            العملة
                        </Label>
                        <Select value={currency} onValueChange={(val: any) => setCurrency(val)}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LYD">دينار ليبي (LYD)</SelectItem>
                                <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="accNumber" className="text-right">
                            رقم الحساب
                        </Label>
                        <Input
                            id="accNumber"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            className="col-span-3"
                            placeholder="اختياري"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button type="submit" onClick={handleSubmit} disabled={isLoading}>
                        {isLoading ? 'جاري الحفظ...' : 'إنشاء'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
