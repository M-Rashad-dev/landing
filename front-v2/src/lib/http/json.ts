import { NextResponse } from "next/server";
import { ar } from "@/messages/ar";

export function jsonError(status: number, code: string, message?: string): NextResponse {
  const fallback = status === 403 ? ar.errors.forbidden : status === 404 ? ar.errors.notFound : ar.errors.generic;
  return NextResponse.json({ message: message ?? fallback, code }, { status });
}

export function forbiddenOrigin(): NextResponse {
  return jsonError(403, "forbidden");
}

export function upstreamUnavailable(): NextResponse {
  return jsonError(502, "upstream_unavailable", ar.errors.network);
}
