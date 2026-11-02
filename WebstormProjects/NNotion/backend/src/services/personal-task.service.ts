import { prisma } from "../config/prisma";
import { AppError } from "../errors/app-error";
import {
    CreatePersonalTaskDto,
    GetPersonalTaskDto,
    PersonalTaskFilterDto,
    UpdatePersonalTaskDto,
} from "../schemas/personal-task.schema";

export class PersonalTaskService {
    async create(userId: number, data: CreatePersonalTaskDto) {
        const task = await prisma.personal_tasks.create({
            data: {
                userId,
                title: data.title,
                description: data.description ?? null,
                taskDate: new Date(data.taskDate),
                taskTime: data.taskTime ?? null,
            },
        });

        return task;
    }

    async listMine(userId: number, filter: PersonalTaskFilterDto) {
        return prisma.personal_tasks.findMany({
            where: {
                userId,
                ...(filter.completed !== undefined ? { completed: filter.completed } : {}),
                ...(filter.from || filter.to
                    ? {
                        taskDate: {
                            ...(filter.from ? { gte: new Date(filter.from) } : {}),
                            ...(filter.to ? { lte: new Date(filter.to) } : {}),
                        },
                    }
                    : {}),
            },
            orderBy: [{ taskDate: "asc" }, { taskTime: "asc" }],
        });
    }

    async update(userId: number, params: GetPersonalTaskDto, data: UpdatePersonalTaskDto) {
        await this.assertOwner(userId, params.id);

        return prisma.personal_tasks.update({
            where: { id: params.id },
            data: {
                ...(data.title !== undefined ? { title: data.title } : {}),
                ...(data.description !== undefined ? { description: data.description } : {}),
                ...(data.taskDate !== undefined ? { taskDate: new Date(data.taskDate) } : {}),
                ...(data.taskTime !== undefined ? { taskTime: data.taskTime } : {}),
                ...(data.completed !== undefined ? { completed: data.completed } : {}),
            },
        });
    }

    async delete(userId: number, params: GetPersonalTaskDto) {
        await this.assertOwner(userId, params.id);

        await prisma.personal_tasks.delete({
            where: { id: params.id },
        });

        return { success: true };
    }

    private async assertOwner(userId: number, taskId: number) {
        const task = await prisma.personal_tasks.findUnique({
            where: { id: taskId },
            select: { userId: true },
        });

        if (!task || task.userId !== userId) {
            throw new AppError("Личная задача не найдена", 404);
        }
    }
}
