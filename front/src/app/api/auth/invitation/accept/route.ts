import type { NextRequest } from "next/server";
import { forwardAuth } from "@/lib/auth/upstream-auth";

/** A new staff member sets his password and is signed in (the token goes in the httpOnly cookie). */
export async function POST(request: NextRequest) {
  return forwardAuth(request, "/auth/invitation/accept");
}
