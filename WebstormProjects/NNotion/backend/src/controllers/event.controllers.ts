import { Request, Response, NextFunction } from "express";
import { z, ZodTypeAny } from "zod";
import {
    CreateEventFromPollSchema,
    CreateEventSchema,
    DeleteEventSchema,
    EventFilterSchema,
    GetEventSchema,
    UpdateEventSchema,
} from "../schemas/event.schema";
import { EventService } from "../services/event.services";
import { AppError } from "../errors/app-error";

function validateOrThrow<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
    const parsed = schema.safeParse(data);

    if (!parsed.success) {
        throw new AppError("Ошибка проверки данных", 400, parsed.error.flatten());
    }

    return parsed.data;
}

export class EventController {
    static create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = validateOrThrow(CreateEventSchema, req.body);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new EventService();
            const event = await service.create(currentUser, dto);

            return res.status(201).json({ event });
        } catch (e) {
            return next(e);
        }
    };

    static createFromPoll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = validateOrThrow(CreateEventFromPollSchema, req.body);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new EventService();
            const event = await service.createFromPoll(currentUser, dto);

            return res.status(201).json({ event });
        } catch (e) {
            return next(e);
        }
    };

    static list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = validateOrThrow(EventFilterSchema, req.query);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new EventService();
            const events = await service.list(currentUser, query);

            return res.json({ events });
        } catch (e) {
            return next(e);
        }
    };

    static getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetEventSchema, req.params);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new EventService();
            const event = await service.getById(currentUser, params);

            return res.json({ event });
        } catch (e) {
            return next(e);
        }
    };

    static update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetEventSchema, req.params);
            const dto = validateOrThrow(UpdateEventSchema, req.body);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new EventService();
            const event = await service.update(currentUser, params, dto);

            return res.json({ event });
        } catch (e) {
            return next(e);
        }
    };

    static remove = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(DeleteEventSchema, req.params);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new EventService();
            await service.delete(currentUser, params);

            return res.status(204).send();
        } catch (e) {
            return next(e);
        }
    };

    static cancel = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetEventSchema, req.params);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new EventService();
            const event = await service.cancel(currentUser, params);

            return res.json({ event });
        } catch (e) {
            return next(e);
        }
    };

    static complete = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetEventSchema, req.params);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new EventService();
            const event = await service.complete(currentUser, params);

            return res.json({ event });
        } catch (e) {
            return next(e);
        }
    };
}
