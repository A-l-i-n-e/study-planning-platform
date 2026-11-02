import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error";

export function notFoundMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
) {
    next(new AppError(`Маршрут ${req.method} ${req.originalUrl} не найден`, 404));
}