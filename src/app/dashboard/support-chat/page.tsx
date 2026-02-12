
'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Smile, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import EmojiPicker from 'emoji-picker-react';
import { Message, Conversation, User } from "@/lib/types";
import { getConversations, sendMessage, startConversation, getUsers } from "@/lib/actions";


const SupportChatPage = () => {
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const loadConversation = async () => {
            setIsLoading(true);

            const loggedInUserStr = localStorage.getItem('loggedInUser');
            if (!loggedInUserStr) {
                router.push('/login');
                return;
            }
            const loggedInUser = JSON.parse(loggedInUserStr);
            const userId = loggedInUser.id;

            if (!userId) {
                router.push('/login');
                return;
            }

            const allUsers = await getUsers();
            const currentUser = allUsers.find(u => u.id === userId);

            if (!currentUser) {
                router.push('/login');
                return;
            }

            const allConvos = await getConversations();
            let userConvo = allConvos.find(c => c.userId === userId);

            if (!userConvo) {
                // If no conversation exists, start a new one
                const newConvoId = await startConversation(userId, currentUser.name, `https://i.pravatar.cc/150?u=${userId}`);
                const convosAfterCreation = await getConversations();
                userConvo = convosAfterCreation.find(c => c.id === newConvoId);
            }

            if (userConvo) {
                setConversation(userConvo);
                setMessages(userConvo.messages);
            }
            setIsLoading(false);
        };
        loadConversation();
    }, [router]);


    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !conversation) return;

        const messageData: Omit<Message, 'id'> = {
            text: newMessage,
            sender: 'user',
            timestamp: new Date().toISOString()
        };

        const optimisticMessage: Message = { ...messageData, id: Date.now().toString() };
        setMessages(prev => [...prev, optimisticMessage]);
        setNewMessage('');

        await sendMessage(conversation.id, messageData);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-secondary via-background to-secondary dark:from-slate-900 dark:via-black dark:to-slate-900 flex flex-col" dir="rtl">
            <header className="bg-card/30 backdrop-blur-lg border-b p-4 flex justify-between items-center shadow-sm sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="text-foreground">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold">فريق دعم Oshop</h1>
                </div>
            </header>

            <main className="flex-grow p-4 space-y-4 overflow-y-auto">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-muted-foreground pt-10">
                        <p>مرحباً بك! كيف يمكننا مساعدتك اليوم؟</p>
                    </div>
                ) : (
                    messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-2xl shadow-md ${msg.sender === 'user'
                                    ? 'bg-primary text-primary-foreground rounded-br-none'
                                    : 'bg-card text-card-foreground rounded-bl-none'
                                }`}>
                                <p className="text-sm">{msg.text}</p>
                                <p className={`text-xs mt-1 ${msg.sender === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'} text-left`}>
                                    {new Date(msg.timestamp).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </main>

            <footer className="sticky bottom-0 bg-card/60 backdrop-blur-lg border-t p-2 z-20">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2 p-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-muted-foreground">
                                <Smile />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-0 bg-card/80 backdrop-blur-lg" side="top">
                            <EmojiPicker onEmojiClick={(emojiObject) => setNewMessage(prev => prev + emojiObject.emoji)} />
                        </PopoverContent>
                    </Popover>
                    <Input
                        placeholder="اكتب رسالتك..."
                        className="flex-grow h-11 bg-transparent"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={isLoading || !conversation}
                    />
                    <Button type="submit" size="icon" className="h-11 w-11 rounded-full" disabled={isLoading || !conversation}>
                        <Send className="w-5 h-5" />
                    </Button>
                </form>
            </footer>
        </div>
    );
};

export default SupportChatPage;
