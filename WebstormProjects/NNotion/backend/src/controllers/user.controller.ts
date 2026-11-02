import { Request, Response, NextFunction } from "express";
import { z, ZodTypeAny } from "zod";
import {
    AdminCreateUserSchema,
    UserRegistrationSchema,
    loginUserSchema,
    RoleLoginSchema,
    UserLoginSchema,
    UpdateUserSchema,
    GetUserSchema,
    DeleteUserSchema,
    UserChangePasswordSchema,
    UserFilterSchema,
} from "../schemas/user.schema";
import { UserService } from "../services/user.service";
import { AppError } from "../errors/app-error";
import { users_role } from "../../generated/prisma/enums";

function validateOrThrow<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
    const parsed = schema.safeParse(data);

    if (!parsed.success) {
        throw new AppError("Ошибка валидации", 400, parsed.error.flatten());
    }

    return parsed.data;
}

export class UserController {
    static register = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = validateOrThrow(UserRegistrationSchema, req.body);

            if (dto.role !== users_role.student) {
                throw new AppError("Публичная регистрация доступна только студентам", 403);
            }

            const service = new UserService();
            const result = await service.register(dto);

            return res.status(201).json(result);
        } catch (e) {
            return next(e);
        }
    };

    static createByAdmin = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = validateOrThrow(AdminCreateUserSchema, req.body);

            const service = new UserService();
            const user = await service.createByAdmin(dto);

            return res.status(201).json({ user });
        } catch (e) {
            return next(e);
        }
    };

    static me = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new UserService();
            const user = await service.getMe(userId);

            return res.json({ user });
        } catch (e) {
            return next(e);
        }
    };

    static login = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = validateOrThrow(loginUserSchema, req.body);

            const service = new UserService();
            const result = await service.login(dto);

            return res.json(result);
        } catch (e) {
            return next(e);
        }
    };

    static roleLogin = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = validateOrThrow(RoleLoginSchema, req.body);

            const service = new UserService();
            const result = await service.roleLogin(dto);

            return res.json(result);
        } catch (e) {
            return next(e);
        }
    };

    static loginOptions = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const service = new UserService();
            const users = await service.listLoginOptions();

            return res.json({ users });
        } catch (e) {
            return next(e);
        }
    };

    static userLogin = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = validateOrThrow(UserLoginSchema, req.body);

            const service = new UserService();
            const result = await service.userLogin(dto);

            return res.json(result);
        } catch (e) {
            return next(e);
        }
    };

    static getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetUserSchema, req.params);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new UserService();
            const user = await service.getById(currentUser, params);

            return res.json({ user });
        } catch (e) {
            return next(e);
        }
    };

    static list = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = validateOrThrow(UserFilterSchema, req.query);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new UserService();
            const users = await service.list(currentUser, query);

            return res.json({ users });
        } catch (e) {
            return next(e);
        }
    };

    static update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetUserSchema, req.params);
            const dto = validateOrThrow(UpdateUserSchema, req.body);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new UserService();
            const user = await service.update(currentUser, params, dto);

            return res.json({ user });
        } catch (e) {
            return next(e);
        }
    };

    static remove = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(DeleteUserSchema, req.params);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new UserService();
            await service.delete(currentUser, params);

            return res.status(204).send();
        } catch (e) {
            return next(e);
        }
    };

    static changePassword = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = validateOrThrow(UserChangePasswordSchema, req.body);

            const userId = req.user?.id;
            if (!userId) {
                return next(new AppError("Необходима авторизация", 401));
            }

            const service = new UserService();
            await service.changePassword(userId, dto);

            return res.status(204).send();
        } catch (e) {
            return next(e);
        }
    };

    static adminStats = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const service = new UserService();
            const stats = await service.getAdminStats();

            return res.json({ stats });
        } catch (e) {
            return next(e);
        }
    };
}
