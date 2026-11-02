import { Request, Response, NextFunction } from "express";
import { z, ZodTypeAny } from "zod";
import {
    CreatePollSchema,
    DeletePollSchema,
    GetPollRecommendationsSchema,
    GetPollSchema,
    ApprovePollResultSchema,
    PollFilterSchema,
    UpdatePollSchema,
} from "../schemas/poll.schema";
import { PollService } from "../services/poll.service";
import { AppError } from "../errors/app-error";

function validateOrThrow<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
    const parsed = schema.safeParse(data);

    if (!parsed.success) {
        throw new AppError("Ошибка проверки данных", 400, parsed.error.flatten());
    }

    return parsed.data;
}

export class PollController {
    static create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = validateOrThrow(CreatePollSchema, req.body);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new PollService();
            const poll = await service.create(currentUser, dto);

            return res.status(201).json({ poll });
        } catch (e) {
            return next(e);
        }
    };

    static list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = validateOrThrow(PollFilterSchema, req.query);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new PollService();
            const polls = await service.list(currentUser, query);

            return res.json({ polls });
        } catch (e) {
            return next(e);
        }
    };

    static getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetPollSchema, req.params);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new PollService();
            const poll = await service.getById(currentUser, params);

            return res.json({ poll });
        } catch (e) {
            return next(e);
        }
    };

    static getRecommendations = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetPollRecommendationsSchema, req.params);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new PollService();
            const recommendations = await service.getRecommendations(currentUser, params);

            return res.json(recommendations);
        } catch (e) {
            return next(e);
        }
    };

    static update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetPollSchema, req.params);
            const dto = validateOrThrow(UpdatePollSchema, req.body);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new PollService();
            const poll = await service.update(currentUser, params, dto);

            return res.json({ poll });
        } catch (e) {
            return next(e);
        }
    };

    static remove = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(DeletePollSchema, req.params);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new PollService();
            await service.delete(currentUser, params);

            return res.status(204).send();
        } catch (e) {
            return next(e);
        }
    };

    static activate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetPollSchema, req.params);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new PollService();
            const poll = await service.activate(currentUser, params);

            return res.json({ poll });
        } catch (e) {
            return next(e);
        }
    };

    static close = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetPollSchema, req.params);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new PollService();
            const poll = await service.close(currentUser, params);

            return res.json({ poll });
        } catch (e) {
            return next(e);
        }
    };

    static approveResult = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetPollSchema, req.params);
            const dto = validateOrThrow(ApprovePollResultSchema, req.body);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new PollService();
            const poll = await service.approveResult(currentUser, params, dto);

            return res.json({ poll });
        } catch (e) {
            return next(e);
        }
    };
}
