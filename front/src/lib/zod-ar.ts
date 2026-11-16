import { z } from "zod";
import { ar } from "@/messages/ar";

const v = ar.validation;

/**
 * Arabic for every zod rule that has no message of its own (zod's defaults are English, e.g.
 * "Invalid input"). Imported once by the app (FormErrorWatcher) and by lib/validation.
 */
z.config({
  customError: (issue) => {
    switch (issue.code) {
      case "invalid_type":
        return issue.input === undefined || issue.input === null || issue.input === "" ? v.required : issue.expected === "number" ? v.number : v.invalid;
      case "too_small":
        if (issue.origin === "string") return Number(issue.minimum) <= 1 ? v.required : v.min(Number(issue.minimum));
        if (issue.origin === "number") return v.atLeast(Number(issue.minimum));
        if (issue.origin === "array" || issue.origin === "set") return v.pickOne;
        return v.invalid;
      case "too_big":
        if (issue.origin === "string") return v.max(Number(issue.maximum));
        if (issue.origin === "number") return v.atMost(Number(issue.maximum));
        return v.invalid;
      case "invalid_format":
        return issue.format === "email" ? v.email : issue.format === "url" ? v.url : v.invalid;
      case "invalid_value":
        return v.choose;
      case "not_multiple_of":
        return v.wholeNumber;
      default:
        return v.invalid;
    }
  },
});
