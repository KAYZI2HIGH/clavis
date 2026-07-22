"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { CreateStepShell, RequireDraft } from "../../_components/create-step-shell";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { StandingOrderAction } from "@/lib/types";

const orderSchema = z.object({
  conditions: z.array(
    z.object({
      field: z.enum(["amount", "category", "recipient"]),
      comparator: z.enum(["less_than", "greater_than", "between", "equals"]),
      value: z.union([z.string(), z.number()]).optional(),
    })
  ).length(1),
  action: z.enum(["auto_execute", "notify_then_execute", "operator_quorum_only", "always_require_investor"]),
  plain_language: z.string(),
});

const formSchema = z.object({
  orders: z.array(orderSchema),
});

type FormValues = z.infer<typeof formSchema>;

function OrderRow({ 
  index, 
  control, 
  register, 
  remove, 
  setValue 
}: { 
  index: number; 
  control: any; 
  register: any; 
  remove: (index: number) => void;
  setValue: any;
}) {
  const field = useWatch({ control, name: `orders.${index}.conditions.0.field` });
  const comparator = useWatch({ control, name: `orders.${index}.conditions.0.comparator` });
  const value = useWatch({ control, name: `orders.${index}.conditions.0.value` });
  const action = useWatch({ control, name: `orders.${index}.action` });

  // Auto-generate plain language
  useWatch({ control, name: `orders.${index}` }); // Re-render when any part of order changes

  const getActionText = (a: StandingOrderAction) => {
    switch (a) {
      case "auto_execute": return "Auto-approve";
      case "notify_then_execute": return "Notify me then auto-approve";
      case "operator_quorum_only": return "Require operator quorum for";
      case "always_require_investor": return "Require my explicit approval for";
      default: return "";
    }
  };

  const getConditionText = () => {
    if (field === "amount") {
      const compText = comparator === "less_than" ? "under" : comparator === "greater_than" ? "over" : "of exactly";
      return `payouts ${compText} ₦${Number(value || 0).toLocaleString()}`;
    }
    if (field === "category") {
      return `payouts categorized as "${value || "..."}"`;
    }
    if (field === "recipient") {
      return `payouts to recipient "${value || "..."}"`;
    }
    return "";
  };

  const generatedLanguage = `${getActionText(action as any)} ${getConditionText()}`;
  
  // Update the hidden field so it submits properly
  if (generatedLanguage !== useWatch({ control, name: `orders.${index}.plain_language` })) {
    setValue(`orders.${index}.plain_language`, generatedLanguage);
  }

  return (
    <div className="border hairline-strong bg-card p-6">
      <div className="flex justify-between items-start mb-4">
        <p className="engraved text-ink">Rule #{index + 1}</p>
        <button type="button" onClick={() => remove(index)} className="text-ink-faint hover:text-crimson transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="serif text-lg text-ink-muted">When</span>
          <select
            {...register(`orders.${index}.conditions.0.field`)}
            className="input-mech py-1 px-2 text-sm flex-1 w-24!"
            onChange={(e) => {
              const newField = e.target.value;
              setValue(`orders.${index}.conditions.0.field`, newField);
              if (newField !== "amount") {
                setValue(`orders.${index}.conditions.0.comparator`, "equals");
                setValue(`orders.${index}.conditions.0.value`, "");
              } else {
                setValue(`orders.${index}.conditions.0.comparator`, "less_than");
                setValue(`orders.${index}.conditions.0.value`, 50000);
              }
            }}
          >
            <option value="amount">Amount</option>
            <option value="category">Category</option>
            <option value="recipient">Recipient</option>
          </select>

          <select
            {...register(`orders.${index}.conditions.0.comparator`)}
            className="input-mech py-1 px-2 text-sm flex-1 w-28!"
          >
            {field === "amount" ? (
              <>
                <option value="less_than">is less than</option>
                <option value="greater_than">is greater than</option>
                <option value="equals">is exactly</option>
              </>
            ) : (
              <option value="equals">is</option>
            )}
          </select>

          <input
            {...register(`orders.${index}.conditions.0.value`, { 
              valueAsNumber: field === "amount" 
            })}
            type={field === "amount" ? "number" : "text"}
            className="input-mech py-1 px-2 text-sm w-24"
            placeholder={
              field === "amount" ? "50000" 
              : field === "recipient" ? "Account Name" 
              : "e.g. Legal"
            }
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="serif text-lg text-ink-muted">Then</span>
          <select
            {...register(`orders.${index}.action`)}
            className="input-mech py-1 px-2 text-sm flex-1"
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
            readOnly
            type="text"
            className="input-mech py-1 px-2 text-sm w-full bg-secondary/10 text-ink-muted border-dashed"
            value={generatedLanguage}
            title="This description is auto-generated based on your selections above."
          />
          {/* Hidden input to actually register the field */}
          <input type="hidden" {...register(`orders.${index}.plain_language`)} />
        </div>
      </div>
    </div>
  );
}

export default function CreateStandingOrdersPage({ params }: { params: Promise<{ vaultId: string }> }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { vaultId } = use(params);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orders: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "orders",
  });

  const handleContinue = async (data: FormValues) => {
    setLoading(true);

    const existing: any = qc.getQueryData(queryKeys.vaults.detail(vaultId)) || {};
    qc.setQueryData(queryKeys.vaults.detail(vaultId), {
      ...existing,
      standing_orders: data.orders,
    });

    router.push(`/vault/create/${vaultId}/invite`);

    fetch(`/api/vaults/${vaultId}/standing-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
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
        
        <form onSubmit={form.handleSubmit(handleContinue)} className="mt-8 space-y-6">
          {fields.map((field, idx) => (
            <OrderRow 
              key={field.id} 
              index={idx} 
              control={form.control} 
              register={form.register} 
              remove={remove} 
              setValue={form.setValue}
            />
          ))}

          <button
            type="button"
            onClick={() => append({
              conditions: [{ field: "amount", comparator: "less_than", value: 50000 }],
              action: "auto_execute",
              plain_language: "",
            })}
            className="w-full border border-dashed hairline-strong bg-card hover:bg-secondary/60 text-ink-muted py-4 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm">Add Standing Order</span>
          </button>

          <div className="mt-12 flex justify-end">
            <button
              type="submit"
              className="btn-mech btn-mech-ghost disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 w-full sm:w-auto"
              disabled={loading}
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              {loading ? "Saving…" : "Continue"}
            </button>
          </div>
        </form>
      </CreateStepShell>
    </RequireDraft>
  );
}
