import React from 'react';
import { Order } from '@/lib/types';
import logo from '@/app/assets/logo.png';
import { Package, Hash, Calendar as CalendarIcon, DollarSign, Wallet, CreditCard } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
    <div className="flex items-start">
        <div className="flex-shrink-0 w-28 text-gray-600 font-semibold flex items-center gap-1.5 whitespace-nowrap">
            {icon} {label}
        </div>
        <div className="font-medium">{value}</div>
    </div>
);

// دالة مساعدة لترجمة طريقة الدفع
const getPaymentMethodLabel = (method?: 'cash' | 'card' | 'cash_dollar'): string => {
    switch (method) {
        case 'cash': return 'نقدي';
        case 'card': return 'بطاقة مصرفية';
        case 'cash_dollar': return 'دولار كاش';
        default: return 'غير محدد';
    }
};

export const PrintableInvoice = ({ labelData, customValue }: { labelData: Order, customValue?: number }) => {
    const isPaymentOnReceipt = labelData.remainingAmount > 0;
    const hasShippingCalc = labelData.weightKG && labelData.weightKG > 0;

    // حساب الشحن
    const shippingCost = labelData.isFreeShipping
        ? 0
        : (labelData.customerWeightCost || 0) * (labelData.weightKG || 0);

    // المطلوب عند الاستلام بدون شحن
    const remainingWithoutShipping = Math.max(0, labelData.remainingAmount - shippingCost);

    return (
        <div className="bg-white shadow-lg flex flex-col border border-gray-300 w-full h-full mx-auto" dir="rtl">
            {/* Header */}
            <header className="grid grid-cols-3 items-center p-4 border-b border-gray-300">
                <div className="col-span-1 flex items-center gap-4">
                    <img src={logo.src} alt="Logo" style={{ width: '60px', height: '60px' }} />
                    <div>
                        <h1 className="text-lg font-bold whitespace-nowrap">بوليصة شحن</h1>
                        <p className="text-xs text-gray-500">شركة Oshop</p>
                    </div>
                </div>
                <div className="col-span-1"></div>
                <div className="col-span-1 text-left">
                    <p className="font-bold text-sm whitespace-nowrap">رقم الفاتورة: {labelData.invoiceNumber}</p>
                    <p className="text-xs text-gray-500">{format(new Date(labelData.operationDate), 'yyyy/MM/dd')}</p>
                </div>
            </header>

            {/* Sender & Receiver */}
            <section className="grid grid-cols-2 gap-4 p-4 border-b border-gray-300 text-sm">
                <div className="border-l border-gray-300 pl-4">
                    <h2 className="font-bold mb-2 whitespace-nowrap">من: المرسل</h2>
                    <p className="font-semibold">شركة Oshop</p>
                    <p>المقاوبة - الدائري الثاني - بالقرب من التقاطع, Misurata, Libya</p>
                    <p dir="ltr" className="text-right font-mono">0927172021</p>
                </div>
                <div>
                    <h2 className="font-bold mb-2 whitespace-nowrap">إلى: المستلم</h2>
                    <p className="font-semibold">{labelData.customerName}</p>
                    <p>{labelData.customerAddress}</p>
                    <p dir="ltr" className="text-right font-mono">{labelData.customerPhone}</p>
                </div>
            </section>

            {/* Order Details */}
            <section className="p-4 flex-grow">
                <h2 className="font-bold mb-2 whitespace-nowrap">تفاصيل الشحنة</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <InfoRow icon={<Package className="w-4 h-4" />} label="وصف المحتوى:" value={labelData.itemDescription || 'غير محدد'} />
                    <InfoRow icon={<Hash className="w-4 h-4" />} label="كود التتبع:" value={labelData.trackingId || 'N/A'} />
                    <InfoRow icon={<CalendarIcon className="w-4 h-4" />} label="تاريخ الطلب:" value={format(new Date(labelData.operationDate), 'yyyy/MM/dd')} />

                    {/* طريقة الدفع */}
                    {labelData.paymentMethod && (
                        <InfoRow
                            icon={<CreditCard className="w-4 h-4" />}
                            label="طريقة الدفع:"
                            value={getPaymentMethodLabel(labelData.paymentMethod)}
                        />
                    )}

                    {/* Weight & Shipping */}
                    {labelData.weightKG && labelData.weightKG > 0 && (
                        <>
                            <InfoRow icon={<Package className="w-4 h-4" />} label="الوزن:" value={`${labelData.weightKG} كجم`} />
                            {labelData.shippingPriceUSD && !labelData.isFreeShipping && (
                                <InfoRow icon={<DollarSign className="w-4 h-4" />} label="سعر الشحن:" value={`${labelData.shippingPriceUSD} $/كجم`} />
                            )}
                        </>
                    )}

                    <InfoRow icon={<DollarSign className="w-4 h-4" />} label="المبلغ الإجمالي:" value={`${labelData.sellingPriceLYD.toFixed(2)} د.ل`} />
                </div>

                {/* تفاصيل الدفع */}
                {labelData.downPaymentLYD && labelData.downPaymentLYD > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                        <h3 className="font-bold text-sm mb-2">تفاصيل الدفع:</h3>
                        {labelData.walletPaymentAmount && labelData.walletPaymentAmount > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="flex items-center gap-1">
                                    <Wallet className="w-3 h-3" />
                                    المدفوع من محفظة الزبون:
                                </span>
                                <span className="font-bold text-emerald-600">{labelData.walletPaymentAmount.toFixed(2)} د.ل</span>
                            </div>
                        )}
                        {labelData.cashPaymentAmount && labelData.cashPaymentAmount > 0 && (
                            <div className="flex justify-between text-sm mt-1">
                                <span className="flex items-center gap-1">
                                    <CreditCard className="w-3 h-3" />
                                    المدفوع {getPaymentMethodLabel(labelData.paymentMethod)}:
                                </span>
                                <span className="font-bold text-blue-600">{labelData.cashPaymentAmount.toFixed(2)} د.ل</span>
                            </div>
                        )}
                        <Separator className="my-2" />
                        <div className="flex justify-between text-sm font-bold">
                            <span>إجمالي المدفوع:</span>
                            <span>{labelData.downPaymentLYD.toFixed(2)} د.ل</span>
                        </div>
                    </div>
                )}

                {/* Note about shipping cost if not calculated */}
                {!hasShippingCalc && (
                    <div className="mt-4 p-2 bg-yellow-50 text-yellow-700 text-xs rounded border border-yellow-200 text-center">
                        ملاحظة: سيتم احتساب تكلفة الشحن الجوي لاحقاً عند وصول الشحنة.
                    </div>
                )}

                <Separator className="my-4" />
                <div className="bg-gray-100 p-3 rounded-md text-center">
                    <p className="font-bold text-base whitespace-nowrap">
                        {isPaymentOnReceipt ? "المبلغ المطلوب عند الاستلام" : "الدفعة تمت بالكامل"}
                    </p>
                    {isPaymentOnReceipt && (
                        <>
                            <p className="text-xl font-bold text-red-600">
                                {customValue !== undefined ? customValue.toFixed(2) : remainingWithoutShipping.toFixed(2)} د.ل
                            </p>
                            {labelData.isFreeShipping ? (
                                <p className="text-sm text-green-600 font-bold mt-1">🎁 الشحن مجاني</p>
                            ) : shippingCost > 0 && (
                                <p className="text-xs text-gray-600 mt-1">
                                    + {shippingCost.toFixed(2)} د.ل شحن عند الوصول
                                </p>
                            )}
                        </>
                    )}
                </div>
            </section>

            {/* Footer */}
            <footer className="mt-auto p-4 border-t border-gray-300 text-center flex-shrink-0">
                <p className="text-sm font-bold">شكراً لتعاملكم معنا!</p>
                <p className="text-xs text-gray-500 mt-1">
                    ملاحظة: الرجاء التأكد من سلامة الشحنة قبل التوقيع على الاستلام.
                </p>
            </footer>
        </div>
    );
};
