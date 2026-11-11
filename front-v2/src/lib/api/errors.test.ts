import { describe, expect, it, vi } from "vitest";
import { ar } from "@/messages/ar";
import { ApiError, applyServerErrors, errorMessage } from "./errors";

describe("applyServerErrors", () => {
  it("maps 422 errors onto fields including nested paths", () => {
    const setError = vi.fn();
    const error = new ApiError(422, {
      message: "البيانات المرسلة غير صحيحة.",
      code: "validation_failed",
      errors: { email: ["مستخدم من قبل"], "options.0.values.2.label": ["مكرر"] },
    });

    const unmatched = applyServerErrors(error, setError);

    expect(unmatched).toEqual([]);
    expect(setError).toHaveBeenCalledWith("email", { type: "server", message: "مستخدم من قبل" }, { shouldFocus: true });
    expect(setError).toHaveBeenCalledWith("options.0.values.2.label", { type: "server", message: "مكرر" }, { shouldFocus: false });
  });

  it("returns messages for unknown fields", () => {
    const setError = vi.fn();
    const error = new ApiError(422, { errors: { name: ["x"], code: ["الكود غير صالح"] } });

    expect(applyServerErrors(error, setError, ["name"])).toEqual(["الكود غير صالح"]);
    expect(setError).toHaveBeenCalledTimes(1);
  });

  it("ignores non-validation errors", () => {
    const setError = vi.fn();
    expect(applyServerErrors(new ApiError(500, {}), setError)).toEqual([]);
    expect(applyServerErrors(new Error("x"), setError)).toEqual([]);
    expect(setError).not.toHaveBeenCalled();
  });
});

describe("errorMessage", () => {
  it("uses the server message or a network message", () => {
    expect(errorMessage(new ApiError(409, { message: "مستخدمة" }))).toBe("مستخدمة");
    expect(errorMessage(new ApiError(0, {}))).toBe(ar.errors.network);
    expect(errorMessage(new Error("boom"))).toBe(ar.errors.generic);
  });
});
