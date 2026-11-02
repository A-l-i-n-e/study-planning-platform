import { prisma } from "../config/prisma";
import {
    AdminCreateUserSchemaDto,
    UserRegistrationSchemaDto,
    loginUserSchemaDto,
    RoleLoginSchemaDto,
    UserLoginSchemaDto,
    UpdateUserSchemaDto,
    GetUserSchemaDto,
    DeleteUserSchemaDto,
    UserChangePasswordSchemaDto,
    UserFilterSchemaDto,
} from "../schemas/user.schema";
import { users_role } from "../../generated/prisma/enums";
import bcrypt from "bcryptjs";
import { signAccessToken } from "../utils/jwt";
import { AppError } from "../errors/app-error";
import type { AuthUser } from "../midllewares/user.middleware";

const DEMO_USERS: Record<users_role, { email: string; name: string; password: string }> = {
    [users_role.student]: {
        email: "demo-student@local.demo",
        name: "Демо студент",
        password: "student123",
    },
    [users_role.teacher]: {
        email: "demo-teacher@local.demo",
        name: "Демо преподаватель",
        password: "teacher123",
    },
    [users_role.admin]: {
        email: "demo-admin@local.demo",
        name: "Демо администратор",
        password: "admin123",
    },
};

export class UserService {
    async register(data: UserRegistrationSchemaDto) {
        const user = await this.createUser(data);

        const token = signAccessToken({
            id: user.id,
            email: user.email,
            role: user.role,
        });

        return { user, token };
    }

    async createByAdmin(data: AdminCreateUserSchemaDto) {
        return this.createUser(data);
    }

    async login(data: loginUserSchemaDto) {
        const user = await prisma.users.findUnique({
            where: { email: data.email },
        });

        if (!user || !user.isActive) {
            throw new AppError("Неверная электронная почта или пароль", 401);
        }

        const isPasswordValid = await bcrypt.compare(data.password, user.passHash);

        if (!isPasswordValid) {
            throw new AppError("Неверная электронная почта или пароль", 401);
        }

        const safeUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            groupId: user.groupId,
            isActive: user.isActive,
            createdAt: user.createdAt,
        };

        const token = signAccessToken({
            id: user.id,
            email: user.email,
            role: user.role,
        });

        return {
            user: safeUser,
            token,
        };
    }

    async roleLogin(data: RoleLoginSchemaDto) {
        const user = await prisma.users.findFirst({
            where: {
                role: data.role,
                isActive: true,
            },
            orderBy: { id: "asc" },
            select: this.safeUserSelect,
        }) ?? await this.createDemoUser(data.role);

        return this.buildAuthResponse(user);
    }

    async listLoginOptions() {
        return prisma.users.findMany({
            where: { isActive: true },
            orderBy: [
                { role: "asc" },
                { name: "asc" },
            ],
            select: this.safeUserSelect,
        });
    }

    async userLogin(data: UserLoginSchemaDto) {
        const user = await prisma.users.findUnique({
            where: { id: data.userId },
            select: this.safeUserSelect,
        });

        if (!user) {
            throw new AppError("Пользователь не найден", 404);
        }

        return this.buildAuthResponse(user);
    }

    async getMe(userId: number) {
        const user = await prisma.users.findUnique({
            where: { id: userId },
            select: this.safeUserSelect,
        });

        if (!user) {
            throw new AppError("Пользователь не найден", 404);
        }

        return user;
    }

    async getById(currentUser: AuthUser, params: GetUserSchemaDto) {
        const user = await prisma.users.findUnique({
            where: { id: params.id },
            select: this.safeUserSelect,
        });

        if (!user) {
            throw new AppError("Пользователь не найден", 404);
        }

        if (!this.canReadUser(currentUser, user)) {
            throw new AppError("Недостаточно прав", 403);
        }

        return user;
    }

    async list(currentUser: AuthUser, filter: UserFilterSchemaDto) {
        if (currentUser.role === users_role.admin) {
            return prisma.users.findMany({
                where: this.buildUserFilter(filter),
                orderBy: { createdAt: "desc" },
                select: this.safeUserSelect,
            });
        }

        if (currentUser.role !== users_role.teacher) {
            throw new AppError("Недостаточно прав", 403);
        }

        if (filter.role && filter.role !== users_role.student) {
            return [];
        }

        const groupIds = await this.getTeacherGroupIds(currentUser.id);

        if (filter.groupId && !groupIds.includes(filter.groupId)) {
            return [];
        }

        if (groupIds.length === 0) {
            return [];
        }

        const users = await prisma.users.findMany({
            where: {
                ...this.buildUserFilter({
                    ...filter,
                    role: users_role.student,
                }),
                groupId: filter.groupId ?? { in: groupIds },
            },
            orderBy: { createdAt: "desc" },
            select: this.safeUserSelect,
        });

        return users;
    }

    async update(currentUser: AuthUser, params: GetUserSchemaDto, data: UpdateUserSchemaDto) {
        const existingUser = await prisma.users.findUnique({
            where: { id: params.id },
        });

        if (!existingUser) {
            throw new AppError("Пользователь не найден", 404);
        }

        if (data.email) {
            const emailTaken = await prisma.users.findUnique({
                where: { email: data.email },
            });

            if (emailTaken && emailTaken.id !== params.id) {
                throw new AppError("Пользователь с такой электронной почтой уже существует", 409);
            }
        }

        if (currentUser.id === params.id && data.isActive === false) {
            throw new AppError("Нельзя деактивировать собственную учётную запись", 400);
        }

        if (data.groupId !== undefined && data.groupId !== null) {
            const group = await prisma.study_groups.findUnique({
                where: { id: data.groupId },
            });

            if (!group) {
                throw new AppError("Группа не найдена", 404);
            }
        }

        const nextRole = data.role ?? existingUser.role;

        if (nextRole !== users_role.student && data.groupId !== undefined && data.groupId !== null) {
            throw new AppError("К группам можно привязывать только студентов", 400);
        }

        const user = await prisma.users.update({
            where: { id: params.id },
            data: {
                ...(data.email ? { email: data.email } : {}),
                ...(data.name ? { name: data.name } : {}),
                ...(data.role ? { role: data.role } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
                ...(data.groupId !== undefined ? { groupId: data.groupId } : {}),
                ...(data.role && data.role !== users_role.student ? { groupId: null } : {}),
            },
            select: this.safeUserSelect,
        });

        return user;
    }

    async delete(currentUser: AuthUser, params: DeleteUserSchemaDto) {
        const existingUser = await prisma.users.findUnique({
            where: { id: params.id },
        });

        if (!existingUser) {
            throw new AppError("Пользователь не найден", 404);
        }

        if (currentUser.id === params.id) {
            throw new AppError("Нельзя удалить собственную учётную запись", 400);
        }

        await prisma.users.delete({
            where: { id: params.id },
        });

        return { success: true };
    }

    async changePassword(userId: number, data: UserChangePasswordSchemaDto) {
        const user = await prisma.users.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new AppError("Пользователь не найден", 404);
        }

        const isOldPasswordValid = await bcrypt.compare(data.oldPassword, user.passHash);

        if (!isOldPasswordValid) {
            throw new AppError("Старый пароль указан неверно", 400);
        }

        const newHashedPassword = await bcrypt.hash(data.newPassword, 10);

        await prisma.users.update({
            where: { id: userId },
            data: { passHash: newHashedPassword },
        });

        return { success: true };
    }

    async getAdminStats() {
        const [studentsCount, teachersCount, groupsCount, pollsCount, eventsCount] = await Promise.all([
            prisma.users.count({ where: { role: users_role.student } }),
            prisma.users.count({ where: { role: users_role.teacher } }),
            prisma.study_groups.count(),
            prisma.polls.count(),
            prisma.events.count(),
        ]);

        return {
            studentsCount,
            teachersCount,
            groupsCount,
            pollsCount,
            eventsCount,
        };
    }

    private safeUserSelect = {
        id: true,
        email: true,
        name: true,
        role: true,
        groupId: true,
        isActive: true,
        createdAt: true,
        group: {
            select: {
                id: true,
                name: true,
                description: true,
                teacherId: true,
            },
        },
    } as const;

    private async createUser(data: UserRegistrationSchemaDto | AdminCreateUserSchemaDto) {
        const existingUser = await prisma.users.findUnique({
            where: { email: data.email },
        });

        if (existingUser) {
            throw new AppError("Пользователь с такой электронной почтой уже существует", 409);
        }

        if ("groupId" in data && data.groupId !== undefined && data.groupId !== null) {
            if (data.role !== users_role.student) {
                throw new AppError("К группам можно привязывать только студентов", 400);
            }

            const group = await prisma.study_groups.findUnique({
                where: { id: data.groupId },
                select: { id: true },
            });

            if (!group) {
                throw new AppError("Группа не найдена", 404);
            }
        }

        const hashedPassword = await bcrypt.hash(data.passHash, 10);

        const user = await prisma.users.create({
            data: {
                email: data.email,
                name: data.name,
                passHash: hashedPassword,
                role: data.role,
                ...("groupId" in data && data.groupId !== undefined ? { groupId: data.groupId } : {}),
            },
            select: this.safeUserSelect,
        });

        return user;
    }

    private async createDemoUser(role: users_role) {
        const demoUser = DEMO_USERS[role];
        let email = demoUser.email;

        const existingUser = await prisma.users.findUnique({
            where: { email },
            select: this.safeUserSelect,
        });

        if (existingUser?.role === role && existingUser.isActive) {
            return existingUser;
        }

        if (existingUser) {
            email = `demo-${role}-${Date.now()}@local.demo`;
        }

        const passHash = await bcrypt.hash(demoUser.password, 10);

        return prisma.users.create({
            data: {
                email,
                name: demoUser.name,
                passHash,
                role,
            },
            select: this.safeUserSelect,
        });
    }

    private buildAuthResponse(user: {
        id: number;
        email: string;
        name: string;
        role: users_role;
        groupId: number | null;
        isActive: boolean;
        createdAt: Date;
    }) {
        if (!user.isActive) {
            throw new AppError("Учётная запись деактивирована", 403);
        }

        const token = signAccessToken({
            id: user.id,
            email: user.email,
            role: user.role,
        });

        return {
            user,
            token,
        };
    }

    private buildUserFilter(filter: UserFilterSchemaDto) {
        return {
            ...(filter.role ? { role: filter.role } : {}),
            ...(filter.groupId ? { groupId: filter.groupId } : {}),
            ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
            ...(filter.search
                ? {
                    OR: [
                        { email: { contains: filter.search } },
                        { name: { contains: filter.search } },
                    ],
                }
                : {}),
        };
    }

    private async getTeacherGroupIds(teacherId: number) {
        const groups = await prisma.study_groups.findMany({
            where: { teacherId },
            select: { id: true },
        });

        return groups.map((group) => group.id);
    }

    private canReadUser(
        currentUser: AuthUser,
        user: {
            id: number;
            role: users_role;
            group: { teacherId: number | null } | null;
        }
    ) {
        if (currentUser.role === users_role.admin) {
            return true;
        }

        if (currentUser.id === user.id) {
            return true;
        }

        return (
            currentUser.role === users_role.teacher &&
            user.role === users_role.student &&
            user.group?.teacherId === currentUser.id
        );
    }
}
