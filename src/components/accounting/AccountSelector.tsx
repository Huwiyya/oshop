'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Account {
    id: string;
    name_ar: string;
    name_en?: string;
    account_code: string;
    currency?: string;
}

interface AccountSelectorProps {
    accounts: Account[];
    value: string;
    onChange: (val: string) => void;
    onAccountSelected?: (acc: Account) => void;
    placeholder?: string;
    className?: string;
}

export function AccountSelector({
    accounts,
    value,
    onChange,
    onAccountSelected,
    placeholder = "اختر الحساب...",
    className
}: AccountSelectorProps) {
    const [open, setOpen] = useState(false);
    const selectedAccount = accounts.find(a => a.id === value);

    const commonAccounts = accounts.filter(a =>
        a.account_code.startsWith('5') ||
        a.account_code.startsWith('4') ||
        a.account_code.startsWith('2') ||
        a.account_code.startsWith('121')
    );
    const otherAccounts = accounts.filter(a =>
        !commonAccounts.find(ca => ca.id === a.id)
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    className={cn("w-full justify-between h-auto py-2 text-right font-normal", className)}
                >
                    <span className="truncate">
                        {selectedAccount ? `${selectedAccount.name_ar} (${selectedAccount.account_code})` : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="بحث عن حساب..." />
                    <CommandList>
                        <CommandEmpty>لم يتم العثور على حساب.</CommandEmpty>
                        {commonAccounts.length > 0 && (
                            <CommandGroup heading="الحسابات الشائعة">
                                {commonAccounts.slice(0, 20).map((account) => (
                                    <CommandItem
                                        key={account.id}
                                        onSelect={() => {
                                            onChange(account.id);
                                            onAccountSelected?.(account);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", value === account.id ? "opacity-100" : "opacity-0")} />
                                        <span>{account.name_ar}</span>
                                        <span className="text-xs text-slate-400 font-mono ml-auto">{account.account_code}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                        <CommandGroup heading="كافة الحسابات">
                            {otherAccounts.slice(0, 50).map((account) => (
                                <AccountItem
                                    key={account.id}
                                    account={account}
                                    isSelected={value === account.id}
                                    onSelect={() => {
                                        onChange(account.id);
                                        onAccountSelected?.(account);
                                        setOpen(false);
                                    }}
                                />
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function AccountItem({ account, isSelected, onSelect }: { account: Account, isSelected: boolean, onSelect: () => void }) {
    return (
        <CommandItem onSelect={onSelect}>
            <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
            <span>{account.name_ar}</span>
            <span className="text-xs text-slate-400 font-mono ml-auto">{account.account_code}</span>
        </CommandItem>
    );
}
