import { prisma } from "../config/prisma";
import {
    CreateVoteDto,
    DeleteVoteDto,
    GetVoteByPollDto,
} from "../schemas/vote.schema";
import { AppError } from "../errors/app-error";
import { polls_status, users_role } from "../../generated/prisma/enums";
import { NotificationHelperService } from "./notification-helper.service";
import { PollService } from "./poll.service";
import type { AuthUser } from "../midllewares/user.middleware";

export class VoteService {
    private notificationHelper = new NotificationHelperService();
    private pollService = new PollService();

    async create(studentId: number, data: CreateVoteDto) {
        const student = await prisma.users.findUnique({
            where: { id: studentId },
            select: {
                id: true,
                role: true,
            },
        });

        if (!student) {
            throw new AppError("Пользователь не найден", 404);
        }

        if (student.role !== users_role.student) {
            throw new AppError("Голосовать могут только студенты", 403);
        }

        const poll = await prisma.polls.findUnique({
            where: { id: data.pollId },
            include: {
                options: true,
                participants: true,
            },
        });

        if (!poll) {
            throw new AppError("Опрос не найден", 404);
        }

        const now = new Date();
        if (poll.status === polls_status.active && poll.deadlineAt.getTime() <= now.getTime()) {
            await this.pollService.closeExpiredPollIfNeeded(poll.id, now);
            throw new AppError("Дедлайн голосования уже прошёл", 400);
        }

        if (poll.status !== polls_status.active) {
            throw new AppError("Голосование доступно только в активных опросах", 400);
        }

        const selectedOptionIds = Array.from(new Set(
            data.optionIds ?? (data.optionId !== undefined ? [data.optionId] : [])
        ));

        if (selectedOptionIds.length === 0) {
            throw new AppError("Вариант опроса не найден", 404);
        }

        const pollOptionIds = new Set(poll.options.map((item) => item.id));
        const hasInvalidOption = selectedOptionIds.some((optionId) => !pollOptionIds.has(optionId));

        if (hasInvalidOption) {
            throw new AppError("Вариант опроса не найден", 404);
        }

        const isParticipant = poll.participants.some(
            (item) => item.studentId === studentId
        );

        if (!isParticipant) {
            throw new AppError("Вы не являетесь участником этого опроса", 403);
        }

        const existingVotes = await prisma.votes.findMany({
            where: {
                pollId: data.pollId,
                studentId,
            },
            select: {
                id: true,
                optionId: true,
            },
        });
        const existingOptionIds = new Set(existingVotes.map((vote) => vote.optionId));
        const selectedOptionIdSet = new Set(selectedOptionIds);
        const voteIdsToDelete = existingVotes
            .filter((vote) => !selectedOptionIdSet.has(vote.optionId))
            .map((vote) => vote.id);
        const optionIdsToCreate = selectedOptionIds.filter((optionId) => !existingOptionIds.has(optionId));

        const voteSelect = {
            id: true,
            pollId: true,
            optionId: true,
            studentId: true,
            votedAt: true,
        } as const;

        const votes = await prisma.$transaction(async (tx) => {
            if (voteIdsToDelete.length > 0) {
                await tx.votes.deleteMany({
                    where: {
                        id: { in: voteIdsToDelete },
                    },
                });
            }

            if (optionIdsToCreate.length > 0) {
                await tx.votes.createMany({
                    data: optionIdsToCreate.map((optionId) => ({
                        pollId: data.pollId,
                        optionId,
                        studentId,
                    })),
                });
            }

            if (existingVotes.length > 0 && optionIdsToCreate.length === 0 && voteIdsToDelete.length === 0) {
                await tx.votes.updateMany({
                    where: {
                        pollId: data.pollId,
                        studentId,
                        optionId: { in: selectedOptionIds },
                    },
                    data: {
                        votedAt: new Date(),
                    },
                });
            }

            return tx.votes.findMany({
                where: {
                    pollId: data.pollId,
                    studentId,
                },
                orderBy: {
                    optionId: "asc",
                },
                select: voteSelect,
            });
        });

        await this.notificationHelper.createUserNotifications(
            [poll.teacherId],
            "POLL_VOTE_RECEIVED",
            {
                pollId: poll.id,
                optionId: selectedOptionIds[0] ?? null,
                optionIds: selectedOptionIds,
                studentId,
                message: existingVotes.length > 0
                    ? "Студент обновил выбранные варианты в опросе."
                    : "Студент проголосовал в опросе.",
            },
            { category: "poll" }
        );

        await this.pollService.closePollIfEveryParticipantVoted(poll.id);

        return votes;
    }

    async getMyVote(studentId: number, params: GetVoteByPollDto) {
        const votes = await prisma.votes.findMany({
            where: {
                pollId: params.pollId,
                studentId,
            },
            orderBy: {
                optionId: "asc",
            },
            select: {
                id: true,
                pollId: true,
                optionId: true,
                studentId: true,
                votedAt: true,
                poll: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        deadlineAt: true,
                    },
                },
                option: {
                    select: {
                        id: true,
                        startAt: true,
                        endAt: true,
                        format: true,
                        location: true,
                        link: true,
                    },
                },
            },
        });

        if (votes.length === 0) {
            throw new AppError("Голос для этого опроса не найден", 404);
        }

        return votes;
    }

    async deleteMyVote(studentId: number, params: DeleteVoteDto) {
        const votes = await prisma.votes.findMany({
            where: {
                pollId: params.pollId,
                studentId,
            },
            include: {
                poll: true,
            },
        });

        if (votes.length === 0) {
            throw new AppError("Голос для этого опроса не найден", 404);
        }

        const vote = votes[0];
        const now = new Date();
        if (vote.poll.status === polls_status.active && vote.poll.deadlineAt.getTime() <= now.getTime()) {
            await this.pollService.closeExpiredPollIfNeeded(vote.poll.id, now);
            throw new AppError("Дедлайн голосования уже прошёл", 400);
        }

        if (vote.poll.status !== polls_status.active) {
            throw new AppError("Голос можно удалить только в активном опросе", 400);
        }

        await prisma.votes.deleteMany({
            where: {
                pollId: params.pollId,
                studentId,
            },
        });

        return { success: true };
    }

    async listPollVotes(currentUser: AuthUser, pollId: number) {
        await this.assertCanReadPollResults(currentUser, pollId);

        const votes = await prisma.votes.findMany({
            where: { pollId },
            orderBy: {
                votedAt: "asc",
            },
            select: {
                id: true,
                votedAt: true,
                studentId: true,
                optionId: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                        groupId: true,
                    },
                },
                option: {
                    select: {
                        id: true,
                        startAt: true,
                        endAt: true,
                        format: true,
                        location: true,
                        link: true,
                    },
                },
            },
        });

        return votes;
    }

    async getPollResults(currentUser: AuthUser, pollId: number) {
        await this.assertCanReadPollResults(currentUser, pollId);

        const poll = await prisma.polls.findUnique({
            where: { id: pollId },
            include: {
                options: true,
                votes: true,
                participants: true,
            },
        });

        if (!poll) {
            throw new AppError("Опрос не найден", 404);
        }

        const participantsCount = poll.participants.length;

        const results = poll.options.map((option) => {
            const votesCount = poll.votes.filter(
                (vote) => vote.optionId === option.id
            ).length;

            const percent =
                participantsCount > 0 ? Math.round((votesCount / participantsCount) * 100) : 0;

            return {
                optionId: option.id,
                startAt: option.startAt,
                endAt: option.endAt,
                format: option.format,
                location: option.location,
                link: option.link,
                votesCount,
                participantsCount,
                percent,
                reachedThreshold: percent >= (poll.threshold ?? 60),
            };
        });

        return {
            pollId: poll.id,
            pollTitle: poll.title,
            pollStatus: poll.status,
            deadlineAt: poll.deadlineAt,
            threshold: poll.threshold,
            participantsCount,
            totalVotes: poll.votes.length,
            uniqueVoters: new Set(poll.votes.map((vote) => vote.studentId)).size,
            results,
        };
    }

    private async assertCanReadPollResults(currentUser: AuthUser, pollId: number) {
        const poll = await prisma.polls.findUnique({
            where: { id: pollId },
            select: {
                id: true,
                teacherId: true,
            },
        });

        if (!poll) {
            throw new AppError("Опрос не найден", 404);
        }

        if (currentUser.role === users_role.admin) {
            return;
        }

        if (currentUser.role === users_role.teacher && poll.teacherId === currentUser.id) {
            return;
        }

        throw new AppError("Недостаточно прав", 403);
    }
}
