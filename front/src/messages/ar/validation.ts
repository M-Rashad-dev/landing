/** Form validation messages (zod) and request errors. */
export const validation = {
  required: "الخانة دي مطلوبة",
  email: "البريد الإلكتروني مش مظبوط",
  phone: "رقم الموبايل مش مظبوط",
  min: (n: number) => `لازم ${n} حروف على الأقل`,
  max: (n: number) => `أقصى حاجة ${n} حرف`,
  passwordMin: "كلمة المرور لازم تكون 8 حروف على الأقل",
  between: (min: number, max: number) => `اكتب رقم من ${min} لـ ${max}`,
  positive: "اكتب مبلغ أكبر من صفر",
  pickOne: "اختار واحد على الأقل",
  wholeNumber: "اكتب رقم صحيح",
  number: "اكتب رقم",
  atLeast: (n: number) => `أقل حاجة ${n}`,
  atMost: (n: number) => `أقصى حاجة ${n}`,
  url: "الرابط مش مظبوط",
  choose: "اختار من الاختيارات المتاحة",
  invalid: "القيمة دي مش مظبوطة",
} as const;

export const errors = {
  generic: "حصلت مشكلة غير متوقعة. جرّب تاني.",
  formInvalid: "فيه بيانات محتاجة تتصلح، الخانات اللي فيها مشكلة متعلّمة بالأحمر.",
  network: "مقدرناش نوصل للسيرفر. اتأكد من الإنترنت وجرّب تاني.",
  forbidden: "مش مسموح لك تعمل الإجراء ده.",
  notFound: "الصفحة دي مش موجودة.",
} as const;
