import { AppError } from "../../middlewares/error.middleware";

/** NUMERIC(12,2) at the boundary; integer cents for every calculation. No implicit rounding. */
export function cents(value: unknown): bigint {
  const text =
    typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  if (typeof text !== "string" || !/^\d{1,10}(?:\.\d{1,2})?$/.test(text)) {
    throw new AppError(
      "El importe debe ser positivo o cero, con un máximo de dos decimales",
      400,
    );
  }
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export function decimal(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function obligationState(
  amount: string,
  paid: string,
  due: string | null,
  cancelled: boolean,
  today: string,
) {
  if (cancelled) return "ANULADO";
  if (cents(paid) >= cents(amount)) return "PAGADO";
  if (due && due < today) return "VENCIDO";
  return cents(paid) > 0n ? "PARCIALMENTE_PAGADO" : "PENDIENTE";
}
