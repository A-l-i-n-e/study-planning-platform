import { prisma } from "../config/prisma";
import {
    CreateStudyGroupDto,
    UpdateStudyGroupDto,
    GetStudyGroupDto,
    DeleteStudyGroupDto,
    StudyGroupFilterDto,
} from "../schemas/study-group.schemas";
import { AppError } from "../errors/app-error";
import { users_role } from "../../generated/prisma/enums";
import type { AuthUser } from "../midllewares/user.middleware";

export class StudyGroupService {
    async create(currentUser: AuthUser, data: CreateStudyGroupDto) {
        const existingGroup = await prisma.study_groups.findFirst({
            where: { name: data.name },
        });

        if (existingGroup) {
            throw new AppError("Группа с таким названием уже существует", 409);
        }

        const teacherId = await this.resolveGroupTeacherId(currentUser, data.teacherId);

        const group = await prisma.study_groups.create({
            data: {
                name: data.name,
                description: data.description,
                teacherId,
            },
            include: this.groupInclude,
        });

        return group;
    }

    async getById(currentUser: AuthUser, params: GetStudyGroupDto) {
        const group = await prisma.study_groups.findUnique({
            where: { id: params.id },
            include: this.groupInclude,
        });

        if (!group) {
            throw new AppError("Группа не найдена", 404);
        }

        this.assertCanAccessGroup(currentUser, group.teacherId);

        return group;
    }

    async list(currentUser: AuthUser, filter: StudyGroupFilterDto) {
        const groups = await prisma.study_groups.findMany({
            where: {
                ...(currentUser.role === users_role.teacher ? { teacherId: currentUser.id } : {}),
                ...(filter.search
                    ? {
                        OR: [
                            {
                                name: {
                                    contains: filter.search,
                                },
                            },
                            {
                                description: {
                                    contains: filter.search,
                                },
                            },
                        ],
                    }
                    : {}),
            },
            orderBy: {
                id: "asc",
            },
            include: this.groupInclude,
        });

        return groups;
    }

    async listTeachingDisciplines(currentUser: AuthUser) {
        const assignments = await prisma.teaching_assignments.findMany({
            where: {
                ...(currentUser.role === users_role.teacher ? { teacherId: currentUser.id } : {}),
            },
            select: {
                subject: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: {
                subjectId: "asc",
            },
        });

        return Array.from(new Set(assignments.map((assignment) => assignment.subject.name))).sort((left, right) =>
            left.localeCompare(right, "ru")
        );
    }

    async listTeachingGroupsByDiscipline(currentUser: AuthUser, discipline: string) {
        const normalizedDiscipline = discipline.trim();

        if (!normalizedDiscipline) {
            throw new AppError("Укажите дисциплину", 400);
        }

        const assignments = await prisma.teaching_assignments.findMany({
            where: {
                ...(currentUser.role === users_role.teacher ? { teacherId: currentUser.id } : {}),
                subject: {
                    name: normalizedDiscipline,
                },
            },
            include: {
                group: {
                    include: this.groupInclude,
                },
            },
            orderBy: {
                groupId: "asc",
            },
        });
        const groups = new Map<number, typeof assignments[number]["group"]>();

        for (const assignment of assignments) {
            groups.set(assignment.group.id, assignment.group);
        }

        return Array.from(groups.values()).sort((left, right) => left.name.localeCompare(right.name, "ru"));
    }

    async update(currentUser: AuthUser, params: GetStudyGroupDto, data: UpdateStudyGroupDto) {
        const existingGroup = await prisma.study_groups.findUnique({
            where: { id: params.id },
        });

        if (!existingGroup) {
            throw new AppError("Группа не найдена", 404);
        }

        this.assertCanAccessGroup(currentUser, existingGroup.teacherId);

        if (data.name) {
            const duplicate = await prisma.study_groups.findFirst({
                where: {
                    name: data.name,
                    NOT: { id: params.id },
                },
            });

            if (duplicate) {
                throw new AppError("Группа с таким названием уже существует", 409);
            }
        }

        const teacherId =
            data.teacherId !== undefined
                ? await this.resolveGroupTeacherId(currentUser, data.teacherId)
                : undefined;

        const group = await prisma.study_groups.update({
            where: { id: params.id },
            data: {
                ...(data.name ? { name: data.name } : {}),
                ...(data.description ? { description: data.description } : {}),
                ...(teacherId !== undefined ? { teacherId } : {}),
            },
            include: this.groupInclude,
        });

        return group;
    }

    async delete(currentUser: AuthUser, params: DeleteStudyGroupDto) {
        const existingGroup = await prisma.study_groups.findUnique({
            where: { id: params.id },
        });

        if (!existingGroup) {
            throw new AppError("Группа не найдена", 404);
        }

        this.assertCanAccessGroup(currentUser, existingGroup.teacherId);

        await prisma.study_groups.delete({
            where: { id: params.id },
        });

        return { success: true };
    }

    private groupInclude = {
        teacher: {
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
            },
        },
        _count: {
            select: {
                students: true,
            },
        },
    } as const;

    private async resolveGroupTeacherId(currentUser: AuthUser, requestedTeacherId?: number | null) {
        if (currentUser.role === users_role.teacher) {
            if (requestedTeacherId && requestedTeacherId !== currentUser.id) {
                throw new AppError("Нельзя назначить другого преподавателя на свою группу", 403);
            }

            return currentUser.id;
        }

        if (currentUser.role !== users_role.admin) {
            throw new AppError("Недостаточно прав", 403);
        }

        if (!requestedTeacherId) {
            return null;
        }

        const teacher = await prisma.users.findFirst({
            where: {
                id: requestedTeacherId,
                role: users_role.teacher,
            },
            select: {
                id: true,
            },
        });

        if (!teacher) {
            throw new AppError("Преподаватель не найден", 404);
        }

        return requestedTeacherId;
    }

    private assertCanAccessGroup(currentUser: AuthUser, teacherId: number | null) {
        if (currentUser.role === users_role.admin) {
            return;
        }

        if (currentUser.role === users_role.teacher && teacherId === currentUser.id) {
            return;
        }

        throw new AppError("Недостаточно прав", 403);
    }
}
