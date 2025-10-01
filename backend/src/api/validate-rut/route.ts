import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { validateRUT, formatRUT } from "../../utils/chilean-utils";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { rut } = req.body as { rut?: string };

    if (!rut) {
      res.status(400).json({
        success: false,
        message: "RUT es requerido",
      });
      return;
    }

    const isValid = validateRUT(rut);
    const formattedRUT = isValid ? formatRUT(rut) : null;

    res.json({
      success: true,
      data: {
        rut: rut,
        formattedRUT,
        isValid,
      },
    });
  } catch (error: any) {
    console.error("Error validating RUT:", error);
    res.status(500).json({
      success: false,
      message: "Error al validar RUT",
      error: error.message,
    });
  }
}
