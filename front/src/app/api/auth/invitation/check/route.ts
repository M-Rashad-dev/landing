import type { NextRequest } from "next/server";
import { forwardPasswordReset } from "@/lib/auth/upstream-auth";

/** Whose staff invitation link this is (signed out). */
export async function POST(request: NextRequest) {
  return forwardPasswordReset(request, "/auth/invitation/check");
}
