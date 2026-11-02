import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";

export function errorMiddleware(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    console.error(err);

    if (err instanceof AppError) {
        return res.status(err.status).json({
            message: err.message,
            details: err.details ?? null,
        });
    }

    if (err instanceof Error && "status" in err) {
        return res.status(Number((err as any).status) || 500).json({
            message: err.message || "Internal server error",
            details: (err as any).details ?? null,
        });
    }

    return res.status(500).json({
        message: "Internal server error",
        details: null,
    });
}