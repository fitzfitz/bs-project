import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, Star, MessageSquare } from 'lucide-react';
import { useSessionStore } from '@/features/auth/store';
import { useReceipt } from '@/features/profile/api/use-receipt';
import { PostReviewDialog } from '@/features/reviews/widgets/post-review-dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

export default function ReceiptPage() {
  const { t } = useTranslation('history');
  const org = useSessionStore((s) => s.user?.organization);
  const { transactionId } = useParams();
  const { data: receipt, isLoading, error } = useReceipt(transactionId);
  const [reviewOpen, setReviewOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <p className="text-slate-400">{t('history:loadingReceipt')}</p>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh p-6 text-center">
        <p className="text-red-500 font-medium">{t('history:receiptNotFound')}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/history">{t('history:backToHistory')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 max-w-md mx-auto">
      {/* Screen-only header */}
      <div className="print:hidden flex items-center gap-3 px-4 pt-6 pb-2">
        <Link to="/history" className="p-2 -ml-2 rounded-lg hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </Link>
        <h1 className="text-lg font-bold text-slate-900">{t('history:receipt')}</h1>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1.5" />
          {t('history:print')}
        </Button>
      </div>

      {/* Receipt card */}
      <div className="mx-4 my-4 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden print:shadow-none print:border-none print:rounded-none print:mx-0 print:my-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center border-b border-dashed border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">{receipt.branchName}</h2>
          {receipt.branchAddress && (
            <p className="text-xs text-slate-500 mt-1">{receipt.branchAddress}</p>
          )}
          <p className="text-xs text-slate-400 mt-2 font-mono">{receipt.receiptNumber}</p>
          <p className="text-xs text-slate-400">{format(new Date(receipt.date), 'dd MMM yyyy, HH:mm')}</p>
        </div>

        {/* Barber / Cashier */}
        <div className="px-6 py-3 border-b border-slate-100 flex justify-between text-xs text-slate-500">
          {receipt.staffName && <span>Barber: <span className="font-medium text-slate-700">{receipt.staffName}</span></span>}
          {receipt.cashierName && receipt.cashierName !== '—' && (
            <span>Cashier: <span className="font-medium text-slate-700">{receipt.cashierName}</span></span>
          )}
        </div>

        {/* Items */}
        <div className="px-6 py-4 space-y-2">
          {receipt.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <div className="flex-1">
                <span className="text-slate-900">{item.name}</span>
                {item.qty > 1 && <span className="text-slate-400 ml-1">x{item.qty}</span>}
                {item.discount > 0 && (
                  <span className="text-green-600 text-xs ml-2">
                    -{formatCurrency(item.discount, org?.currency, org?.locale)}
                  </span>
                )}
              </div>
              <span className="text-slate-700 font-medium tabular-nums">
                {formatCurrency(item.total, org?.currency, org?.locale)}
              </span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="px-6 py-4 border-t border-dashed border-slate-200 space-y-1.5">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Subtotal</span>
            <span className="tabular-nums">
              {formatCurrency(receipt.subtotal, org?.currency, org?.locale)}
            </span>
          </div>
          {receipt.discountTotal > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span className="tabular-nums">
                -{formatCurrency(receipt.discountTotal, org?.currency, org?.locale)}
              </span>
            </div>
          )}
          {receipt.tax > 0 && (
            <div className="flex justify-between text-sm text-slate-500">
              <span>Tax</span>
              <span className="tabular-nums">
                {formatCurrency(receipt.tax, org?.currency, org?.locale)}
              </span>
            </div>
          )}
          {receipt.tip > 0 && (
            <div className="flex justify-between text-sm text-slate-500">
              <span>Tip</span>
              <span className="tabular-nums">
                {formatCurrency(receipt.tip, org?.currency, org?.locale)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
            <span>Total</span>
            <span className="tabular-nums">
              {formatCurrency(receipt.grandTotal, org?.currency, org?.locale)}
            </span>
          </div>
        </div>

        {/* Payment method */}
        <div className="px-6 py-3 border-t border-slate-100">
          {receipt.payments.map((p, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-slate-500">{p.method}</span>
              <span className="font-medium text-slate-700 tabular-nums">
                {formatCurrency(p.amount, org?.currency, org?.locale)}
              </span>
            </div>
          ))}
        </div>

        {/* Loyalty */}
        {receipt.loyaltyPointsEarned > 0 && (
          <div className="px-6 py-3 bg-amber-50 border-t border-amber-100 flex items-center gap-2 text-sm text-amber-700">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span>You earned <strong>{receipt.loyaltyPointsEarned}</strong> loyalty points!</span>
          </div>
        )}

        {/* Review prompt */}
        <div className="px-6 py-4 border-t border-slate-100">
          <button
            onClick={() => setReviewOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-3 text-sm font-semibold text-primary hover:bg-primary/15 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Leave a Review
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 text-center">
          <p className="text-xs text-slate-400">Thank you for your visit!</p>
        </div>
      </div>

      {/* Review Dialog */}
      {receipt && (
        <PostReviewDialog
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          branchId={receipt.branchId}
          staffProfileId={receipt.staffProfileId ?? undefined}
          queueEntryId={receipt.queueEntryId ?? undefined}
        />
      )}
    </div>
  );
}
