import { z } from "zod";
import { cents, decimal } from "./billing.money";

export const moneyInput = z
  .union([z.string(), z.number()])
  .transform((value, context) => {
    try {
      return decimal(cents(value));
    } catch {
      context.addIssue({
        code: "custom",
        message:
          "Importe inválido: use como máximo dos decimales, sin signos ni separadores",
      });
      return z.NEVER;
    }
  });
const dueDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Fecha de vencimiento inválida");
export const createPlanSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120),
    modalidad: z.enum(["GRATUITO", "PAGO_UNICO", "CUOTAS", "MODULOS"]),
    predeterminado: z.boolean().default(true),
    monto_matricula: moneyInput,
    precio_academico: moneyInput,
    cuotas: z
      .array(
        z
          .object({
            concepto: z.string().trim().min(1).max(255),
            importe: moneyInput.refine(
              (value) => cents(value) > 0n,
              "La cuota debe ser mayor que cero",
            ),
            fecha_vencimiento: dueDate.nullable().optional(),
            componente_id: z.string().uuid().nullable().optional(),
          })
          .strict(),
      )
      .max(120),
  })
  .strict()
  .superRefine((plan, context) => {
    const total = plan.cuotas.reduce(
      (sum, row) => sum + cents(row.importe),
      0n,
    );
    if (total !== cents(plan.precio_academico))
      context.addIssue({
        code: "custom",
        path: ["cuotas"],
        message:
          "La suma de cuotas debe coincidir exactamente con el costo académico, sin incluir matrícula",
      });
    if (
      plan.modalidad === "GRATUITO" &&
      (total !== 0n || cents(plan.monto_matricula) !== 0n || plan.cuotas.length)
    )
      context.addIssue({
        code: "custom",
        path: ["modalidad"],
        message: "Un plan gratuito no genera cobros",
      });
    if (
      plan.modalidad === "PAGO_UNICO" &&
      plan.cuotas.length !== (cents(plan.precio_academico) > 0n ? 1 : 0)
    )
      context.addIssue({
        code: "custom",
        path: ["cuotas"],
        message: "El pago único debe incluir una sola cuota académica",
      });
    if (["CUOTAS", "MODULOS"].includes(plan.modalidad) && !plan.cuotas.length)
      context.addIssue({
        code: "custom",
        path: ["cuotas"],
        message: "Agregue las cuotas del plan",
      });
    if (
      plan.modalidad === "MODULOS" &&
      plan.cuotas.some((row) => !row.componente_id)
    )
      context.addIssue({
        code: "custom",
        path: ["cuotas"],
        message: "Cada cobro por módulo requiere un componente académico real",
      });
  });
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export const acceptPlanSchema = z
  .object({
    plan_id: z.string().uuid().optional(),
    motivo: z.string().trim().min(5).max(2000).optional(),
  })
  .strict();
export const assignPlanSchema = z
  .object({ plan_id: z.string().uuid() })
  .strict();
export const activateSchema = z
  .object({ motivo: z.string().trim().min(5).max(2000) })
  .strict();
export const billingIdSchema = z.object({ id: z.string().uuid() });

export const allocationSchema = z
  .object({
    obligacion_id: z.string().uuid(),
    importe: moneyInput.refine(
      (value) => cents(value) > 0n,
      "El abono debe ser mayor que cero",
    ),
  })
  .strict();
export const allocationsInput = z.preprocess((value) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}, z.array(allocationSchema).min(1).max(121));
export const collectPaymentSchema = z
  .object({
    clave_idempotencia: z.string().trim().min(8).max(100),
    metodo_pago: z.enum([
      "BAUCHER_BANCARIO",
      "CAJA_ADMINISTRATIVA",
      "TRANSFERENCIA",
    ]),
    numero_referencia_o_recibo: z.string().trim().min(1).max(100),
    banco_origen: z.string().trim().max(100).nullable().optional(),
    fecha_pago_reportada: z
      .string()
      .refine(
        (value) => Number.isFinite(Date.parse(value)),
        "Fecha de pago inválida",
      )
      .optional(),
    aplicaciones: allocationsInput,
  })
  .strict();
export type CollectPaymentInput = z.infer<typeof collectPaymentSchema>;
export const cancellationSchema = z
  .object({ motivo: z.string().trim().min(5).max(2000) })
  .strict();
export const receiptIdSchema = z.object({
  id: z.string().uuid(),
  receiptId: z.string().uuid(),
});
