"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { CreateStepShell, RequireDraft } from "../../_components/create-step-shell";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { StandingOrderAction, StandingOrderCondition } from "@/lib/types";

type OrderBuilder = {
  conditions: StandingOrderCondition[];
  action: StandingOrderAction;
  plain_language: string;
};

export default function CreateStandingOrdersPage({ params }: { params: { vaultId: string } }) {
  const router = useRouter();
  const qc = useQueryClient();
  const vaultId = params.vaultId;

  const [orders, setOrders] = useState<OrderBuilder[]>([]);
  const [loading, setLoading] = useState(false);

  const addOrder = () => {
    setOrders([
      ...orders,
      {
        conditions: [{ field: "amount", comparator: "less_than", value: 50000 }],
        action: "auto_execute",
        plain_language: "Auto-approve payouts under ₦50,000"
      }
    ]);
  };

  const removeOrder = (index: number) => {
    setOrders(orders.filter((_, i) => i !== index));
  };

  const handleContinue = async () => {
    setLoading(true);

    const payload = { orders };

    // Optimistically update cache
    const existing: any = qc.getQueryData(queryKeys.vaults.detail(vaultId)) || {};
    qc.setQueryData(queryKeys.vaults.detail(vaultId), {
      ...existing,
      standing_orders: orders,
    });

    router.push(`/vault/create/${vaultId}/invite`);

    // Background POST
    fetch(`/api/vaults/${vaultId}/standing-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      if (!res.ok) throw new Error("Failed to set standing orders");
    }).catch(() => {
      qc.setQueryData(queryKeys.vaults.detail(vaultId), existing);
      toast.error("Failed to save standing orders. Please try again.");
      router.push(`/vault/create/${vaultId}/standing-orders`);
    });
  };

  return (
    <RequireDraft>
      <CreateStepShell step={3} onBack={() => router.push(`/vault/create/${vaultId}/terms`)}>
        <p className="engraved">Standing Orders</p>
        <h1 className="serif text-3xl text-ink mt-2 leading-tight">
          Set up automatic rules
        </h1>
        <p className="text-sm text-ink-muted mt-3">
          Define when transactions should be auto-approved, require your manual approval, or only need operator quorum.
        </p>
        
        <div className="mt-8 space-y-6">
          {orders.map((order, idx) => (
            <div key={idx} className="border hairline-strong bg-card p-6">
              <div className="flex justify-between items-start mb-4">
                <p className="engraved text-ink">Rule #{idx + 1}</p>
                <button onClick={() => removeOrder(idx)} className="text-ink-faint hover:text-crimson transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="serif text-lg text-ink-muted">When</span>
                  <select
                    className="input-mech py-1 px-2 text-sm flex-1"
                    value={order.conditions[0].field}
                    onChange={(e) => {
                      const newOrders = [...orders];
                      newOrders[idx].conditions[0].field = e.target.value as any;
                      setOrders(newOrders);
                    }}
                  >
                    <option value="amount">Amount</option>
                    <option value="category">Category</option>
                    <option value="recipient">Recipient</option>
                  </select>
                  <select
                    className="input-mech py-1 px-2 text-sm flex-1"
                    value={order.conditions[0].comparator}
                    onChange={(e) => {
                      const newOrders = [...orders];
                      newOrders[idx].conditions[0].comparator = e.target.value as any;
                      setOrders(newOrders);
                    }}
                  >
                    <option value="less_than">is less than</option>
                    <option value="greater_than">is greater than</option>
                    <option value="equals">equals</option>
                  </select>
                  <input
                    type="text"
                    className="input-mech py-1 px-2 text-sm w-24"
                    value={order.conditions[0].value}
                    onChange={(e) => {
                      const newOrders = [...orders];
                      newOrders[idx].conditions[0].value = e.target.value;
                      setOrders(newOrders);
                    }}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="serif text-lg text-ink-muted">Then</span>
                  <select
                    className="input-mech py-1 px-2 text-sm flex-1"
                    value={order.action}
                    onChange={(e) => {
                      const newOrders = [...orders];
                      newOrders[idx].action = e.target.value as any;
                      setOrders(newOrders);
                    }}
                  >
                    <option value="auto_execute">Auto-execute payment</option>
                    <option value="operator_quorum_only">Require operator quorum only</option>
                    <option value="always_require_investor">Always require my approval</option>
                    <option value="notify_then_execute">Notify me, then execute</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-xs text-ink-faint block mb-1">Plain language description</label>
                  <input
                    type="text"
                    className="input-mech py-1 px-2 text-sm w-full bg-paper"
                    value={order.plain_language}
                    onChange={(e) => {
                      const newOrders = [...orders];
                      newOrders[idx].plain_language = e.target.value;
                      setOrders(newOrders);
                    }}
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addOrder}
            className="w-full border border-dashed hairline-strong bg-card hover:bg-secondary/60 text-ink-muted py-4 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm">Add Standing Order</span>
          </button>
        </div>

        <div className="mt-12 flex justify-end">
          <button
            className="btn-mech btn-mech-ghost disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 w-full sm:w-auto"
            onClick={handleContinue}
            disabled={loading}
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {loading ? "Saving…" : "Continue"}
          </button>
        </div>
      </CreateStepShell>
    </RequireDraft>
  );
}
