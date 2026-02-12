
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, PlusCircle, Copy, Search, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { Representative } from '@/lib/types';
import { getRepresentatives, addRepresentative, updateRepresentative, deleteRepresentative } from '@/lib/actions';
import Link from 'next/link';


const AdminRepresentativesPage = () => {
  const { toast } = useToast();
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [currentRep, setCurrentRep] = useState<Representative | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchReps = async () => {
      setIsLoading(true);
      const fetchedReps = await getRepresentatives();
      setRepresentatives(fetchedReps);
      setIsLoading(false);
    }
    fetchReps();
  }, []);

  const filteredReps = useMemo(() => {
    if (!searchQuery) {
      return representatives;
    }
    return representatives.filter(rep => {
      const query = searchQuery.toLowerCase();
      return (
        rep.name.toLowerCase().includes(query) ||
        rep.phone.includes(query)
      );
    });
  }, [representatives, searchQuery]);

  const openDialog = (rep: Representative | null = null) => {
    setCurrentRep(rep);
    setIsDialogOpen(true);
  };

  const openDeleteConfirm = (rep: Representative) => {
    setCurrentRep(rep);
    setIsDeleteConfirmOpen(true);
  };

  const generatePassword = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const generateNextUsername = () => {
    const maxRepNumber = representatives.reduce((max, rep) => {
      if (rep.username.startsWith('REP')) {
        const num = parseInt(rep.username.substring(3));
        if (!isNaN(num) && num > max) {
          return num;
        }
      }
      return max;
    }, 0);
    return `REP${maxRepNumber + 1}`;
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "تم النسخ!",
        description: "تم نسخ كلمة السر إلى الحافظة.",
      });
    });
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const repData = {
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
    };

    try {
      if (currentRep) {
        await updateRepresentative(currentRep.id, repData);
        setRepresentatives(representatives.map(u => u.id === currentRep.id ? { ...currentRep, ...repData } : u));
        toast({ title: "تم تحديث بيانات المندوب" });
      } else {
        const newRepData: Omit<Representative, 'id'> = {
          username: generateNextUsername(),
          password: generatePassword(),
          assignedOrders: 0,
          ...repData
        };
        const newRep = await addRepresentative(newRepData);
        if (newRep) {
          setRepresentatives(prev => [...prev, newRep]);
          toast({ title: "تم إضافة مندوب بنجاح" });
        } else {
          throw new Error("Failed to create representative");
        }
      }
      setIsDialogOpen(false);
      setCurrentRep(null);
    } catch (error) {
      toast({ title: "حدث خطأ", description: "فشل حفظ بيانات المندوب.", variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (currentRep) {
      try {
        await deleteRepresentative(currentRep.id);
        setRepresentatives(representatives.filter(u => u.id !== currentRep.id));
        toast({ title: "تم حذف المندوب" });
      } catch (error) {
        toast({ title: "حدث خطأ", description: "فشل حذف المندوب.", variant: 'destructive' });
      }
    }
    setIsDeleteConfirmOpen(false);
    setCurrentRep(null);
  };

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">إدارة المندوبين</h1>
        <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
          setIsDialogOpen(isOpen);
          if (!isOpen) setCurrentRep(null);
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" onClick={() => openDialog()}>
              <PlusCircle className="h-4 w-4" />
              إضافة مندوب
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]" dir='rtl'>
            <form onSubmit={handleSave}>
              <DialogHeader>
                <DialogTitle>{currentRep ? 'تعديل بيانات المندوب' : 'إضافة مندوب جديد'}</DialogTitle>
                <DialogDescription>
                  {currentRep ? 'قم بتحديث المعلومات أدناه.' : 'املأ المعلومات لإضافة مندوب جديد. سيتم إنشاء كلمة سر واسم مستخدم تلقائياً.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 text-right">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">الاسم</Label>
                  <Input id="name" name="name" defaultValue={currentRep?.name} className="col-span-3" />
                </div>
                {currentRep && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="username" className="text-right">اسم المستخدم</Label>
                    <Input id="username" name="username" defaultValue={currentRep?.username} className="col-span-3" readOnly />
                  </div>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={currentRep?.phone}
                    className="col-span-3"
                    onFocus={(e) => {
                      if (e.target.value.startsWith('0')) {
                        e.target.value = e.target.value.substring(1);
                      }
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">حفظ التغييرات</Button>
                <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <CardTitle>قائمة المندوبين</CardTitle>
            <div className="relative w-full sm:w-72">
              <Input
                placeholder="ابحث بالاسم أو رقم الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='text-right'>الاسم</TableHead>
                <TableHead className='text-right'>اسم المستخدم</TableHead>
                <TableHead className='text-right'>رقم الهاتف</TableHead>
                <TableHead className='text-right'>كلمة السر</TableHead>
                <TableHead className='text-right'>الطلبات المسندة</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filteredReps.length > 0 ? filteredReps.map((rep) => (
                <TableRow key={rep.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/representatives/${rep.id}`} className="hover:underline text-primary">
                      {rep.name}
                    </Link>
                  </TableCell>
                  <TableCell>{rep.username}</TableCell>
                  <TableCell>{rep.phone}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>********</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(rep.password)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{rep.assignedOrders}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => openDialog(rep)}>تعديل</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openDeleteConfirm(rep)} className="text-destructive focus:bg-destructive/30 focus:text-destructive-foreground">حذف</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="text-center py-10">لم يتم العثور على مندوبين.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent dir='rtl'>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من رغبتك في حذف المندوب "{currentRep?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDelete}>حذف</Button>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default AdminRepresentativesPage;
