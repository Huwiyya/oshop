'use client';

import React from 'react';
import { Search, Filter, SortAsc } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface FilterToolbarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    statusFilter: string;
    onStatusChange: (value: string) => void;
    categoryFilter: string;
    onCategoryChange: (value: string) => void;
    categories: Array<{ id: string; name_ar: string }>;
    sortBy: string;
    onSortChange: (value: string) => void;
}

export function FilterToolbar({
    searchTerm,
    onSearchChange,
    statusFilter,
    onStatusChange,
    categoryFilter,
    onCategoryChange,
    categories,
    sortBy,
    onSortChange,
}: FilterToolbarProps) {
    return (
        <div className="bg-white rounded-lg border p-4 mb-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <Input
                        placeholder="ابحث عن أصل (رقم أو اسم)..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="pr-10"
                    />
                </div>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={onStatusChange}>
                    <SelectTrigger className="w-full md:w-[180px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">جميع الحالات</SelectItem>
                        <SelectItem value="active">نشط</SelectItem>
                        <SelectItem value="disposed">متخلص منه</SelectItem>
                        <SelectItem value="under_maintenance">تحت الصيانة</SelectItem>
                    </SelectContent>
                </Select>

                {/* Category Filter */}
                <Select value={categoryFilter} onValueChange={onCategoryChange}>
                    <SelectTrigger className="w-full md:w-[200px]">
                        <SelectValue placeholder="التصنيف" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">جميع التصنيفات</SelectItem>
                        {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                                {cat.name_ar}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Sort */}
                <Select value={sortBy} onValueChange={onSortChange}>
                    <SelectTrigger className="w-full md:w-[180px]">
                        <SortAsc className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="ترتيب حسب" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="date_desc">الأحدث</SelectItem>
                        <SelectItem value="date_asc">الأقدم</SelectItem>
                        <SelectItem value="cost_desc">الأعلى تكلفة</SelectItem>
                        <SelectItem value="cost_asc">الأقل تكلفة</SelectItem>
                        <SelectItem value="name_asc">الاسم (أ-ي)</SelectItem>
                        <SelectItem value="name_desc">الاسم (ي-أ)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
