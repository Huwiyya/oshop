'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Account {
    id: string;
    name_ar: string;
    name_en?: string;
    account_code?: string; // Made optional
    code?: string;         // Added code for V2
    currency?: string;
    level?: number;
    is_group?: boolean; // Added is_group for better filtering
}

interface AccountSelectorProps {
    accounts: Account[];
    value: string;
    onChange: (val: string) => void;
    onAccountSelected?: (acc: Account) => void;
    placeholder?: string;
    className?: string;

    category?: 'all' | 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'supplier' | 'customer';
    onCreate?: (name: string) => void;
    showAllLevels?: boolean; // If true, shows groups + active accounts. If false, shows only active leaf accounts.
    disabled?: boolean;
}

export function AccountSelector({
    accounts,
    value,
    onChange,
    onAccountSelected,
    placeholder = "اختر الحساب...",
    className,
    category = 'all',
    onCreate,
    showAllLevels = false,
    disabled = false
}: AccountSelectorProps) {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const selectedAccount = accounts.find(a => a.id === value);

    const getCode = (a: Account) => a.code || a.account_code || '';

    // Filter Logic:
    // If showAllLevels is true, show everything (groups + children)
    // If showAllLevels is false, show ONLY transactional accounts (is_group === false)
    // Fallback: If is_group is undefined, use Level >= 4 as legacy fallback
    let analyticalAccounts = showAllLevels
        ? accounts
        : accounts.filter(a => {
            if (typeof a.is_group === 'boolean') return !a.is_group;
            return (a.level || 0) >= 4; // Legacy fallback
        });

    // Context-Aware Filtering
    // Using startsWith safely
    if (category === 'supplier') {
        analyticalAccounts = analyticalAccounts.filter(a => getCode(a).startsWith('211')); // Payables
    } else if (category === 'customer') {
        analyticalAccounts = analyticalAccounts.filter(a => getCode(a).startsWith('112')); // Receivables
    } else if (category === 'asset') {
        analyticalAccounts = analyticalAccounts.filter(a => getCode(a).startsWith('1'));
    } else if (category === 'liability') {
        analyticalAccounts = analyticalAccounts.filter(a => getCode(a).startsWith('2'));
    } else if (category === 'equity') {
        analyticalAccounts = analyticalAccounts.filter(a => getCode(a).startsWith('3'));
    } else if (category === 'revenue') {
        analyticalAccounts = analyticalAccounts.filter(a => getCode(a).startsWith('4'));
    } else if (category === 'expense') {
        analyticalAccounts = analyticalAccounts.filter(a => getCode(a).startsWith('5'));
    }

    // Grouping Logic (Simplified if filtering is active)
    const showCommonGroups = category === 'all';

    const commonAccounts = showCommonGroups ? analyticalAccounts.filter(a => {
        const code = getCode(a);
        return code.startsWith('5') ||
            code.startsWith('4') ||
            code.startsWith('211') ||
            code.startsWith('112');
    }) : [];

    const otherAccounts = showCommonGroups
        ? analyticalAccounts.filter(a => !commonAccounts.find(ca => ca.id === a.id))
        : analyticalAccounts;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    disabled={disabled}
                    className={cn("w-full justify-between h-auto py-2 text-right font-normal", className)}
                >
                    <span className="truncate">
                        {selectedAccount ? `${selectedAccount.name_ar} (${getCode(selectedAccount)})` : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={true}>
                    <CommandInput
                        placeholder={onCreate ? `بحث أو إنشاء...` : "بحث عن حساب..."}
                        onValueChange={setSearchTerm}
                    />
                    <CommandList>
                        <CommandEmpty>
                            <div className="p-2 text-center">
                                <p className="text-sm text-muted-foreground mb-2">لا يوجد حساب مطابق.</p>
                                {onCreate && searchTerm && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="w-full flex items-center gap-2"
                                        onClick={() => {
                                            onCreate(searchTerm);
                                            setOpen(false);
                                        }}
                                    >
                                        <Plus className="h-4 w-4" />
                                        إنشاء "{searchTerm}"
                                    </Button>
                                )}
                            </div>
                        </CommandEmpty>

                        {showCommonGroups && commonAccounts.length > 0 && (
                            <CommandGroup heading="الحسابات الشائعة">
                                {commonAccounts.map((account) => (
                                    <CommandItem
                                        key={account.id}
                                        value={`${account.name_ar} ${getCode(account)} ${account.name_en || ''}`}
                                        onSelect={() => {
                                            console.log('AccountSelector: Selected', account.id, account.name_ar);
                                            onChange(account.id);
                                            onAccountSelected?.(account);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", value === account.id ? "opacity-100" : "opacity-0")} />
                                        <div className="flex flex-col">
                                            <span>{account.name_ar}</span>
                                            {account.name_en && <span className="text-xs text-muted-foreground">{account.name_en}</span>}
                                        </div>
                                        <span className="font-mono font-bold ml-auto text-primary">{getCode(account)}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        <CommandGroup heading={showCommonGroups ? "باقي الحسابات" : "الحسابات"}>
                            {otherAccounts.map((account) => (
                                <CommandItem
                                    key={account.id}
                                    value={`${account.name_ar} ${getCode(account)} ${account.name_en || ''}`}
                                    onSelect={() => {
                                        console.log('AccountSelector: Selected (Other)', account.id, account.name_ar);
                                        onChange(account.id);
                                        onAccountSelected?.(account);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", value === account.id ? "opacity-100" : "opacity-0")} />
                                    <div className="flex flex-col">
                                        <span>{account.name_ar}</span>
                                        {account.name_en && <span className="text-xs text-muted-foreground">{account.name_en}</span>}
                                    </div>
                                    <span className="font-mono font-bold ml-auto text-primary">{getCode(account)}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function AccountItem({ account, isSelected, onSelect }: { account: Account, isSelected: boolean, onSelect: () => void }) {
    const code = account.code || account.account_code || '';
    return (
        <CommandItem onSelect={onSelect}>
            <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
            <span>{account.name_ar}</span>
            <span className="text-xs text-slate-400 font-mono ml-auto">{code}</span>
        </CommandItem>
    );
}
