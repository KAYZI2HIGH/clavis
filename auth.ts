import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getServiceClient } from "@/lib/supabase/service";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        pin: { label: "PIN", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.pin) return null;

        const email = String(credentials.email).trim().toLowerCase();
        const pin = String(credentials.pin);

        const { data: user } = await getServiceClient()
          .from("users")
          .select("id, full_name, email, phone, pin_hash")
          .eq("email", email)
          .maybeSingle();

        if (!user) return null;

        const valid = await bcrypt.compare(pin, user.pin_hash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.full_name,
          email: user.email,
          phone: user.phone ?? "",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.phone = user.phone;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.phone = String(token.phone ?? "");
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  session: { strategy: "jwt" },
});
