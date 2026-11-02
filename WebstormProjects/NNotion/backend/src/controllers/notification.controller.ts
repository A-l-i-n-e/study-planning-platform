import { Request, Response, NextFunction } from "express";
import { z, ZodTypeAny } from "zod";
import {
    CreateNotificationSchema,
    GetNotificationSchema,
    NotificationFilterSchema,
    MarkNotificationReadSchema,
    UpdateNotificationSettingsSchema,
    UpdateNotificationStatusSchema,
} from "../schemas/notification.schema";
import { NotificationService } from "../services/notification.service";
import { AppError } from "../errors/app-error";

function validateOrThrow<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
    const parsed = schema.safeParse(data);

    if (!parsed.success) {
        throw new AppError("Ошибка валидации", 400, parsed.error.flatten());
    }

    return parsed.data;
}

export class NotificationController {
    static create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = validateOrThrow(CreateNotificationSchema, req.body);

            const service = new NotificationService();
            const notification = await service.create(dto);

            return res.status(201).json({ notification });
        } catch (e) {
            return next(e);
        }
    };

    static list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = validateOrThrow(NotificationFilterSchema, req.query);

            const service = new NotificationService();
            const notifications = await service.list(query);

            return res.json({ notifications });
        } catch (e) {
            return next(e);
        }
    };

    static getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetNotificationSchema, req.params);

            const currentUserId = req.user?.id;
            if (!currentUserId) {
                return next(new AppError("Необходима авторизация", 401));
            }

            const service = new NotificationService();
            await service.checkAccessToNotification(currentUserId, params.id);
            const notification = await service.getById(params);

            return res.json({ notification });
        } catch (e) {
            return next(e);
        }
    };

    static updateStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetNotificationSchema, req.params);
            const dto = validateOrThrow(UpdateNotificationStatusSchema, req.body);

            const currentUserId = req.user?.id;
            if (!currentUserId) {
                return next(new AppError("Необходима авторизация", 401));
            }

            const service = new NotificationService();
            await service.checkAccessToNotification(currentUserId, params.id);
            const notification = await service.updateStatus(params, dto);

            return res.json({ notification });
        } catch (e) {
            return next(e);
        }
    };

    static markRead = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetNotificationSchema, req.params);
            const dto = validateOrThrow(MarkNotificationReadSchema, req.body);

            const currentUserId = req.user?.id;
            if (!currentUserId) {
                return next(new AppError("Необходима авторизация", 401));
            }

            const service = new NotificationService();
            await service.checkAccessToNotification(currentUserId, params.id);
            const notification = await service.markRead(params, dto.read);

            return res.json({ notification });
        } catch (e) {
            return next(e);
        }
    };

    static remove = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetNotificationSchema, req.params);

            const currentUserId = req.user?.id;
            if (!currentUserId) {
                return next(new AppError("Необходима авторизация", 401));
            }

            const service = new NotificationService();
            await service.checkAccessToNotification(currentUserId, params.id);
            await service.delete(params);

            return res.status(204).send();
        } catch (e) {
            return next(e);
        }
    };

    static listMine = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const currentUserId = req.user?.id;
            if (!currentUserId) {
                return next(new AppError("Необходима авторизация", 401));
            }

            const service = new NotificationService();
            const notifications = await service.listMyNotifications(currentUserId);

            return res.json({ notifications });
        } catch (e) {
            return next(e);
        }
    };

    static getMySettings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const currentUserId = req.user?.id;
            if (!currentUserId) {
                return next(new AppError("Необходима авторизация", 401));
            }

            const service = new NotificationService();
            const settings = await service.getMySettings(currentUserId);

            return res.json({ settings });
        } catch (e) {
            return next(e);
        }
    };

    static updateMySettings = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = validateOrThrow(UpdateNotificationSettingsSchema, req.body);

            const currentUserId = req.user?.id;
            if (!currentUserId) {
                return next(new AppError("Необходима авторизация", 401));
            }

            const service = new NotificationService();
            const settings = await service.updateMySettings(currentUserId, dto);

            return res.json({ settings });
        } catch (e) {
            return next(e);
        }
    };
}
