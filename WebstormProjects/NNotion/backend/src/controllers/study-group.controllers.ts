import { Request, Response, NextFunction } from "express";
import { z, ZodTypeAny } from "zod";
import {
    CreateStudyGroupSchema,
    UpdateStudyGroupSchema,
    GetStudyGroupSchema,
    DeleteStudyGroupSchema,
    StudyGroupFilterSchema,
    TeachingGroupsByDisciplineSchema,
} from "../schemas/study-group.schemas";
import { StudyGroupService } from "../services/study-group.services";
import { AppError } from "../errors/app-error";

function validateOrThrow<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
    const parsed = schema.safeParse(data);

    if (!parsed.success) {
        throw new AppError("Ошибка валидации", 400, parsed.error.flatten());
    }

    return parsed.data;
}

export class StudyGroupController {
    static create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = validateOrThrow(CreateStudyGroupSchema, req.body);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new StudyGroupService();
            const group = await service.create(currentUser, dto);

            return res.status(201).json({ group });
        } catch (e) {
            return next(e);
        }
    };

    static getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetStudyGroupSchema, req.params);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new StudyGroupService();
            const group = await service.getById(currentUser, params);

            return res.json({ group });
        } catch (e) {
            return next(e);
        }
    };

    static list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = validateOrThrow(StudyGroupFilterSchema, req.query);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new StudyGroupService();
            const groups = await service.list(currentUser, query);

            return res.json({ groups });
        } catch (e) {
            return next(e);
        }
    };

    static listTeachingDisciplines = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new StudyGroupService();
            const disciplines = await service.listTeachingDisciplines(currentUser);

            return res.json({ disciplines });
        } catch (e) {
            return next(e);
        }
    };

    static listTeachingGroupsByDiscipline = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = validateOrThrow(TeachingGroupsByDisciplineSchema, req.query);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new StudyGroupService();
            const groups = await service.listTeachingGroupsByDiscipline(currentUser, query.discipline);

            return res.json({ groups });
        } catch (e) {
            return next(e);
        }
    };

    static update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetStudyGroupSchema, req.params);
            const dto = validateOrThrow(UpdateStudyGroupSchema, req.body);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new StudyGroupService();
            const group = await service.update(currentUser, params, dto);

            return res.json({ group });
        } catch (e) {
            return next(e);
        }
    };

    static remove = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(DeleteStudyGroupSchema, req.params);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new StudyGroupService();
            await service.delete(currentUser, params);

            return res.status(204).send();
        } catch (e) {
            return next(e);
        }
    };
}
