import { prisma } from "../config/prisma";
import {
    CreatePollDto,
    DeletePollDto,
    GetPollRecommendationsDto,
    GetPollDto,
    ApprovePollResultDto,
    PollFilterDto,
    UpdatePollDto,
} from "../schemas/poll.schema";
import { AppError } from "../errors/app-error";
import { events_status, polls_status, users_role } from "../../generated/prisma/enums";
import { NotificationHelperService } from "./notification-helper.service";
import type { AuthUser } from "../midllewares/user.middleware";

type PollCloseReason = "deadline" | "all_voted" | "manual";

const MIN_DYNAMIC_VOTE_SHARE = 0.2;
const SCORE_WEIGHTS = {
    votesShare: 0.4,
    teacherAvailability: 0.2,
    groupAvailability: 0.2,
    convenience: 0.1,
    duration: 0.1,
} as const;

type RecommendationStatus = "recommended" | "acceptable" | "low_support" | "conflict" | "manual_review";

type RecommendationPoll = {
    id: number;
    teacherId: number;
    options: Array<{
        id: number;
        startAt: Date;
        endAt: Date;
        format: string;
        location: string | null;
        link: string | null;
    }>;
    votes: Array<{ optionId: number; studentId: number }>;
    participants: Array<{ studentId: number }>;
    pollTargets: Array<{ groupId: number }>;
};

type SlotConflicts = {
    hasAnyConflict: boolean;
    teacher: boolean;
    groupIds: number[];
    studentsCount: number;
    events: Array<{
        id: number;
        title: string;
        startAt: Date;
        endAt: Date;
        teacher: boolean;
        groupId: number | null;
        studentsCount: number;
    }>;
};

export class PollService {
    private notificationHelper = new NotificationHelperService();

    async create(currentUser: AuthUser, data: CreatePollDto) {
        const now = new Date();
        const deadlineAt = new Date(data.deadlineAt);

        this.assertFutureDate(deadlineAt, "Дедлайн опроса", now);
        this.assertPollOptionsAreFuture(data.options, now);

        const teacherId = await this.resolveTeacherIdForWrite(currentUser, data.teacherId);
        await this.getAllowedTargetGroups(currentUser, teacherId, data.targetGroupIds, data.discipline);

        const students = await prisma.users.findMany({
            where: {
                role: users_role.student,
                groupId: {
                    in: data.targetGroupIds,
                },
                ...(data.participantStudentIds?.length ? { id: { in: data.participantStudentIds } } : {}),
            },
            select: {
                id: true,
            },
        });

        const poll = await prisma.$transaction(async (tx) => {
            const createdPoll = await tx.polls.create({
                data: {
                    teacherId,
                    title: data.title,
                    description: data.description ?? null,
                    discipline: data.discipline ?? null,
                    lessonType: data.lessonType,
                    deadlineAt,
                    threshold: data.threshold ?? 60,
                    status: polls_status.draft,
                },
            });

            await tx.poll_options.createMany({
                data: data.options.map((option) => ({
                    pollId: createdPoll.id,
                    startAt: new Date(option.startAt),
                    endAt: this.resolveOptionEndAt(option),
                    format: option.format,
                    location: option.location ?? null,
                    link: option.link ?? null,
                })),
            });

            await tx.poll_target_groups.createMany({
                data: data.targetGroupIds.map((groupId) => ({
                    pollId: createdPoll.id,
                    groupId,
                })),
            });

            if (students.length > 0) {
                await tx.poll_participants_snapshot.createMany({
                    data: students.map((student) => ({
                        pollId: createdPoll.id,
                        studentId: student.id,
                    })),
                });
            }

            return createdPoll;
        });

        await this.notificationHelper.createUserNotifications(
            students.map((student) => student.id),
            "POLL_CREATED",
            {
                pollId: poll.id,
                title: data.title,
                deadlineAt: data.deadlineAt,
                message: "Создан новый опрос. Проверьте доступные варианты времени.",
            },
            { category: "poll" }
        );

        return this.getById(currentUser, { id: poll.id });
    }

    async getById(currentUser: AuthUser, params: GetPollDto) {
        await this.closeExpiredPollIfNeeded(params.id);
        await this.closePollIfEveryParticipantVoted(params.id);

        const poll = await prisma.polls.findUnique({
            where: { id: params.id },
            select: {
                id: true,
                teacherId: true,
                title: true,
                description: true,
                discipline: true,
                lessonType: true,
                deadlineAt: true,
                threshold: true,
                status: true,
                recommendedOptionId: true,
                finalOptionId: true,
                approvedAt: true,
                createdAt: true,
                teacher: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        role: true,
                    },
                },
                options: {
                    select: {
                        id: true,
                        startAt: true,
                        endAt: true,
                        format: true,
                        location: true,
                        link: true,
                    },
                    orderBy: {
                        startAt: "asc",
                    },
                },
                pollTargets: {
                    select: {
                        group: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                teacherId: true,
                            },
                        },
                    },
                },
                participants: {
                    select: {
                        studentId: true,
                        user: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                                role: true,
                                groupId: true,
                            },
                        },
                    },
                },
                votes: {
                    select: {
                        studentId: true,
                        optionId: true,
                    },
                },
            },
        });

        if (!poll) {
            throw new AppError("Опрос не найден", 404);
        }

        this.assertCanReadPoll(currentUser, poll);

        const { pollTargets, participants, votes, ...pollData } = poll;
        const votedStudentIds = new Set(votes.map((vote) => vote.studentId));

        return {
            ...pollData,
            targetGroups: pollTargets.map((item) => item.group),
            participantsCount: participants.length,
            students: participants.map((participant) => ({
                ...participant.user,
                hasVoted: votedStudentIds.has(participant.studentId),
            })),
            votes,
            votesCount: votes.length,
        };
    }

    async getRecommendations(currentUser: AuthUser, params: GetPollRecommendationsDto) {
        await this.closeExpiredPollIfNeeded(params.pollId);
        await this.closePollIfEveryParticipantVoted(params.pollId);

        const poll = await prisma.polls.findUnique({
            where: { id: params.pollId },
            select: {
                id: true,
                teacherId: true,
                status: true,
                options: {
                    select: {
                        id: true,
                        startAt: true,
                        endAt: true,
                        format: true,
                        location: true,
                        link: true,
                    },
                    orderBy: {
                        startAt: "asc",
                    },
                },
                votes: {
                    select: {
                        optionId: true,
                        studentId: true,
                    },
                },
                participants: {
                    select: {
                        studentId: true,
                    },
                },
                pollTargets: {
                    select: {
                        groupId: true,
                    },
                },
            },
        });

        if (!poll) {
            throw new AppError("Опрос не найден", 404);
        }

        this.assertCanReadPoll(currentUser, poll);

        const recommendations = await this.calculateRecommendationsForPoll(poll);

        return {
            pollId: poll.id,
            pollStatus: poll.status,
            message: poll.options.length === 0 ? "У опроса пока нет вариантов времени для оценки." : undefined,
            participantsCount: poll.participants.length,
            optionsCount: poll.options.length,
            weights: SCORE_WEIGHTS,
            recommendations,
        };
    }

    async list(currentUser: AuthUser, filter: PollFilterDto) {
        await this.closeExpiredPolls(currentUser);

        const polls = await prisma.polls.findMany({
            where: {
                ...this.getPollScopeWhere(currentUser, filter.teacherId),
                ...(filter.status ? { status: filter.status } : {}),
                ...(filter.search
                    ? {
                        OR: [
                            {
                                title: {
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
                createdAt: "desc",
            },
            select: {
                id: true,
                teacherId: true,
                title: true,
                description: true,
                discipline: true,
                lessonType: true,
                deadlineAt: true,
                threshold: true,
                status: true,
                recommendedOptionId: true,
                finalOptionId: true,
                approvedAt: true,
                createdAt: true,
                teacher: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
                pollTargets: {
                    select: {
                        group: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                teacherId: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        options: true,
                        votes: true,
                        participants: true,
                    },
                },
            },
        });

        return polls;
    }

    async update(currentUser: AuthUser, params: GetPollDto, data: UpdatePollDto) {
        await this.closeExpiredPollIfNeeded(params.id);

        const existingPoll = await this.getPollForWrite(currentUser, params.id);

        if (existingPoll.status === polls_status.closed) {
            throw new AppError("Закрытый опрос нельзя обновить", 400);
        }

        const now = new Date();
        const nextDeadlineAt = data.deadlineAt !== undefined
            ? new Date(data.deadlineAt)
            : existingPoll.deadlineAt;

        if (data.deadlineAt !== undefined) {
            this.assertFutureDate(nextDeadlineAt, "Дедлайн опроса", now);
        }

        if (data.options !== undefined) {
            this.assertPollOptionsAreFuture(data.options, now);
        }

        if (data.status === polls_status.active) {
            this.assertFutureDate(nextDeadlineAt, "Дедлайн опроса", now);

            const optionsCount = data.options?.length ?? existingPoll.options.length;

            if (optionsCount === 0) {
                throw new AppError("Нельзя активировать опрос без вариантов", 400);
            }
        }

        const before = {
            title: existingPoll.title,
            description: existingPoll.description,
            discipline: existingPoll.discipline,
            lessonType: existingPoll.lessonType,
            deadlineAt: existingPoll.deadlineAt.toISOString(),
            threshold: existingPoll.threshold,
            optionsCount: existingPoll.options.length,
        };

        const poll = await prisma.$transaction(async (tx) => {
            const updatedPoll = await tx.polls.update({
                where: { id: params.id },
                data: {
                    ...(data.title !== undefined ? { title: data.title } : {}),
                    ...(data.description !== undefined ? { description: data.description } : {}),
                    ...(data.discipline !== undefined ? { discipline: data.discipline } : {}),
                    ...(data.lessonType !== undefined ? { lessonType: data.lessonType } : {}),
                    ...(data.deadlineAt !== undefined ? { deadlineAt: new Date(data.deadlineAt) } : {}),
                    ...(data.threshold !== undefined ? { threshold: data.threshold } : {}),
                    ...(data.status !== undefined ? { status: data.status } : {}),
                    ...(data.options !== undefined ? { recommendedOptionId: null, finalOptionId: null, approvedAt: null } : {}),
                },
            });

            if (data.options !== undefined) {
                await tx.poll_options.deleteMany({ where: { pollId: params.id } });
                await tx.poll_options.createMany({
                    data: data.options.map((option) => ({
                        pollId: params.id,
                        startAt: new Date(option.startAt),
                        endAt: this.resolveOptionEndAt(option),
                        format: option.format,
                        location: option.location ?? null,
                        link: option.link ?? null,
                    })),
                });
            }

            return updatedPoll;
        });

        const participants = await prisma.poll_participants_snapshot.findMany({
            where: { pollId: params.id },
            select: { studentId: true },
        });

        await this.notificationHelper.createUserNotifications(
            participants.map((item) => item.studentId),
            "POLL_UPDATED",
            {
                pollId: params.id,
                title: poll.title,
                changed: this.describePollChanges(before, data),
                votesReset: data.options !== undefined,
                message: data.options !== undefined
                    ? "Опрос изменён, варианты времени обновлены. Ранее отданные голоса сброшены."
                    : "Опрос изменён. Проверьте актуальные данные и варианты.",
            },
            { category: "poll" }
        );

        return this.getById(currentUser, { id: poll.id });
    }

    async delete(currentUser: AuthUser, params: DeletePollDto) {
        await this.getPollForWrite(currentUser, params.id);

        await prisma.polls.delete({
            where: { id: params.id },
        });

        return { success: true };
    }

    async activate(currentUser: AuthUser, params: GetPollDto) {
        await this.closeExpiredPollIfNeeded(params.id);

        const existingPoll = await this.getPollForWrite(currentUser, params.id);

        if (existingPoll.status === polls_status.closed) {
            throw new AppError("Закрытый опрос нельзя активировать", 400);
        }

        this.assertFutureDate(existingPoll.deadlineAt, "Дедлайн опроса");

        if (existingPoll.options.length === 0) {
            throw new AppError("Нельзя активировать опрос без вариантов", 400);
        }

        await prisma.polls.update({
            where: { id: params.id },
            data: {
                status: polls_status.active,
            },
        });

        const participants = await prisma.poll_participants_snapshot.findMany({
            where: { pollId: params.id },
            select: {
                studentId: true,
            },
        });

        await this.notificationHelper.createUserNotifications(
            participants.map((item) => item.studentId),
            "POLL_ACTIVATED",
            {
                pollId: params.id,
                message: "Опрос открыт для голосования.",
            },
            { category: "poll" }
        );

        return this.getById(currentUser, params);
    }

    async closeExpiredPolls(currentUser?: AuthUser) {
        const polls = await prisma.polls.findMany({
            where: {
                ...(currentUser ? this.getPollScopeWhere(currentUser) : {}),
                status: polls_status.active,
                deadlineAt: { lte: new Date() },
            },
            select: { id: true },
        });

        for (const poll of polls) {
            await this.closePollAndNotify(poll.id, "deadline");
        }

        return polls.length;
    }

    async closeExpiredPollIfNeeded(pollId: number, now = new Date()) {
        const poll = await prisma.polls.findUnique({
            where: { id: pollId },
            select: { id: true, status: true, deadlineAt: true },
        });

        if (poll?.status === polls_status.active && poll.deadlineAt.getTime() <= now.getTime()) {
            await this.closePollAndNotify(poll.id, "deadline");
            return true;
        }

        return false;
    }

    async closePollIfEveryParticipantVoted(pollId: number) {
        const poll = await prisma.polls.findUnique({
            where: { id: pollId },
            select: {
                id: true,
                status: true,
                participants: {
                    select: { studentId: true },
                },
                votes: {
                    select: { studentId: true },
                },
            },
        });

        if (!poll || poll.status !== polls_status.active || poll.participants.length === 0) {
            return false;
        }

        const votedStudentIds = new Set(poll.votes.map((vote) => vote.studentId));
        const everyParticipantVoted = poll.participants.every((participant) =>
            votedStudentIds.has(participant.studentId)
        );

        if (!everyParticipantVoted) {
            return false;
        }

        await this.closePollAndNotify(poll.id, "all_voted");
        return true;
    }

    async close(currentUser: AuthUser, params: GetPollDto) {
        await this.getPollForWrite(currentUser, params.id);

        await this.closePollAndNotify(params.id, "manual");

        return this.getById(currentUser, params);
    }

    async approveResult(currentUser: AuthUser, params: GetPollDto, data: ApprovePollResultDto) {
        const poll = await this.getPollForWrite(currentUser, params.id);

        if (poll.status !== polls_status.closed) {
            throw new AppError("Итог опроса можно согласовать только после дедлайна или ручного закрытия", 400);
        }

        const option = poll.options.find((item) => item.id === data.optionId);

        if (!option) {
            throw new AppError("Выбранный вариант не найден в этом опросе", 404);
        }

        if (poll.event) {
            throw new AppError("Итоговое занятие для этого опроса уже существует", 409);
        }

        const recommendationPoll = await prisma.polls.findUnique({
            where: { id: poll.id },
            include: {
                options: true,
                votes: true,
                participants: true,
                pollTargets: true,
            },
        });
        const recommendation = recommendationPoll
            ? (await this.calculateRecommendationsForPoll(recommendationPoll)).find((item) => item.optionId === option.id)
            : null;

        if (recommendation?.recommendationStatus === "conflict") {
            throw new AppError("Выбранный вариант пересекается с расписанием преподавателя, группы или студента", 409);
        }

        const target = await prisma.poll_target_groups.findFirst({
            where: { pollId: poll.id },
            select: { groupId: true },
        });

        const event = await prisma.events.create({
            data: {
                pollId: poll.id,
                teacherId: poll.teacherId,
                groupId: target?.groupId ?? null,
                title: data.title ?? poll.title,
                description: data.description ?? poll.description ?? null,
                discipline: poll.discipline,
                lessonType: poll.lessonType,
                startAt: option.startAt,
                endAt: option.endAt,
                format: option.format,
                location: option.location,
                link: option.link,
                status: events_status.scheduled,
                isOfficial: true,
            },
        });

        await prisma.polls.update({
            where: { id: poll.id },
            data: {
                finalOptionId: option.id,
                approvedAt: new Date(),
            },
        });

        const participants = await prisma.poll_participants_snapshot.findMany({
            where: { pollId: poll.id },
            select: { studentId: true },
        });

        await this.notificationHelper.createUserNotifications(
            participants.map((item) => item.studentId),
            "POLL_FINAL_APPROVED",
            {
                pollId: poll.id,
                eventId: event.id,
                optionId: option.id,
                title: event.title,
                startAt: event.startAt.toISOString(),
                message: "Преподаватель согласовал итоговое занятие. Итог добавлен в расписание.",
            },
            { category: "event" }
        );

        return this.getById(currentUser, params);
    }

    private async closePollAndNotify(pollId: number, reason: PollCloseReason = "deadline") {
        const poll = await prisma.polls.findUnique({
            where: { id: pollId },
            include: {
                options: true,
                votes: true,
                participants: true,
                pollTargets: true,
            },
        });

        if (!poll) {
            throw new AppError("Опрос не найден", 404);
        }

        const recommendations = await this.calculateRecommendationsForPoll(poll);
        const recommendedItems = recommendations.filter((item) => item.recommendationStatus === "recommended");
        const recommendedOptionId = recommendedItems[0]?.optionId ?? null;
        const tiedOptionIds = recommendations
            .filter((item) => item.recommendationStatus === "recommended")
            .map((item) => item.optionId);

        const updated = await prisma.polls.updateMany({
            where: {
                id: pollId,
                status: { not: polls_status.closed },
            },
            data: {
                status: polls_status.closed,
                recommendedOptionId,
            },
        });

        if (updated.count === 0) {
            return;
        }

        const participantIds = poll.participants.map((item) => item.studentId);
        const closureMessages = this.getPollClosureMessages(reason);

        await this.notificationHelper.createUserNotifications(
            participantIds,
            reason === "all_voted" ? "POLL_ALL_VOTED_CLOSED" : "POLL_DEADLINE_CLOSED",
            {
                pollId,
                title: poll.title,
                recommendedOptionId,
                tiedOptionIds,
                closeReason: reason,
                message: closureMessages.participants,
            },
            { category: "poll" }
        );

        await this.notificationHelper.createUserNotifications(
            [poll.teacherId],
            "POLL_APPROVAL_REQUIRED",
            {
                pollId,
                title: poll.title,
                recommendedOptionId,
                tiedOptionIds,
                closeReason: reason,
                message: closureMessages.teacher,
            },
            { category: "poll" }
        );
    }

    private getPollClosureMessages(reason: PollCloseReason) {
        if (reason === "all_voted") {
            return {
                participants: "Все выбранные студенты проголосовали. Система рассчитала рейтинг вариантов; преподаватель выбирает финальную дату.",
                teacher: "Все выбранные студенты проголосовали. Проверьте рейтинг вариантов и подтвердите финальную дату.",
            };
        }

        if (reason === "manual") {
            return {
                participants: "Опрос закрыт вручную. Система рассчитала рейтинг вариантов; преподаватель выбирает финальную дату.",
                teacher: "Опрос закрыт вручную. Проверьте рейтинг вариантов и подтвердите финальную дату.",
            };
        }

        return {
            participants: "Дедлайн опроса прошел. Система рассчитала рейтинг вариантов; преподаватель выбирает финальную дату.",
            teacher: "Дедлайн опроса прошел. Проверьте рейтинг вариантов и подтвердите финальную дату.",
        };
    }

    private async calculateRecommendationsForPoll(poll: RecommendationPoll) {
        this.assertScoreWeights();

        const participantsCount = poll.participants.length;
        const optionsCount = poll.options.length;
        const dynamicPmin = this.calculateDynamicPmin(optionsCount);
        const minVotesRequired = this.calculateMinVotesRequired(participantsCount);
        const voteCounts = new Map(poll.options.map((option) => [option.id, 0]));
        const conflictMap = await this.getSlotConflictMap(poll);

        for (const vote of poll.votes) {
            voteCounts.set(vote.optionId, (voteCounts.get(vote.optionId) ?? 0) + 1);
        }

        const missingGroupAvailability = poll.pollTargets.length === 0 && poll.participants.length === 0;
        const scored = poll.options.map((option) => {
            const warnings: string[] = [];
            const votesCount = voteCounts.get(option.id) ?? 0;
            const votesShare = participantsCount > 0 ? votesCount / participantsCount : 0;
            const passedThreshold = votesShare >= dynamicPmin && votesCount >= minVotesRequired;
            const conflicts = conflictMap.get(option.id) ?? this.createEmptyConflicts();
            const hasConflict = conflicts.teacher || conflicts.groupIds.length > 0 || conflicts.studentsCount > 0;
            const hasValidInterval = this.isValidInterval(option.startAt, option.endAt);
            const durationMinutes = hasValidInterval ? this.getDurationMinutes(option.startAt, option.endAt) : 0;

            if (!hasValidInterval) {
                warnings.push("Некорректная дата или время варианта. Нужна ручная проверка.");
            }

            if (participantsCount === 0) {
                warnings.push("В опросе нет участников, поэтому доля голосов считается как 0.");
            }

            if (missingGroupAvailability) {
                warnings.push("Недостаточно данных о группе или студентах для проверки занятости.");
            }

            const teacherAvailable = hasValidInterval ? !conflicts.teacher : null;
            const groupAvailable = hasValidInterval && !missingGroupAvailability
                ? conflicts.groupIds.length === 0 && conflicts.studentsCount === 0
                : null;
            const studentsAvailable = groupAvailable;
            const teacherAvailabilityScore = teacherAvailable === null ? 0.5 : Number(teacherAvailable);
            const groupAvailabilityScore = groupAvailable === null ? 0.5 : Number(groupAvailable);
            const convenienceScore = hasValidInterval ? this.calculateConvenienceScore(option.startAt) : 0;
            const durationScore = durationMinutes > 0 ? this.calculateDurationScore(durationMinutes) : 0;
            const finalScore = this.roundScore(
                SCORE_WEIGHTS.votesShare * votesShare +
                SCORE_WEIGHTS.teacherAvailability * teacherAvailabilityScore +
                SCORE_WEIGHTS.groupAvailability * groupAvailabilityScore +
                SCORE_WEIGHTS.convenience * convenienceScore +
                SCORE_WEIGHTS.duration * durationScore
            );
            const thresholdExplanation = this.buildThresholdExplanation(
                votesCount,
                participantsCount,
                votesShare,
                dynamicPmin,
                minVotesRequired,
                passedThreshold
            );
            const manualReview = !hasValidInterval || participantsCount === 0 || missingGroupAvailability;

            return {
                optionId: option.id,
                startTime: option.startAt,
                endTime: option.endAt,
                startAt: option.startAt,
                endAt: option.endAt,
                durationMinutes,
                format: option.format,
                location: option.location,
                link: option.link,
                votesCount,
                participantsCount,
                votesShare: this.roundScore(votesShare),
                dynamicPmin: this.roundScore(dynamicPmin),
                minVotesRequired,
                passedThreshold,
                thresholdExplanation,
                teacherAvailable,
                groupAvailable,
                studentsAvailable,
                teacherAvailabilityScore,
                groupAvailabilityScore,
                convenienceScore,
                durationScore,
                finalScore,
                conflicts,
                hasConflict,
                manualReview,
                warnings,
            };
        });

        const bestEligibleScore = Math.max(
            ...scored
                .filter((item) => !item.manualReview && item.passedThreshold && !item.hasConflict)
                .map((item) => item.finalScore),
            -1
        );

        return scored
            .map((item) => {
                const recommendationStatus = this.getRecommendationStatus(item, bestEligibleScore);

                return {
                    ...item,
                    recommendationStatus,
                    explanation: this.buildRecommendationExplanation(item, recommendationStatus),
                };
            })
            .sort((left, right) =>
                right.finalScore - left.finalScore ||
                right.votesShare - left.votesShare ||
                Number(right.passedThreshold) - Number(left.passedThreshold) ||
                left.startAt.getTime() - right.startAt.getTime()
            )
            .map((item, index) => {
                const { hasConflict, manualReview, ...publicItem } = item;

                return {
                    ...publicItem,
                    rank: index + 1,
                };
            });
    }

    private async getSlotConflictMap(poll: RecommendationPoll) {
        const conflictMap = new Map<number, SlotConflicts>(
            poll.options.map((option) => [option.id, this.createEmptyConflicts()])
        );

        const validOptions = poll.options.filter((option) => this.isValidInterval(option.startAt, option.endAt));

        if (validOptions.length === 0) {
            return conflictMap;
        }

        const rangeStart = new Date(Math.min(...validOptions.map((option) => option.startAt.getTime())));
        const rangeEnd = new Date(Math.max(...validOptions.map((option) => option.endAt.getTime())));
        const targetGroupIds = new Set(poll.pollTargets.map((target) => target.groupId));
        const participantIds = new Set(poll.participants.map((participant) => participant.studentId));

        const scheduleEvents = await prisma.events.findMany({
            where: {
                isOfficial: true,
                status: events_status.scheduled,
                startAt: { lt: rangeEnd },
                endAt: { gt: rangeStart },
                OR: [
                    { pollId: null },
                    { pollId: { not: poll.id } },
                ],
            },
            select: {
                id: true,
                title: true,
                pollId: true,
                teacherId: true,
                groupId: true,
                startAt: true,
                endAt: true,
                poll: {
                    select: {
                        participants: {
                            select: {
                                studentId: true,
                            },
                        },
                    },
                },
            },
        });

        for (const option of poll.options) {
            const conflicts = this.createEmptyConflicts();
            const groupIds = new Set<number>();
            const studentIds = new Set<number>();

            for (const event of scheduleEvents) {
                if (!this.intersects(option.startAt, option.endAt, event.startAt, event.endAt)) {
                    continue;
                }

                const hasTeacherConflict = event.teacherId === poll.teacherId;
                const hasGroupConflict = event.groupId !== null && targetGroupIds.has(event.groupId);
                const conflictedStudentIds = event.poll?.participants
                    .map((participant) => participant.studentId)
                    .filter((studentId) => participantIds.has(studentId)) ?? [];
                const hasStudentConflict = conflictedStudentIds.length > 0;

                if (!hasTeacherConflict && !hasGroupConflict && !hasStudentConflict) {
                    continue;
                }

                conflicts.hasAnyConflict = true;
                conflicts.teacher = conflicts.teacher || hasTeacherConflict;

                if (hasGroupConflict && event.groupId !== null) {
                    groupIds.add(event.groupId);
                }

                for (const studentId of conflictedStudentIds) {
                    studentIds.add(studentId);
                }

                conflicts.events.push({
                    id: event.id,
                    title: event.title,
                    startAt: event.startAt,
                    endAt: event.endAt,
                    teacher: hasTeacherConflict,
                    groupId: hasGroupConflict ? event.groupId : null,
                    studentsCount: conflictedStudentIds.length,
                });
            }

            conflicts.groupIds = [...groupIds];
            conflicts.studentsCount = studentIds.size;
            conflictMap.set(option.id, conflicts);
        }

        return conflictMap;
    }

    private createEmptyConflicts(): SlotConflicts {
        return {
            hasAnyConflict: false,
            teacher: false,
            groupIds: [],
            studentsCount: 0,
            events: [],
        };
    }

    private calculateConvenienceScore(startAt: Date) {
        if (!this.isValidDate(startAt)) {
            return 0;
        }

        const hour = startAt.getHours() + startAt.getMinutes() / 60;

        if (hour >= 9 && hour < 18) {
            return 1;
        }

        if ((hour >= 8 && hour < 9) || (hour >= 18 && hour < 20)) {
            return 0.5;
        }

        return 0.2;
    }

    private calculateDurationScore(durationMinutes: number) {
        if (durationMinutes === 45) return 0.8;
        if (durationMinutes === 60) return 1;
        if (durationMinutes === 90) return 0.9;
        if (durationMinutes === 120) return 0.7;

        return 0.5;
    }

    private calculateDynamicPmin(optionsCount: number) {
        if (optionsCount <= 0) {
            return MIN_DYNAMIC_VOTE_SHARE;
        }

        return Math.max(MIN_DYNAMIC_VOTE_SHARE, 1 / optionsCount + 0.1);
    }

    private calculateMinVotesRequired(participantsCount: number) {
        return Math.max(2, Math.ceil(0.1 * participantsCount));
    }

    private getRecommendationStatus(
        slot: {
            manualReview: boolean;
            passedThreshold: boolean;
            hasConflict: boolean;
            finalScore: number;
        },
        bestEligibleScore: number
    ): RecommendationStatus {
        if (slot.manualReview) {
            return "manual_review";
        }

        if (slot.hasConflict) {
            return "conflict";
        }

        if (!slot.passedThreshold) {
            return "low_support";
        }

        return slot.finalScore === bestEligibleScore ? "recommended" : "acceptable";
    }

    private buildThresholdExplanation(
        votesCount: number,
        participantsCount: number,
        votesShare: number,
        dynamicPmin: number,
        minVotesRequired: number,
        passedThreshold: boolean
    ) {
        if (participantsCount === 0) {
            return "В опросе нет участников: доля голосов считается как 0, слот отправлен на ручную проверку.";
        }

        const shareText = `${this.formatPercent(votesShare)} при пороге ${this.formatPercent(dynamicPmin)}`;
        const votesText = `${votesCount} голос(ов) при минимуме ${minVotesRequired}`;

        return passedThreshold
            ? `Порог пройден: ${shareText}, ${votesText}.`
            : `Порог не пройден: ${shareText}, ${votesText}.`;
    }

    private buildRecommendationExplanation(
        slot: {
            votesCount: number;
            participantsCount: number;
            votesShare: number;
            dynamicPmin: number;
            minVotesRequired: number;
            teacherAvailable: boolean | null;
            groupAvailable: boolean | null;
            convenienceScore: number;
            durationScore: number;
            finalScore: number;
            warnings: string[];
        },
        recommendationStatus: RecommendationStatus
    ) {
        const statusText: Record<RecommendationStatus, string> = {
            recommended: "Лучший допустимый слот: порог голосования пройден, конфликтов не найдено.",
            acceptable: "Слот допустим, но уступает лучшему варианту по итоговой оценке.",
            low_support: "Недостаточная поддержка: слот не прошел динамический порог или минимум голосов.",
            conflict: "Есть пересечение с расписанием преподавателя, группы или студентов.",
            manual_review: "Недостаточно данных для автоматической оценки, нужна ручная проверка.",
        };
        const availabilityText = [
            `доступность преподавателя: ${this.formatAvailability(slot.teacherAvailable)}`,
            `доступность группы: ${this.formatAvailability(slot.groupAvailable)}`,
        ].join(", ");

        return [
            statusText[recommendationStatus],
            `Голоса: ${slot.votesCount} из ${slot.participantsCount}, доля ${this.formatPercent(slot.votesShare)}.`,
            `Порог голосов: ${this.formatPercent(slot.dynamicPmin)}, минимум голосов: ${slot.minVotesRequired}.`,
            `${availabilityText}. Удобство времени: ${this.formatPercent(slot.convenienceScore)}, продолжительность: ${this.formatPercent(slot.durationScore)}.`,
            `Итоговая оценка: ${this.formatPercent(slot.finalScore)}.`,
            ...slot.warnings,
        ].join(" ");
    }

    private formatAvailability(value: boolean | null) {
        if (value === null) {
            return "нет данных";
        }

        return value ? "свободно" : "есть конфликт";
    }

    private formatPercent(value: number) {
        return `${Math.round(value * 100)}%`;
    }

    private getDurationMinutes(startAt: Date, endAt: Date) {
        return Math.round((endAt.getTime() - startAt.getTime()) / (60 * 1000));
    }

    private isValidDate(date: Date) {
        return date instanceof Date && !Number.isNaN(date.getTime());
    }

    private isValidInterval(startAt: Date, endAt: Date) {
        return this.isValidDate(startAt) && this.isValidDate(endAt) && endAt > startAt;
    }

    private assertScoreWeights() {
        const sum = Object.values(SCORE_WEIGHTS).reduce((total, weight) => total + weight, 0);

        if (Math.abs(sum - 1) > 0.000001) {
            throw new AppError("Сумма весов рекомендаций должна быть равна 1", 500);
        }
    }

    private getIsoDay(date: Date) {
        const day = date.getDay();
        return day === 0 ? 7 : day;
    }

    private intersects(startAt: Date, endAt: Date, otherStartAt: Date, otherEndAt: Date) {
        return startAt < otherEndAt && endAt > otherStartAt;
    }

    private roundScore(value: number) {
        return Math.round(value * 1000) / 1000;
    }

    private describePollChanges(
        before: {
            title: string;
            description: string | null;
            discipline: string | null;
            lessonType: string;
            deadlineAt: string;
            threshold: number | null;
            optionsCount: number;
        },
        data: UpdatePollDto
    ) {
        const changed: string[] = [];

        if (data.title !== undefined && data.title !== before.title) changed.push("title");
        if (data.description !== undefined && data.description !== before.description) changed.push("description");
        if (data.discipline !== undefined && data.discipline !== before.discipline) changed.push("discipline");
        if (data.lessonType !== undefined && data.lessonType !== before.lessonType) changed.push("lessonType");
        if (data.deadlineAt !== undefined && data.deadlineAt !== before.deadlineAt) changed.push("deadline");
        if (data.threshold !== undefined && data.threshold !== before.threshold) changed.push("threshold");
        if (data.options !== undefined) changed.push("options");

        return changed;
    }

    private assertFutureDate(date: Date, fieldName: string, now = new Date()) {
        if (date.getTime() <= now.getTime()) {
            throw new AppError(`${fieldName} должно быть в будущем`, 400);
        }
    }

    private assertPollOptionsAreFuture(
        options: Array<{ startAt: string; endAt?: string; durationMinutes?: number }>,
        now = new Date()
    ) {
        const hasPastOption = options.some((option) => new Date(option.startAt).getTime() <= now.getTime());

        if (hasPastOption) {
            throw new AppError("Варианты опроса должны быть в будущем", 400);
        }
    }

    private resolveOptionEndAt(option: { startAt: string; endAt?: string; durationMinutes?: number }) {
        if (option.endAt) {
            return new Date(option.endAt);
        }

        const endAt = new Date(option.startAt);
        endAt.setMinutes(endAt.getMinutes() + (option.durationMinutes ?? 90));

        return endAt;
    }

    private async resolveTeacherIdForWrite(currentUser: AuthUser, requestedTeacherId?: number) {
        if (currentUser.role === users_role.teacher) {
            if (requestedTeacherId && requestedTeacherId !== currentUser.id) {
                throw new AppError("Нельзя создать опрос за другого преподавателя", 403);
            }

            return currentUser.id;
        }

        if (currentUser.role !== users_role.admin) {
            throw new AppError("Недостаточно прав", 403);
        }

        if (!requestedTeacherId) {
            throw new AppError("Для создания опроса администратором нужно указать преподавателя", 400);
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

    private async getAllowedTargetGroups(
        currentUser: AuthUser,
        teacherId: number,
        targetGroupIds: number[],
        discipline?: string | null
    ) {
        const groups = await prisma.study_groups.findMany({
            where: {
                id: {
                    in: targetGroupIds,
                },
            },
            select: {
                id: true,
                teacherId: true,
            },
        });

        if (groups.length !== targetGroupIds.length) {
            throw new AppError("Одна или несколько групп не найдены", 404);
        }

        if (currentUser.role === users_role.admin) {
            const hasForbiddenGroup = groups.some((group) => group.teacherId !== null && group.teacherId !== teacherId);

            if (hasForbiddenGroup) {
                throw new AppError("Опрос можно назначить только группам этого преподавателя", 403);
            }

            return groups;
        }

        const groupsNeedingScheduleProof = groups.filter((group) => group.teacherId !== teacherId);

        if (groupsNeedingScheduleProof.length > 0) {
            const normalizedDiscipline = discipline?.trim();

            if (!normalizedDiscipline) {
                throw new AppError("Для групп из расписания нужно указать дисциплину опроса", 400);
            }

            const teachingAssignments = await prisma.teaching_assignments.findMany({
                where: {
                    teacherId,
                    subject: {
                        name: normalizedDiscipline,
                    },
                    groupId: {
                        in: groupsNeedingScheduleProof.map((group) => group.id),
                    },
                },
                select: {
                    groupId: true,
                },
            });
            const allowedBySchedule = new Set(teachingAssignments.map((assignment) => assignment.groupId));
            const hasForbiddenGroup = groupsNeedingScheduleProof.some((group) => !allowedBySchedule.has(group.id));

            if (hasForbiddenGroup) {
                throw new AppError("Опрос можно назначить только группам, где преподаватель ведёт выбранную дисциплину", 403);
            }
        }

        return groups;
    }

    private getPollScopeWhere(currentUser: AuthUser, requestedTeacherId?: number) {
        if (currentUser.role === users_role.admin) {
            return requestedTeacherId ? { teacherId: requestedTeacherId } : {};
        }

        if (currentUser.role === users_role.teacher) {
            if (requestedTeacherId && requestedTeacherId !== currentUser.id) {
                throw new AppError("Недостаточно прав", 403);
            }

            return { teacherId: currentUser.id };
        }

        return {
            participants: {
                some: {
                    studentId: currentUser.id,
                },
            },
        };
    }

    private assertCanReadPoll(
        currentUser: AuthUser,
        poll: {
            teacherId: number;
            participants: Array<{ studentId: number }>;
        }
    ) {
        if (currentUser.role === users_role.admin) {
            return;
        }

        if (currentUser.role === users_role.teacher && poll.teacherId === currentUser.id) {
            return;
        }

        if (
            currentUser.role === users_role.student &&
            poll.participants.some((participant) => participant.studentId === currentUser.id)
        ) {
            return;
        }

        throw new AppError("Опрос не найден", 404);
    }

    private async getPollForWrite(currentUser: AuthUser, pollId: number) {
        const poll = await prisma.polls.findUnique({
            where: { id: pollId },
            include: {
                options: true,
                event: true,
            },
        });

        if (!poll) {
            throw new AppError("Опрос не найден", 404);
        }

        if (currentUser.role === users_role.admin) {
            return poll;
        }

        if (currentUser.role === users_role.teacher && poll.teacherId === currentUser.id) {
            return poll;
        }

        throw new AppError("Недостаточно прав", 403);
    }
}
