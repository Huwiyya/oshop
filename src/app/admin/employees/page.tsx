
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Manager } from '@/lib/types';
import { getManagers, addManager, updateManager, deleteManager } from '@/lib/actions';


const permissions = [
  { id: 'users', label: 'إدارة المستخدمين' },
  { id: 'employees', label: 'إدارة المدراء' },
  { id: 'representatives', label: 'إدارة المندوبين' },
  { id: 'orders', label: 'إدارة الطلبات' },
  { id: 'shipping_label', label: 'إنشاء بوليصة شحن' },
  { id: 'temporary_users', label: 'المستخدمين المؤقتين' },
  { id: 'financial_reports', label: 'التقارير المالية' },
  { id: 'instant_sales', label: 'مبيعات فورية' },
  { id: 'deposits', label: 'سجل العربون' },
  { id: 'expenses', label: 'إدارة المصروفات' },
  { id: 'creditors', label: 'إدارة الذمم' },
  { id: 'support', label: 'مركز الدعم' },
  { id: 'notifications', label: 'إدارة الإشعارات' },
  { id: 'exchange_rate', label: 'اسعار الصرف والشحن' },
  { id: 'financial_dashboard', label: 'لوحة التحكم المالية' }, // New
  { id: 'reports.employee', label: 'تقارير الموظفين' }, // New
];

const AdminManagersPage = () => {
  const { toast } = useToast();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentManager, setCurrentManager] = useState<Manager | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchManagers = async () => {
      setIsLoading(true);
      try {
        const fetchedManagers = await getManagers();
        setManagers(fetchedManagers);
      } catch (error) {
        console.error("Error fetching managers:", error);
        toast({
          title: "خطأ في جلب البيانات",
          description: "فشل تحميل قائمة المدراء. تحقق من الكونسول لمزيد من التفاصيل.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchManagers();
  }, [toast]);

  const filteredManagers = useMemo(() => {
    if (!searchQuery) {
      return managers;
    }
    return managers.filter(manager => {
      const query = searchQuery.toLowerCase();
      return (
        manager.name.toLowerCase().includes(query) ||
        manager.username.toLowerCase().includes(query)
      );
    });
  }, [managers, searchQuery]);


  const openDialog = (manager: Manager | null = null) => {
    setCurrentManager(manager);
    if (manager) {
      setSelectedPermissions(manager.permissions || []);
    } else {
      setSelectedPermissions(permissions.map(p => p.id));
    }
    setIsDialogOpen(true);
  };

  const generatePassword = () => {
    return Math.random().toString(36).slice(-8);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "تم النسخ!",
        description: "تم نسخ كلمة السر إلى الحافظة.",
      });
    });
  };

  const generateNextUsername = () => {
    const maxEmpNumber = managers.reduce((max, emp) => {
      if (emp.username.startsWith('EMP')) {
        const num = parseInt(emp.username.substring(3));
        if (!isNaN(num) && num > max) {
          return num;
        }
      }
      return max;
    }, 0);
    return `EMP${maxEmpNumber + 1}@tamweel.app`;
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const formValues = {
      name: formData.get('name') as string,
      username: formData.get('username') as string,
      phone: formData.get('phone') as string,
    };
    const password = formData.get('password') as string;

    if (!formValues.username) {
      toast({ title: "خطأ", description: "اسم المستخدم مطلوب.", variant: 'destructive' });
      return;
    }

    try {
      if (currentManager) {
        const updatedData: Partial<Manager> = {
          ...formValues,
          permissions: selectedPermissions
        };
        // Password is not updated if the field is left empty
        if (password) {
          updatedData.password = password;
        }
        await updateManager(currentManager.id, updatedData);
        setManagers(managers.map(u => u.id === currentManager.id ? { ...currentManager, ...updatedData, password: password || currentManager.password } : u));
        toast({ title: "تم تحديث بيانات المدير" });
      } else {
        const newManagerData: Omit<Manager, 'id'> = {
          name: formValues.name,
          username: formValues.username,
          phone: formValues.phone,
          password: password || generatePassword(),
          permissions: selectedPermissions,
        };
        const newManager = await addManager(newManagerData);
        if (newManager) {
          setManagers(prev => [...prev, newManager]);
          toast({ title: "تم إضافة المدير بنجاح" });
        } else {
          throw new Error("Failed to create manager");
        }
      }
      setIsDialogOpen(false);
      setCurrentManager(null);
    } catch (error) {
      console.error(error);
      toast({ title: "حدث خطأ", description: "فشل حفظ بيانات المدير.", variant: 'destructive' });
    }
  };

  const handleDelete = async (managerId: string) => {
    try {
      await deleteManager(managerId);
      setManagers(managers.filter(e => e.id !== managerId));
      toast({ title: "تم حذف المدير بنجاح" });
    } catch (error) {
      toast({ title: "حدث خطأ", description: "فشل حذف المدير.", variant: 'destructive' });
    }
  }


  const handlePermissionChange = (permissionId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(p => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">إدارة المدراء</h1>
        <Dialog open={isDialogOpen} onOpenChange={(isOpen) => {
          setIsDialogOpen(isOpen);
          if (!isOpen) setCurrentManager(null);
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" onClick={() => openDialog()}>
              <PlusCircle className="h-4 w-4" />
              إضافة مدير
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg" dir='rtl'>
            <form onSubmit={handleSave}>
              <DialogHeader>
                <DialogTitle>{currentManager ? 'تعديل بيانات المدير' : 'إضافة مدير جديد'}</DialogTitle>
                <DialogDescription>
                  {currentManager ? 'قم بتحديث المعلومات أدناه. اترك كلمة السر فارغة لعدم تغييرها.' : 'املأ المعلومات لإضافة مدير جديد.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 text-right">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">الاسم</Label>
                  <Input id="name" name="name" defaultValue={currentManager?.name} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="username" className="text-right">اسم المستخدم</Label>
                  <Input id="username" name="username" defaultValue={currentManager?.username || generateNextUsername()} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phone" className="text-right">رقم الهاتف</Label>
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={currentManager?.phone}
                    className="col-span-3"
                    onFocus={(e) => {
                      if (e.target.value.startsWith('0')) {
                        e.target.value = e.target.value.substring(1);
                      }
                    }}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="password" className="text-right">كلمة السر</Label>
                  <Input id="password" name="password" type="password" placeholder={currentManager ? "اتركه فارغاً لعدم التغيير" : "فارغ لكلمة سر عشوائية"} className="col-span-3" />
                </div>
                <div>
                  <Label className="text-right mb-2 block">الصلاحيات</Label>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 border rounded-md bg-background/50">
                    {permissions.map(p => (
                      <div key={p.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`perm-${p.id}`}
                          checked={selectedPermissions.includes(p.id)}
                          onCheckedChange={() => handlePermissionChange(p.id)}
                        />
                        <Label htmlFor={`perm-${p.id}`} className="font-normal">{p.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">حفظ</Button>
                <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <CardTitle>قائمة المدراء</CardTitle>
            <div className="relative w-full sm:w-72">
              <Input
                placeholder="ابحث بالاسم أو اسم المستخدم..."
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
                <TableHead className='text-right'>كلمة السر</TableHead>
                <TableHead className='text-right'>الصلاحيات</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filteredManagers.length > 0 ? filteredManagers.map((manager) => (
                <TableRow key={manager.id}>
                  <TableCell className="font-medium">{manager.name}</TableCell>
                  <TableCell>{manager.username}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>********</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(manager.password)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {manager.permissions && manager.permissions.map(pId => {
                        const perm = permissions.find(p => p.id === pId);
                        return <Badge key={pId} variant="secondary">{perm?.label}</Badge>
                      })}
                    </div>
                  </TableCell>
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
                        <DropdownMenuItem onSelect={() => openDialog(manager)}>تعديل</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleDelete(manager.id)} className="text-destructive focus:bg-destructive/30 focus:text-destructive-foreground">حذف</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} className="text-center py-10">لم يتم العثور على مدراء.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminManagersPage;
