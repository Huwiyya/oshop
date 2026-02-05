'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Globe, Loader2, Search } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { GlobalSite } from '@/lib/types';
import { getGlobalSites, addGlobalSite, updateGlobalSite, deleteGlobalSite } from '@/lib/actions';
import { Card, CardContent } from "@/components/ui/card";

export default function GlobalSitesPage() {
    const { toast } = useToast();
    const [sites, setSites] = useState<GlobalSite[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [currentSiteId, setCurrentSiteId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [logo, setLogo] = useState('');

    useEffect(() => {
        fetchSites();
    }, []);

    const fetchSites = async () => {
        setIsLoading(true);
        const data = await getGlobalSites();
        setSites(data);
        setIsLoading(false);
    };

    const handleOpenDialog = (site?: GlobalSite) => {
        if (site) {
            setCurrentSiteId(site.id);
            setName(site.name);
            setUrl(site.url);
            setLogo(site.logo || '');
        } else {
            setCurrentSiteId(null);
            setName('');
            setUrl('');
            setLogo('');
        }
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!name) {
            toast({ title: "خطأ", description: "الاسم مطلوب", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            if (currentSiteId) {
                await updateGlobalSite(currentSiteId, { name, url, logo });
                toast({ title: "تم التحديث", description: "تم تحديث بيانات الموقع بنجاح" });
            } else {
                await addGlobalSite({ name, url, logo });
                toast({ title: "تم الإضافة", description: "تم إضافة الموقع الجديد بنجاح" });
            }
            setIsDialogOpen(false);
            fetchSites();
        } catch (error) {
            console.error(error);
            toast({ title: "خطأ", description: "حدث خطأ أثناء الحفظ", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string, siteName: string) => {
        if (confirm(`هل أنت متأكد من حذف موقع "${siteName}"؟`)) {
            try {
                await deleteGlobalSite(id);
                toast({ title: "تم الحذف", description: "تم حذف الموقع بنجاح" });
                fetchSites();
            } catch (error) {
                toast({ title: "خطأ", description: "فشل الحذف", variant: "destructive" });
            }
        }
    };

    const filteredSites = sites.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <h1 className="text-3xl font-bold tracking-tight">إدارة المواقع العالمية</h1>
                <Button onClick={() => handleOpenDialog()}>
                    <Plus className="w-4 h-4 ml-2" />
                    إضافة موقع جديد
                </Button>
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="بحث عن موقع..."
                                className="pr-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-right">اسم الموقع</TableHead>
                                    <TableHead className="text-right">الرابط الرئيسي</TableHead>
                                    <TableHead className="text-center">إجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">
                                            <div className="flex justify-center items-center">
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                <span className="mr-2">جاري التحميل...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredSites.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                            لا توجد مواقع مضافة حالياً
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredSites.map((site) => (
                                        <TableRow key={site.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Globe className="w-4 h-4 text-muted-foreground" />
                                                    {site.name}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline dir-ltr text-right inline-block w-full">
                                                    {site.url}
                                                </a>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-center gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(site)}>
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(site.id, site.name)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{currentSiteId ? 'تعديل موقع' : 'إضافة موقع جديد'}</DialogTitle>
                        <DialogDescription>
                            أدخل تفاصيل الموقع العالمي ليتم استخدامه في الطلبات.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>اسم الموقع</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: Shein, Amazon" />
                        </div>
                        <div className="space-y-2">
                            <Label>الرابط الرئيسي (URL)</Label>
                            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." dir="ltr" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            حفظ
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
