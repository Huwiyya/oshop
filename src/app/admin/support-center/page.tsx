
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Send, Search, Smile, PlusCircle, Trash2 } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import EmojiPicker from 'emoji-picker-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Conversation, Message } from '@/lib/types';
import { getConversations, sendMessage, startConversation, getUsers, deleteConversation } from '@/lib/actions';
import Image from 'next/image';
import logo from '@/app/assets/logo.png';
import { useToast } from '@/components/ui/use-toast';


const NewConversationDialog = ({ onSelectUser, existingUserIds }: { onSelectUser: (user: {id: string, name: string}) => void, existingUserIds: string[] }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    
    useEffect(() => {
        if(isDialogOpen) {
            const fetchUsers = async () => {
                const users = await getUsers();
                // Filter out users who already have a conversation
                const usersWithoutConversation = users.filter(u => !existingUserIds.includes(u.id));
                setAllUsers(usersWithoutConversation);
            }
            fetchUsers();
        }
    }, [isDialogOpen, existingUserIds]);
    
    const filteredUsers = allUsers.filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = (user: {id: string, name: string}) => {
        onSelectUser(user);
        setIsDialogOpen(false);
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 flex-shrink-0">
                    <PlusCircle className="h-4 w-4" />
                    بدء محادثة
                </Button>
            </DialogTrigger>
            <DialogContent dir='rtl'>
                <DialogHeader>
                    <DialogTitle>بدء محادثة جديدة</DialogTitle>
                     <DialogDescription>
                        ابحث عن مستخدم ليس لديه محادثة حالية لبدء محادثة جديدة.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Input 
                        placeholder="ابحث عن مستخدم..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="mt-4 max-h-60 overflow-y-auto">
                        {filteredUsers.length > 0 ? filteredUsers.map(user => (
                            <div key={user.id} onClick={() => handleSelect(user)}
                                className="p-2 hover:bg-secondary rounded-md cursor-pointer">
                                {user.name} ({user.username})
                            </div>
                        )) : (
                            <p className="text-center text-muted-foreground text-sm p-4">
                                {allUsers.length > 0 ? 'لم يتم العثور على مستخدمين.' : 'جميع المستخدمين لديهم محادثات بالفعل.'}
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

const AdminSupportCenterPage = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const { toast } = useToast();
    const messagesEndRef = useRef<HTMLDivElement | null>(null);


    const fetchConversations = async () => {
        // No loading state change here to avoid flicker on re-fetch
        const convos = await getConversations();
        setConversations(convos.sort((a,b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()));
    }

    useEffect(() => {
        const initialFetch = async () => {
            setIsLoading(true);
            await fetchConversations();
            setIsLoading(false);
        }
        initialFetch();
    }, []);

    useEffect(() => {
        if(selectedConversation?.id) {
            // Find the latest version of the selected conversation
            const updatedConversation = conversations.find(c => c.id === selectedConversation.id);
            if (updatedConversation) {
                setSelectedConversation(updatedConversation);
            }
        }
    }, [conversations, selectedConversation?.id]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedConversation?.messages]);

    const handleSelectConversation = (conversation: Conversation) => {
        setSelectedConversation(conversation);
        if (conversation.unreadCount > 0) {
            const updatedConversations = conversations.map(c => 
                c.id === conversation.id ? { ...c, unreadCount: 0 } : c
            );
            setConversations(updatedConversations);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !selectedConversation) return;

        const message: Omit<Message, 'id'> = {
            text: newMessage,
            sender: 'support',
            timestamp: new Date().toISOString()
        };
        
        setNewMessage('');
        await sendMessage(selectedConversation.id, message);
        await fetchConversations();
    };

    const handleStartNewConversation = async (user: {id: string, name: string}) => {
        try {
            const newConversationId = await startConversation(user.id, user.name, `https://i.pravatar.cc/150?u=${user.id}`);
            await fetchConversations();
            const convos = await getConversations(); // Re-fetch to get the latest list
            const newConv = convos.find(c => c.id === newConversationId);
            setSelectedConversation(newConv || null);
        } catch(error) {
            console.error("Failed to start new conversation", error);
             toast({ title: "خطأ", description: "فشل بدء المحادثة.", variant: "destructive" });
        }
    };

    const openDeleteDialog = (e: React.MouseEvent, conv: Conversation) => {
        e.stopPropagation();
        setConversationToDelete(conv);
        setIsDeleteConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (!conversationToDelete) return;
        const success = await deleteConversation(conversationToDelete.id);
        if (success) {
            toast({ title: "تم حذف المحادثة" });
            fetchConversations(); // Re-fetch the list
            if (selectedConversation?.id === conversationToDelete.id) {
                setSelectedConversation(null); // Clear selection if it was the deleted one
            }
        } else {
            toast({ title: "خطأ", description: "فشل حذف المحادثة.", variant: "destructive" });
        }
        setIsDeleteConfirmOpen(false);
        setConversationToDelete(null);
    };
    
    const filteredConversations = conversations.filter(conv => 
        conv.userName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const existingUserIds = conversations.map(c => c.userId);

    return (
        <>
            <div className="h-screen flex flex-col" dir="rtl">
                <div className="flex-grow grid grid-cols-12 overflow-hidden">
                    {/* Conversations List */}
                    <div className={cn("col-span-12 md:col-span-4 border-l flex flex-col bg-card", selectedConversation && "hidden md:flex")}>
                        <div className="p-4 border-b flex items-center gap-2">
                            <div className="relative flex-grow">
                                <Input 
                                    placeholder="بحث في المحادثات..."
                                    className="pr-10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                            </div>
                            <NewConversationDialog onSelectUser={handleStartNewConversation} existingUserIds={existingUserIds}/>
                        </div>
                        <div className="flex-grow overflow-y-auto">
                        {isLoading ? (
                            <div className="text-center p-4 text-muted-foreground">جاري تحميل المحادثات...</div>
                        ) : filteredConversations.map(conv => (
                            <div key={conv.id} 
                                    className={`flex items-center p-3 cursor-pointer border-b hover:bg-secondary ${selectedConversation?.id === conv.id ? 'bg-secondary' : ''}`}
                                    onClick={() => handleSelectConversation(conv)}>
                                <Avatar className="h-12 w-12 ml-4">
                                    <AvatarImage src={logo.src} alt="System Logo" />
                                    <AvatarFallback>{conv.userName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-grow overflow-hidden">
                                    <h3 className="font-semibold truncate">{conv.userName}</h3>
                                    <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                                </div>
                                <div className="flex flex-col items-end text-xs text-muted-foreground ml-2">
                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => openDeleteDialog(e, conv)}>
                                        <Trash2 className="w-4 h-4"/>
                                    </Button>
                                    <span>{new Date(conv.lastMessageTime).toLocaleTimeString('ar-LY', {hour: '2-digit', minute: '2-digit'})}</span>
                                    {conv.unreadCount > 0 && <Badge className="mt-1">{conv.unreadCount}</Badge>}
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className={cn("col-span-12 md:col-span-8 flex flex-col bg-secondary/40", !selectedConversation && "hidden md:flex")}>
                        {selectedConversation ? (
                            <>
                                <header className="p-3 border-b bg-card flex items-center gap-4">
                                    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedConversation(null)}>
                                        <ArrowLeft />
                                    </Button>
                                    <Avatar>
                                        <AvatarImage src={logo.src} alt="System Logo" />
                                        <AvatarFallback>{selectedConversation.userName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <h2 className="font-semibold text-lg">{selectedConversation.userName}</h2>
                                </header>
                                <main className="flex-grow p-4 overflow-y-auto space-y-4">
                                    {selectedConversation.messages.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.sender === 'support' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-2xl ${
                                                msg.sender === 'support' 
                                                    ? 'bg-primary text-primary-foreground rounded-br-none' 
                                                    : 'bg-card text-card-foreground rounded-bl-none shadow-sm'
                                            }`}>
                                                <p className="text-sm">{msg.text}</p>
                                                <p className={`text-xs mt-1 ${msg.sender === 'support' ? 'text-primary-foreground/70' : 'text-muted-foreground'} text-left`}>
                                                    {new Date(msg.timestamp).toLocaleTimeString('ar-LY', {hour: '2-digit', minute: '2-digit'})}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </main>
                                <footer className="bg-card border-t p-2">
                                    <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-2">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-muted-foreground">
                                                    <Smile />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 border-0" side="top">
                                                <EmojiPicker onEmojiClick={(emojiObject) => setNewMessage(prev => prev + emojiObject.emoji)} />
                                            </PopoverContent>
                                        </Popover>
                                        <Input 
                                            placeholder="اكتب ردك..."
                                            className="flex-grow h-11"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                        />
                                        <Button type="submit" size="icon" className="h-11 w-11 rounded-full">
                                            <Send className="w-5 h-5" />
                                        </Button>
                                    </form>
                                </footer>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <h2 className="text-xl">حدد محادثة لبدء الدردشة</h2>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent dir='rtl'>
                    <DialogHeader>
                        <DialogTitle>تأكيد الحذف</DialogTitle>
                        <DialogDescription>
                            هل أنت متأكد من رغبتك في حذف هذه المحادثة مع <span className="font-bold">{conversationToDelete?.userName}</span>؟ لا يمكن التراجع عن هذا الإجراء.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="destructive" onClick={handleDelete}>حذف</Button>
                        <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>إلغاء</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default AdminSupportCenterPage;
