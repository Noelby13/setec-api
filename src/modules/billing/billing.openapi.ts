const auth = [{ BearerAuth: [] }];
const id = {
  in: "path",
  name: "id",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const result = {
  200: {
    description: "Authoritative economic result in { success: true, data }",
  },
  400: {
    description: "Invalid exact-money input or mismatched ownership/module",
  },
  403: { description: "Missing permission or different student" },
  409: { description: "Conflicting state, retry payload or available balance" },
};
const body = (schema: object) => ({
  required: true,
  content: { "application/json": { schema } },
});
const amount = {
  type: "string",
  pattern: "^\\d{1,10}(\\.\\d{1,2})?$",
  example: "10000.00",
};
const allocation = {
  type: "object",
  required: ["obligacion_id", "importe"],
  additionalProperties: false,
  properties: {
    obligacion_id: { type: "string", format: "uuid" },
    importe: amount,
  },
};
const operation = (summary: string, permission: string, schema?: object) => ({
  tags: ["Billing"],
  summary,
  description: `JWT; ${permission}. Internal receipts are not fiscal invoices. Matriculation remains an explicit administrator decision.`,
  security: auth,
  parameters: [id],
  ...(schema ? { requestBody: body(schema) } : {}),
  responses: result,
});
const reason = {
  type: "object",
  required: ["motivo"],
  additionalProperties: false,
  properties: { motivo: { type: "string", minLength: 5, maxLength: 2000 } },
};
export const billingOpenApiPaths = {
  "/billing/cohorts/{id}/plans": {
    get: operation(
      "List versioned cohort payment offers",
      "COHORTE_GESTIONAR or INSCRIPCION_VALIDAR or PAGO_VALIDAR",
    ),
    post: operation(
      "Publish an immutable price-plan version",
      "COHORTE_GESTIONAR",
      {
        type: "object",
        required: [
          "nombre",
          "modalidad",
          "monto_matricula",
          "precio_academico",
          "cuotas",
        ],
        additionalProperties: false,
        properties: {
          nombre: { type: "string", maxLength: 120 },
          modalidad: {
            type: "string",
            enum: ["GRATUITO", "PAGO_UNICO", "CUOTAS", "MODULOS"],
          },
          predeterminado: { type: "boolean", default: true },
          monto_matricula: amount,
          precio_academico: amount,
          cuotas: {
            type: "array",
            maxItems: 120,
            items: {
              type: "object",
              required: ["concepto", "importe"],
              properties: {
                concepto: { type: "string" },
                importe: amount,
                fecha_vencimiento: {
                  type: "string",
                  format: "date",
                  nullable: true,
                },
                componente_id: {
                  type: "string",
                  format: "uuid",
                  nullable: true,
                },
              },
            },
          },
        },
      },
    ),
  },
  "/billing/enrollments/{id}/account": {
    get: operation(
      "Read the consistent student account without creating debt",
      "owner or INSCRIPCION_VALIDAR or PAGO_VALIDAR",
    ),
  },
  "/billing/enrollments/{id}/plan": {
    post: operation(
      "Choose an offer before obligations have been accepted",
      "INSCRIPCION_VALIDAR",
      {
        type: "object",
        required: ["plan_id"],
        additionalProperties: false,
        properties: { plan_id: { type: "string", format: "uuid" } },
      },
    ),
  },
  "/billing/enrollments/{id}/accept": {
    post: operation(
      "Accept an agreement or explicitly reconcile historical payments",
      "INSCRIPCION_VALIDAR",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          plan_id: { type: "string", format: "uuid" },
          motivo: {
            type: "string",
            minLength: 5,
            maxLength: 2000,
            description:
              "Required to reconcile historical approved payments; confirms the selected/current price explicitly.",
          },
        },
      },
    ),
  },
  "/billing/enrollments/{id}/activate": {
    post: operation(
      "Explicit administrator activation, including free cohorts",
      "INSCRIPCION_VALIDAR",
      reason,
    ),
  },
  "/billing/enrollments/{id}/payments": {
    post: operation(
      "Atomically collect allocated amounts and issue an internal receipt",
      "PAGO_VALIDAR",
      {
        type: "object",
        required: [
          "clave_idempotencia",
          "metodo_pago",
          "numero_referencia_o_recibo",
          "aplicaciones",
        ],
        additionalProperties: false,
        properties: {
          clave_idempotencia: { type: "string", minLength: 8, maxLength: 100 },
          metodo_pago: {
            type: "string",
            enum: ["BAUCHER_BANCARIO", "CAJA_ADMINISTRATIVA", "TRANSFERENCIA"],
          },
          numero_referencia_o_recibo: {
            type: "string",
            minLength: 1,
            maxLength: 100,
          },
          banco_origen: { type: "string", nullable: true },
          fecha_pago_reportada: { type: "string" },
          aplicaciones: {
            type: "array",
            minItems: 1,
            maxItems: 121,
            items: allocation,
          },
        },
      },
    ),
  },
  "/billing/enrollments/{id}/payments/{paymentId}/cancel": {
    post: {
      ...operation(
        "Void an approved payment with retained audit/document",
        "PAGO_ANULAR",
        reason,
      ),
      parameters: [
        id,
        {
          in: "path",
          name: "paymentId",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
    },
  },
  "/billing/enrollments/{id}/obligations/{obligationId}/cancel": {
    post: {
      ...operation(
        "Void an obligation with no paid or pending allocation",
        "OBLIGACION_ANULAR",
        reason,
      ),
      parameters: [
        id,
        {
          in: "path",
          name: "obligationId",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
    },
  },
  "/billing/enrollments/{id}/receipts/{receiptId}.pdf": {
    get: {
      ...operation(
        "Download or print a protected internal receipt",
        "owner or INSCRIPCION_VALIDAR or PAGO_VALIDAR",
      ),
      parameters: [
        id,
        {
          in: "path",
          name: "receiptId",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        200: {
          description: "Internal receipt, including any void annotation",
          content: {
            "application/pdf": { schema: { type: "string", format: "binary" } },
          },
        },
      },
    },
  },
  "/billing/enrollments/{id}/audit": {
    get: operation("Read the latest 200 economic audit events", "PAGO_VALIDAR"),
  },
  "/billing/dashboard": {
    get: {
      ...operation(
        "Read authoritative collection totals and recent operations",
        "COHORTE_GESTIONAR or INSCRIPCION_VALIDAR or PAGO_VALIDAR",
      ),
      parameters: [],
    },
  },
};
