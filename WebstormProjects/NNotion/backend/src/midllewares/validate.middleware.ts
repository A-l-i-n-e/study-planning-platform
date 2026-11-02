import {NextFunction, Request, Response} from "express";
import {ZodSchema} from "zod";

export const validate =
    (schema: ZodSchema) =>
        (req: Request, res: Response, next: NextFunction) => {
            try {
                req.body = schema.parse(req.body);
                next();
            } catch (error: any) {
                res.status(400).json({
                    message: "Ошибка проверки данных",
                    errors: error.errors,
                });
            }
        };
