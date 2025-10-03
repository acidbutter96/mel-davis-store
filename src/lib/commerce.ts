// Backwards-compatible re-export of the new Stripe based implementation.
export { commerce } from "@/lib/commerce-stripe";
export default (await import("@/lib/commerce-stripe")).commerce;
