'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

export function ListFilter({
    placeholder = "بحث...",
    showDateFilter = true
}: {
    placeholder?: string,
    showDateFilter?: boolean
}) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [startDate, setStartDate] = useState(searchParams.get('from') || '');
    const [endDate, setEndDate] = useState(searchParams.get('to') || '');

    function handleSearch() {
        const params = new URLSearchParams(searchParams);

        if (query) params.set('q', query);
        else params.delete('q');

        if (startDate) params.set('from', startDate);
        else params.delete('from');

        if (endDate) params.set('to', endDate);
        else params.delete('to');

        router.push(`?${params.toString()}`);
    }

    function handleReset() {
        setQuery('');
        setStartDate('');
        setEndDate('');
        router.push('?');
    }

    return (
        <div className="flex flex-wrap items-end gap-3 bg-white p-3 rounded-lg border shadow-sm mb-6">
            <div className="w-full md:w-64 space-y-1">
                <span className="text-xs text-slate-500 font-medium">بحث</span>
                <div className="relative">
                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder={placeholder}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        className="pl-8"
                    />
                </div>
            </div>

            {showDateFilter && (
                <>
                    <div className="space-y-1">
                        <span className="text-xs text-slate-500 font-medium">من تاريخ</span>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-40"
                        />
                    </div>
                    <div className="space-y-1">
                        <span className="text-xs text-slate-500 font-medium">إلى تاريخ</span>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-40"
                        />
                    </div>
                </>
            )}

            <div className="flex gap-2 mr-auto md:mr-0 self-end">
                <Button onClick={handleSearch} className="bg-slate-800 text-white hover:bg-slate-700">
                    بحث
                </Button>
                {(query || startDate || endDate) && (
                    <Button variant="ghost" onClick={handleReset} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
