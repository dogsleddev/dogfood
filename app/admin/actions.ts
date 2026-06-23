"use server";
/** Admin login/logout — sets/clears the signed admin cookie (lib/auth/admin). No user store. */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { passwordToToken, ADMIN_COOKIE } from "@/lib/auth/admin";

export async function adminLoginAction(formData: FormData): Promise<void> {
  const token = passwordToToken(String(formData.get("password") ?? ""));
  if (!token) redirect("/admin?error=1");
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  redirect("/setup/data-import");
}

export async function adminLogoutAction(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/");
}
