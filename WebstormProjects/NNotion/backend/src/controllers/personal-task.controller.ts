import { Request, Response, NextFunction } from "express";
import { z, ZodTypeAny } from "zod";
import { AppError } from "../errors/app-error";
import {
    CreatePersonalTaskSchema,
    GetPersonalTaskSchema,
    PersonalTaskFilterSchema,
    UpdatePersonalTaskSchema,
} from "../schemas/personal-task.schema";
import { PersonalTaskService } from "../services/personal-task.service";

function validateOrThrow<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
    const parsed = schema.safeParse(data);

    if (!parsed.success) {
        throw new AppError("Ошибка валидации", 400, parsed.error.flatten());
    }

    return parsed.data;
}

export class PersonalTaskController {
    static create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const dto = validateOrThrow(CreatePersonalTaskSchema, req.body);
            const task = await new PersonalTaskService().create(req.user.id, dto);

            return res.status(201).json({ task });
        } catch (e) {
            return next(e);
        }
    };

    static listMine = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const query = validateOrThrow(PersonalTaskFilterSchema, req.query);
            const tasks = await new PersonalTaskService().listMine(req.user.id, query);

            return res.json({ tasks });
        } catch (e) {
            return next(e);
        }
    };

    static update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const params = validateOrThrow(GetPersonalTaskSchema, req.params);
            const dto = validateOrThrow(UpdatePersonalTaskSchema, req.body);
            const task = await new PersonalTaskService().update(req.user.id, params, dto);

            return res.json({ task });
        } catch (e) {
            return next(e);
        }
    };

    static remove = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const params = validateOrThrow(GetPersonalTaskSchema, req.params);
            await new PersonalTaskService().delete(req.user.id, params);

            return res.status(204).send();
        } catch (e) {
            return next(e);
        }
    };
}
