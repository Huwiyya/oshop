// ✅ src/app/admin/creditors/[creditorId]/page.tsx
import React from "react";
import { getCreditorById, getExternalDebtsForCreditor } from "@/lib/actions";
import { notFound } from "next/navigation";
import { CreditorDetails } from "@/app/admin/creditors/creditor-details"; // We will create this client component

export default async function Page({
  params,
}: {
  params: Promise<{ creditorId: string }>;
}) {
  const { creditorId } = await params;
  const [creditor, debts] = await Promise.all([
    getCreditorById(creditorId),
    getExternalDebtsForCreditor(creditorId),
  ]);

  if (!creditor) {
    notFound();
  }

  return (
    <div className="p-4 sm:p-6" dir="rtl">
        <CreditorDetails initialCreditor={creditor} initialDebts={debts} />
    </div>
  );
}
