import { Request, Response, NextFunction } from "express";
import { z, ZodTypeAny } from "zod";
import {
    AddStudentToGroupSchema,
    GetGroupStudentsSchema,
    ImportStudentsToGroupSchema,
    RemoveStudentFromGroupSchema,
} from "../schemas/group_students.schema";
import { GroupStudentService } from "../services/group_students.services";
import { AppError } from "../errors/app-error";

function validateOrThrow<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
    const parsed = schema.safeParse(data);

    if (!parsed.success) {
        throw new AppError("Ошибка валидации", 400, parsed.error.flatten());
    }

    return parsed.data;
}

export class GroupStudentController {
    static addStudent = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = validateOrThrow(AddStudentToGroupSchema, {
                groupId: req.params.groupId,
                studentId: req.body.studentId,
            });
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new GroupStudentService();
            const result = await service.addStudent(currentUser, dto);

            return res.status(201).json({ groupStudent: result });
        } catch (e) {
            return next(e);
        }
    };

    static getStudentsByGroup = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetGroupStudentsSchema, {
                groupId: req.params.groupId,
            });
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new GroupStudentService();
            const students = await service.getStudentsByGroup(currentUser, params);

            return res.json({ students });
        } catch (e) {
            return next(e);
        }
    };

    static removeStudent = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(RemoveStudentFromGroupSchema, {
                groupId: req.params.groupId,
                studentId: req.params.studentId,
            });
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new GroupStudentService();
            await service.removeStudent(currentUser, params);

            return res.status(204).send();
        } catch (e) {
            return next(e);
        }
    };

    static importStudents = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = validateOrThrow(ImportStudentsToGroupSchema, {
                groupId: req.params.groupId,
                students: req.body.students,
            });
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new GroupStudentService();
            const result = await service.importStudents(currentUser, dto);

            return res.json({ result });
        } catch (e) {
            return next(e);
        }
    };
}
