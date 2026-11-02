import { prisma } from "../config/prisma";
import {
    AddStudentToGroupDto,
    GetGroupStudentsDto,
    ImportStudentsToGroupDto,
    RemoveStudentFromGroupDto,
} from "../schemas/group_students.schema";
import { users_role } from "../../generated/prisma/enums";
import { AppError } from "../errors/app-error";
import type { AuthUser } from "../midllewares/user.middleware";
import bcrypt from "bcryptjs";

export class GroupStudentService {
    async addStudent(currentUser: AuthUser, data: AddStudentToGroupDto) {
        const group = await prisma.study_groups.findUnique({
            where: { id: data.groupId },
        });

        if (!group) {
            throw new AppError("Группа не найдена", 404);
        }

        this.assertCanManageGroup(currentUser, group.teacherId);

        const student = await prisma.users.findUnique({
            where: { id: data.studentId },
        });

        if (!student) {
            throw new AppError("Студент не найден", 404);
        }

        if (student.role !== users_role.student) {
            throw new AppError("В группу можно добавить только студента", 400);
        }

        if (!student.isActive) {
            throw new AppError("Учётная запись студента деактивирована", 400);
        }

        if (student.groupId === data.groupId) {
            throw new AppError("Студент уже состоит в этой группе", 409);
        }

        const updatedStudent = await prisma.users.update({
            where: { id: data.studentId },
            data: { groupId: data.groupId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                groupId: true,
                isActive: true,
                createdAt: true,
            },
        });

        return updatedStudent;
    }

    async getStudentsByGroup(currentUser: AuthUser, params: GetGroupStudentsDto) {
        const group = await prisma.study_groups.findUnique({
            where: { id: params.groupId },
        });

        if (!group) {
            throw new AppError("Группа не найдена", 404);
        }

        await this.assertCanReadGroupStudents(currentUser, group.id, group.teacherId);

        const students = await prisma.users.findMany({
            where: {
                groupId: params.groupId,
                role: users_role.student,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                groupId: true,
                isActive: true,
                createdAt: true,
            },
            orderBy: {
                id: "asc",
            },
        });

        return students;
    }

    async removeStudent(currentUser: AuthUser, params: RemoveStudentFromGroupDto) {
        const group = await prisma.study_groups.findUnique({
            where: { id: params.groupId },
        });

        if (!group) {
            throw new AppError("Группа не найдена", 404);
        }

        this.assertCanManageGroup(currentUser, group.teacherId);

        const student = await prisma.users.findUnique({
            where: { id: params.studentId },
        });

        if (!student) {
            throw new AppError("Студент не найден", 404);
        }

        if (student.groupId !== params.groupId) {
            throw new AppError("Студент не состоит в этой группе", 400);
        }

        await prisma.users.update({
            where: { id: params.studentId },
            data: { groupId: null },
        });

        return { success: true };
    }

    async importStudents(currentUser: AuthUser, data: ImportStudentsToGroupDto) {
        const group = await prisma.study_groups.findUnique({
            where: { id: data.groupId },
        });

        if (!group) {
            throw new AppError("Группа не найдена", 404);
        }

        this.assertCanManageGroup(currentUser, group.teacherId);

        const errors: Array<{ row: number; email?: string; message: string }> = [];
        let added = 0;
        let skipped = 0;
        const seenEmails = new Set<string>();

        for (const [index, row] of data.students.entries()) {
            const email = row.email.trim().toLowerCase();
            const name = row.name.trim();

            if (seenEmails.has(email)) {
                skipped += 1;
                errors.push({ row: index + 1, email, message: "Дубликат в импортируемом файле" });
                continue;
            }

            seenEmails.add(email);

            const existing = await prisma.users.findUnique({ where: { email } });

            if (existing) {
                if (existing.role !== users_role.student) {
                    skipped += 1;
                errors.push({ row: index + 1, email, message: "Электронная почта занята пользователем с другой ролью" });
                    continue;
                }

                if (existing.groupId === data.groupId) {
                    skipped += 1;
                    errors.push({ row: index + 1, email, message: "Студент уже состоит в этой группе" });
                    continue;
                }

                await prisma.users.update({
                    where: { id: existing.id },
                    data: { groupId: data.groupId },
                });
                added += 1;
                continue;
            }

            const passHash = await bcrypt.hash(row.password ?? "student123", 10);
            await prisma.users.create({
                data: {
                    email,
                    name,
                    passHash,
                    role: users_role.student,
                    groupId: data.groupId,
                },
            });
            added += 1;
        }

        return {
            added,
            skipped,
            errors,
        };
    }

    private assertCanManageGroup(currentUser: AuthUser, teacherId: number | null) {
        if (currentUser.role === users_role.admin) {
            return;
        }

        if (currentUser.role === users_role.teacher && teacherId === currentUser.id) {
            return;
        }

        throw new AppError("Недостаточно прав", 403);
    }

    private async assertCanReadGroupStudents(currentUser: AuthUser, groupId: number, teacherId: number | null) {
        if (currentUser.role === users_role.admin) {
            return;
        }

        if (currentUser.role !== users_role.teacher) {
            throw new AppError("Недостаточно прав", 403);
        }

        if (teacherId === currentUser.id) {
            return;
        }

        const teachingAssignment = await prisma.teaching_assignments.findFirst({
            where: {
                teacherId: currentUser.id,
                groupId,
            },
            select: {
                id: true,
            },
        });

        if (teachingAssignment) {
            return;
        }

        throw new AppError("Недостаточно прав", 403);
    }
}
