'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Product {
    id: string;
    name_ar: string;
    name_en?: string;
    sku?: string;
    current_quantity?: number;
}

interface ProductSelectorProps {
    products: Product[];
    value?: string;
    onChange: (val: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export function ProductSelector({
    products,
    value,
    onChange,
    placeholder = "اختر الصنف...",
    className,
    disabled = false
}: ProductSelectorProps) {
    const [open, setOpen] = useState(false);
    const selectedProduct = products.find(p => p.id === value);

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
                        {selectedProduct ? selectedProduct.name_ar : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="بحث عن صنف..." />
                    <CommandList>
                        <CommandEmpty>لا يوجد صنف مطابق.</CommandEmpty>
                        <CommandGroup>
                            {products.map((product) => (
                                <CommandItem
                                    key={product.id}
                                    value={`${product.name_ar} ${product.sku || ''}`}
                                    onSelect={() => {
                                        onChange(product.id === value ? "" : product.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === product.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span>{product.name_ar}</span>
                                        {product.sku && <span className="text-xs text-muted-foreground">SKU: {product.sku}</span>}
                                    </div>
                                    {product.current_quantity !== undefined && (
                                        <span className="ml-auto text-xs text-muted-foreground">
                                            ({product.current_quantity})
                                        </span>
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
