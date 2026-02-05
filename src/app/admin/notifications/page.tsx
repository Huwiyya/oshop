
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Users, User as UserIcon, Check, ChevronsUpDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { User } from '@/lib/types';
import { getUsers, sendNotification } from '@/lib/actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';


const AdminNotificationsPage = () => {
  const { toast } = useToast();
  const [notificationMessage, setNotificationMessage] = useState('');
  const [targetType, setTargetType] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      const users = await getUsers();
      setAllUsers(users);
    };
    fetchUsers();
  }, []);

  const handleSendNotification = async () => {
    if (notificationMessage.trim() === '') {
      toast({
        title: 'خطأ',
        description: 'لا يمكن إرسال إشعار فارغ.',
        variant: 'destructive',
      });
      return;
    }

    if (targetType === 'specific' && !selectedUserId) {
      toast({
        title: 'خطأ',
        description: 'الرجاء اختيار مستخدم محدد.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      await sendNotification(notificationMessage, targetType as 'all' | 'specific', selectedUserId);
      const targetDescription = targetType === 'all' 
        ? 'جميع المستخدمين' 
        : `المستخدم: ${allUsers.find(u => u.id === selectedUserId)?.name}`;

      toast({
        title: 'تم إرسال الإشعار بنجاح!',
        description: `تم إرسال الإشعار إلى ${targetDescription}.`,
      });

      // Reset form
      setNotificationMessage('');
      setTargetType('all');
      setSelectedUserId('');

    } catch (error) {
       toast({
        title: 'خطأ',
        description: 'فشل إرسال الإشعار.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">إدارة الإشعارات</h1>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>إرسال إشعار جديد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="notification-message">نص الإشعار</Label>
            <Textarea
              id="notification-message"
              placeholder="اكتب رسالة الإشعار هنا..."
              rows={5}
              value={notificationMessage}
              onChange={(e) => setNotificationMessage(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label>الجمهور المستهدف</Label>
            <RadioGroup value={targetType} onValueChange={setTargetType} className="flex gap-4 pt-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="all" id="all-users" />
                <Label htmlFor="all-users" className="font-normal flex items-center gap-1"><Users className="w-4 h-4" /> الكل</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="specific" id="specific-user" />
                <Label htmlFor="specific-user" className="font-normal flex items-center gap-1"><UserIcon className="w-4 h-4" /> مستخدم محدد</Label>
              </div>
            </RadioGroup>
          </div>

          {targetType === 'specific' && (
            <div className="space-y-2 animate-in fade-in">
              <Label htmlFor="select-user">اختر المستخدم</Label>
              <Popover open={isUserSearchOpen} onOpenChange={setIsUserSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={isUserSearchOpen}
                    className="w-full justify-between"
                  >
                    {selectedUserId
                      ? allUsers.find((user) => user.id === selectedUserId)?.name
                      : "ابحث عن مستخدم..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="ابحث بالاسم، الكود، أو الهاتف..." />
                    <CommandList>
                        <CommandEmpty>لم يتم العثور على مستخدم.</CommandEmpty>
                        <CommandGroup>
                        {allUsers.map((user) => (
                            <CommandItem
                            key={user.id}
                            value={`${user.name} ${user.username} ${user.phone}`}
                            onSelect={() => {
                                setSelectedUserId(user.id);
                                setIsUserSearchOpen(false);
                            }}
                            >
                            <Check
                                className={cn(
                                "mr-2 h-4 w-4",
                                selectedUserId === user.id ? "opacity-100" : "opacity-0"
                                )}
                            />
                            {user.name} ({user.username})
                            </CommandItem>
                        ))}
                        </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
          
          <Button onClick={handleSendNotification} className="w-full">
            إرسال الإشعار
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminNotificationsPage;
