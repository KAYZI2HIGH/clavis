import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth?.user;

  const isAuthPage =
    nextUrl.pathname.startsWith("/sign-in") ||
    nextUrl.pathname.startsWith("/sign-up") ||
    nextUrl.pathname === "/";

  const isProtectedPage =
    nextUrl.pathname.startsWith("/home") ||
    nextUrl.pathname.startsWith("/vault") ||
    nextUrl.pathname.startsWith("/join-vault");

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/home", nextUrl));
  }

  if (!isLoggedIn && isProtectedPage) {
    return NextResponse.redirect(new URL("/sign-in", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
