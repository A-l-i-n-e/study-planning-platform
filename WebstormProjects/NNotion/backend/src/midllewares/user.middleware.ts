import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { users_role } from "../../generated/prisma/enums";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "../errors/app-error";

export type AuthUser = {
    id: number;
    role: users_role;
    email: string;
    groupId: number | null;
};

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

export async function authRequired(req: Request, _res: Response, next: NextFunction) {
    try {
        const authHeader = req.header("authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return next(new AppError("Необходима авторизация", 401));
        }

        const token = authHeader.substring("Bearer ".length).trim();

        if (!token) {
            return next(new AppError("Необходима авторизация", 401));
        }

        const payload = verifyAccessToken(token);

        const user = await prisma.users.findUnique({
            where: { id: payload.id },
            select: {
                id: true,
                email: true,
                role: true,
                groupId: true,
                isActive: true,
            },
        });

        if (!user || !user.isActive) {
            return next(new AppError("Пользователь не найден или токен недействителен", 401));
        }

        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            groupId: user.groupId,
        };

        next();
    } catch (_error) {
        return next(new AppError("Недействительный токен", 401));
    }
}

export function roleRequired(...roles: users_role[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user) {
            return next(new AppError("Необходима авторизация", 401));
        }

        if (!roles.includes(req.user.role)) {
            return next(new AppError("Недостаточно прав", 403));
        }

        next();
    };
}
