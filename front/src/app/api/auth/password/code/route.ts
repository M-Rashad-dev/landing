import type { NextRequest } from "next/server";
import { forwardPasswordReset } from "@/lib/auth/upstream-auth";

export async function POST(request: NextRequest) {
  return forwardPasswordReset(request, "/auth/password/code");
}
