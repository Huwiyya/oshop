
'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Package, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { getInventoryItems } from '@/lib/inventory-actions';

interface ItemSelectorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    excludeId?: string;
}

export function ItemSelector({ value, onChange, placeholder = "اختر صنف...", excludeId }: ItemSelectorProps) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        getInventoryItems().then(data => {
            setItems(data || []);
            setIsLoading(false);
        });
    }, []);

    const selectedItem = items.find((item) => item.id === value);
    const filteredItems = excludeId ? items.filter(i => i.id !== excludeId) : items;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    <span className="truncate">
                        {selectedItem ? (
                            <div className="flex items-center gap-2">
                                {selectedItem.is_shein_card ? <CreditCard className="w-3 h-3 text-purple-600" /> : <Package className="w-3 h-3 text-blue-600" />}
                                <span>{selectedItem.name_ar}</span>
                                <span className="text-[10px] text-slate-400 font-mono">({selectedItem.item_code})</span>
                            </div>
                        ) : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                    <CommandInput placeholder="بحث عن صنف..." />
                    <CommandEmpty>لم يتم العثور على الصنف.</CommandEmpty>
                    <CommandGroup className="max-h-[300px] overflow-y-auto">
                        {filteredItems.map((item) => (
                            <CommandItem
                                key={item.id}
                                value={`${item.name_ar} ${item.item_code}`}
                                onSelect={() => {
                                    onChange(item.id);
                                    setOpen(false);
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === item.id ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        {item.is_shein_card ? <CreditCard className="w-3 h-3 text-purple-600" /> : <Package className="w-3 h-3 text-blue-600" />}
                                        <span>{item.name_ar}</span>
                                    </div>
                                    <div className="flex justify-between items-center w-full">
                                        <span className="text-[10px] text-slate-400 font-mono">{item.item_code}</span>
                                        <span className="text-[10px] bg-slate-100 px-1 rounded">رصيد: {item.quantity_on_hand}</span>
                                    </div>
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
