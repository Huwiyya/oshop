
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { MoreHorizontal, PlusCircle, Copy, Loader2, Search, Download, Phone, MapPin, CreditCard, User as UserIcon, Wallet, Edit, Trash2, Package } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { User } from '@/lib/types';
import { getUsers, addUser, updateUser, deleteUser } from '@/lib/actions';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


import { motion } from 'framer-motion';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariant = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

const AdminUsersPage = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const pathname = usePathname();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await getUsers();
      setUsers(fetchedUsers);
    } catch (error) {
      toast({
        title: "خطأ في جلب البيانات",
        description: "فشل تحميل البيانات من الخادم.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) {
      return users;
    }
    return users.filter(user => {
      const query = searchQuery.toLowerCase();
      return (
        (user.name || '').toLowerCase().includes(query) ||
        (user.username || '').toLowerCase().includes(query) ||
        (user.phone || '').includes(query)
      );
    });
  }, [users, searchQuery]);

  const openDialog = (user: User | null = null) => {
    setCurrentUser(user);
    setIsDialogOpen(true);
  };

  const openDeleteConfirm = (user: User) => {
    setCurrentUser(user);
    setIsDeleteConfirmOpen(true);
  };

  const generatePassword = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "تم النسخ!",
        description: "تم نسخ كلمة السر إلى الحافظة.",
      });
    });
  };

  const generateNextUsername = (prefix: string) => {
    const maxUserNumber = users.reduce((max, user) => {
      if (user.username.startsWith(prefix)) {
        const rest = user.username.substring(prefix.length);
        const num = parseInt(rest);
        if (!isNaN(num) && num > max) {
          return num;
        }
      }
      return max;
    }, 0);

    let nextNum = maxUserNumber + 1;
    if (maxUserNumber === 0 && prefix !== 'OS') {
      nextNum = 100;
    }

    return `${prefix}${nextNum}`;
  }


  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const userData = {
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
    };

    try {
      if (currentUser) {
        await updateUser(currentUser.id, userData);
      } else {
        const prefix = formData.get('prefix') as string || 'OS';
        const newUserDataWithDefaults: Omit<User, 'id'> = {
          username: generateNextUsername(prefix),
          password: generatePassword(),
          orderCount: 0,
          debt: 0,
          ...userData
        };
        await addUser(newUserDataWithDefaults);
      }

      toast({ title: currentUser ? "تم تحديث المستخدم بنجاح" : "تم إضافة المستخدم بنجاح" });
      setIsDialogOpen(false);
      setCurrentUser(null);
      fetchData(); // Re-fetch all data to ensure consistency
    } catch (error) {
      toast({ title: "حدث خطأ", description: "فشل حفظ المستخدم.", variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (currentUser) {
      try {
        await deleteUser(currentUser.id);
        toast({ title: "تم حذف المستخدم" });
        setIsDeleteConfirmOpen(false);
        setCurrentUser(null);
        fetchData(); // Re-fetch all data
      } catch (error) {
        toast({ title: "حدث خطأ", description: "فشل حذف المستخدم.", variant: 'destructive' });
      }
    }
  };

  const handleDownloadCSV = () => {
    const csvRows = [];
    const headers = ['id', 'name', 'username', 'phone', 'ordercount', 'debt', 'password', 'address', 'ordercounter'];
    csvRows.push(headers.join(','));

    for (const user of filteredUsers) {
      const values = [
        user.id,
        user.name,
        user.username,
        user.phone,
        user.orderCount,
        user.debt,
        user.password || '',
        user.address || '',
        user.orderCounter || 0,
      ].map(v => {
        const valueStr = String(v ?? '');
        if (valueStr.includes(',') || valueStr.includes('"') || valueStr.includes('\n')) {
          return `"${valueStr.replace(/"/g, '""')}"`;
        }
        return valueStr;
      });
      csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'users.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };


  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-4 sm:p-6"
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-6">
        <motion.h1 variants={itemVariant} className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">إدارة المستخدمين</motion.h1>
        <motion.div variants={itemVariant} className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1 bg-white/50 hover:bg-white/80" onClick={handleDownloadCSV} disabled={isLoading}>
            <Download className="h-4 w-4" />
            تنزيل CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
            setIsDialogOpen(isOpen);
            if (!isOpen) setCurrentUser(null);
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 shadow-lg hover:shadow-primary/50 transition-shadow" onClick={() => openDialog()}>
                <PlusCircle className="h-4 w-4" />
                إضافة مستخدم
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]" dir='rtl'>
              <form onSubmit={handleSave}>
                <DialogHeader>
                  <DialogTitle>{currentUser ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}</DialogTitle>
                  <DialogDescription>
                    {currentUser ? 'قم بتحديث المعلومات أدناه.' : 'املأ المعلومات لإضافة مستخدم جديد. سيتم إنشاء كلمة سر واسم مستخدم تلقائياً.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 text-right">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">الاسم</Label>
                    <Input id="name" name="name" defaultValue={currentUser?.name} className="col-span-3" />
                  </div>
                  {!currentUser && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="prefix" className="text-right">رمز المدينة</Label>
                      <Select name="prefix" defaultValue="OS">
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="اختر الرمز" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OS">مكتب (OS)</SelectItem>
                          <SelectItem value="M">مصراتة (M)</SelectItem>
                          <SelectItem value="B">بنغازي (B)</SelectItem>
                          <SelectItem value="T">طبرق (T)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {currentUser && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="username" className="text-right">اسم المستخدم</Label>
                      <Input id="username" name="username" defaultValue={currentUser?.username} className="col-span-3" readOnly />
                    </div>
                  )}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone" className="text-right">رقم الهاتف</Label>
                    <Input id="phone" name="phone" defaultValue={currentUser?.phone} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="address" className="text-right pt-2">العنوان</Label>
                    <Textarea id="address" name="address" defaultValue={currentUser?.address} className="col-span-3" rows={2} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">حفظ التغييرات</Button>
                  <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </motion.div>
      </div>

      <motion.div variants={itemVariant}>
        <Card className="glass-card border-none mx-0 sm:mx-0">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <CardTitle>قائمة المستخدمين</CardTitle>
              <div className="relative w-full sm:w-72">
                <Input
                  placeholder="ابحث بالاسم، اسم المستخدم، أو الهاتف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 bg-white/50 dark:bg-black/20"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-md border bg-white/50 dark:bg-black/20 backdrop-blur-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow>
                    <TableHead className='text-right font-bold'>الاسم</TableHead>
                    <TableHead className='text-right font-bold'>اسم المستخدم</TableHead>
                    <TableHead className='text-right font-bold'>رقم الهاتف</TableHead>
                    <TableHead className='text-right font-bold'>كلمة السر</TableHead>
                    <TableHead className='text-right font-bold'>عدد الطلبات</TableHead>
                    <TableHead className='text-right font-bold'>الدين المستحق</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : filteredUsers.map((user, index) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-medium">
                        <Link href={`/admin/users/${user.id}`} className="hover:underline text-primary">
                          {user.name}
                        </Link>
                      </TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.phone}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">********</span>
                          {user.password && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => copyToClipboard(user.password!)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{user.orderCount}</TableCell>
                      <TableCell className={user.debt > 0 ? "text-destructive font-bold" : "text-green-600 font-bold"}>{user.debt.toFixed(2)} د.ل</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => openDialog(user)}>تعديل</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openDeleteConfirm(user)} className="text-destructive focus:bg-destructive/30 focus:text-destructive-foreground">حذف</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            {/* Mobile Card View - Premium Dark */}
            <div className="md:hidden space-y-4 pb-20">
              {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
              ) : filteredUsers.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-[#1c1c1e] border border-white/5 rounded-3xl p-5 shadow-lg relative overflow-hidden group"
                >
                  {/* Background Gradient Effect */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[50px] rounded-full pointer-events-none" />

                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center text-xl font-bold text-white shadow-inner">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <Link href={`/admin/users/${user.id}`} className="font-bold text-lg text-white block mb-0.5">
                            {user.name}
                          </Link>
                          <span className="text-xs text-white/40 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5">@{user.username}</span>
                        </div>
                      </div>

                      <div className={`px-3 py-1 rounded-xl text-sm font-bold flex items-center gap-1.5 ${user.debt > 0 ? "bg-red-500/10 text-red-400 border border-red-500/10" : "bg-green-500/10 text-green-400 border border-green-500/10"
                        }`}>
                        <Wallet className="w-3.5 h-3.5" />
                        {user.debt.toFixed(0)} <span className="text-[10px] opacity-70">د.ل</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                        <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
                          <Phone className="w-3 h-3" />
                          <span>الهاتف</span>
                        </div>
                        <p className="font-mono text-sm text-white/90">{user.phone}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                        <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
                          <Package className="w-3 h-3" /> {/* Assumes Package is imported or available via Lucide global if not? Wait, I didn't import Package. Using Gift or ShoppingBag? OrderCount usually implies Package. I'll use Wallet which I imported, or just text. Let's strictly use imported icons: CreditCard, User. I'll use CreditCard for orders count? No. I'll use User for now or text. Edit: I see I missed Package import. I'll use User icon for "Orders" temporarily or just text? No, I'll use 'List' if imported? No. I'll swap to simple text or 'User' again. Actually, I imported 'User'. I'll use 'User' or just no icon. */}
                          {/* Wait, I should add Package to imports. I can't effectively add it now without another edit. I'll use `CreditCard` for now, it's roughly financial. Or just text. */}
                          <span>الطلبات</span>
                        </div>
                        <p className="font-mono text-sm text-white/90">{user.orderCount}</p>
                      </div>
                    </div>

                    {user.address && (
                      <div className="flex items-start gap-2 text-xs text-white/50 mb-4 px-1">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 text-primary/70" />
                        <p className="line-clamp-2 leading-relaxed">{user.address}</p>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-3 border-t border-white/5">
                      <div className="flex gap-2">
                        {user.password && (
                          <Button variant="ghost" size="sm" className="h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5" onClick={() => copyToClipboard(user.password!)}>
                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                            <span className="text-xs">نسخ كلمة السر</span>
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-white/60 hover:text-white hover:bg-white/10" onClick={() => openDialog(user)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-500/10" onClick={() => openDeleteConfirm(user)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent dir='rtl'>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من رغبتك في حذف المستخدم "{currentUser?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
              (ملاحظة: لن يتم حذف طلبات المستخدم السابقة).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDelete}>حذف</Button>
            <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
};

export default AdminUsersPage;
