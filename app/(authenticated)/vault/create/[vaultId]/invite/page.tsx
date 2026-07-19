"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateStepShell, RequireDraft } from "../../_components/create-step-shell";
import { toast } from "sonner";
import { Loader2, UserPlus, CheckCircle2 } from "lucide-react";

export default function CreateInvitePage({ params }: { params: { vaultId: string } }) {
  const router = useRouter();
  const vaultId = params.vaultId;

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState<Array<{name: string, email: string, code: string}>>([]);

  const handleInvite = async () => {
    if (!email || !name) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/vaults/${vaultId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });

      if (!res.ok) throw new Error("Failed to invite");

      const data = await res.json();
      setInvites([...invites, { email, name, code: data.invite_code }]);
      setEmail("");
      setName("");
      toast.success("Operator invited successfully");
    } catch {
      toast.error("Failed to invite operator. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    router.push(`/vault/create/${vaultId}/fund`);
  };

  return (
    <RequireDraft>
      <CreateStepShell step={4} onBack={() => router.push(`/vault/create/${vaultId}/standing-orders`)}>
        <p className="engraved">Operators</p>
        <h1 className="serif text-3xl text-ink mt-2 leading-tight">
          Invite your operators
        </h1>
        <p className="text-sm text-ink-muted mt-3">
          Operators will manage day-to-day payouts and operations. They will need to accept the invite to join.
        </p>
        
        <div className="mt-8 space-y-6">
          <div className="border hairline-strong bg-card p-6 space-y-4">
            <div>
              <label className="engraved block mb-2">Operator Name</label>
              <input 
                type="text" 
                className="input-mech w-full" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="engraved block mb-2">Operator Email</label>
              <input 
                type="email" 
                className="input-mech w-full" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="jane@example.com"
              />
            </div>
            <button
              className="btn-mech flex items-center justify-center gap-2 w-full mt-4"
              onClick={handleInvite}
              disabled={loading || !email || !name}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Send Invite
            </button>
          </div>

          {invites.length > 0 && (
            <div className="border hairline-strong bg-card divide-y hairline">
              {invites.map((inv, idx) => (
                <div key={idx} className="flex items-center justify-between p-4">
                  <div>
                    <p className="serif text-lg text-ink">{inv.name}</p>
                    <p className="text-sm text-ink-muted">{inv.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-secondary">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider font-semibold">Invited</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-12 flex justify-end">
          <button
            className="btn-mech btn-mech-ghost disabled:opacity-40 flex items-center gap-1.5 w-full sm:w-auto"
            onClick={handleContinue}
          >
            Continue to Funding
          </button>
        </div>
      </CreateStepShell>
    </RequireDraft>
  );
}
