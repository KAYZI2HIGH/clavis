import bcrypt from "bcryptjs";
import { getServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/logger";

type RegisterBody = {
  full_name?: string;
  email?: string;
  phone?: string;
  pin?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as RegisterBody;
  const full_name = body.full_name?.trim();
  const email = body.email?.trim().toLowerCase();
  const phone = body.phone?.trim();
  const pin = body.pin?.trim();

  if (!full_name || !email || !phone || !pin) {
    return Response.json({ error: "All fields are required" }, { status: 400 });
  }

  if (!/^\d{4}$/.test(pin)) {
    return Response.json(
      { error: "PIN must be exactly 4 digits" },
      { status: 400 },
    );
  }

  const { data: existing } = await getServiceClient()
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return Response.json(
      { error: "An account with this email already exists" },
      { status: 409 },
    );
  }

  const pin_hash = await bcrypt.hash(pin, 12);

  const { data: user, error } = await getServiceClient()
    .from("users")
    .insert({ full_name, email, phone, pin_hash })
    .select("id, full_name, email, phone")
    .single();

  if (error) {
    log({
      level: "error",
      event: "register_user_insert_failed",
      error: error.message,
    });
    return Response.json({ error: "Failed to create account" }, { status: 500 });
  }

  return Response.json({ user }, { status: 201 });
}
