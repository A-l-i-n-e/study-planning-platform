import { prisma } from "../config/prisma";
import { events_status, users_role } from "../../generated/prisma/enums";
import type { AuthUser } from "../midllewares/user.middleware";
import {
    buildSlotModelFeatures,
    calculateSlotConvenience,
    getIsoDay,
    intervalsIntersect,
    roundScore,
    SlotModelFeatures,
} from "./slot-feature.utils";

type TrainingPoll = {
    id: number;
    teacherId: number;
    finalOptionId: number | null;
    options: Array<{
        id: number;
        startAt: Date;
        endAt: Date;
    }>;
    votes: Array<{ optionId: number; studentId: number }>;
    participants: Array<{ studentId: number }>;
    pollTargets: Array<{ groupId: number }>;
};

type SlotConflicts = {
    teacher: boolean;
    groupIds: number[];
    studentsCount: number;
};

export type SlotTrainingDataRow = {
    pollId: number;
    optionId: number;
    votesCount: number;
    participantsCount: number;
    votesShare: number;
    teacherAvailable: number;
    groupAvailable: number;
    studentsAvailable: number;
    convenience: number;
    dayOfWeek: number;
    startHour: number;
    normalizedDayOfWeek: number;
    normalizedStartHour: number;
    selectedByTeacher: 0 | 1;
    features: SlotModelFeatures;
};

export class SlotTrainingDataService {
    async getTrainingDataset(currentUser?: AuthUser): Promise<SlotTrainingDataRow[]> {
        const polls = await prisma.polls.findMany({
            where: {
                ...(currentUser ? this.getPollScopeWhere(currentUser) : {}),
                finalOptionId: { not: null },
            },
            orderBy: {
                createdAt: "asc",
            },
            select: {
                id: true,
                teacherId: true,
                finalOptionId: true,
                options: {
                    select: {
                        id: true,
                        startAt: true,
                        endAt: true,
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

        const rows = await Promise.all(polls.map((poll) => this.buildRowsForPoll(poll)));

        return rows.flat();
    }

    private async buildRowsForPoll(poll: TrainingPoll): Promise<SlotTrainingDataRow[]> {
        const participantsCount = poll.participants.length;
        const selectedOptionId = poll.finalOptionId;
        const voteCounts = new Map(poll.options.map((option) => [option.id, 0]));
        const conflictMap = await this.getSlotConflictMap(poll);

        for (const vote of poll.votes) {
            voteCounts.set(vote.optionId, (voteCounts.get(vote.optionId) ?? 0) + 1);
        }

        return poll.options.map((option) => {
            const votesCount = voteCounts.get(option.id) ?? 0;
            const votesShare = participantsCount > 0 ? votesCount / participantsCount : 0;
            const conflicts = conflictMap.get(option.id) ?? this.createEmptyConflicts();
            const teacherAvailable = conflicts.teacher ? 0 : 1;
            const studentsAvailable = conflicts.studentsCount > 0 ? 0 : 1;
            const groupAvailable = conflicts.groupIds.length > 0 || !studentsAvailable ? 0 : 1;
            const convenience = calculateSlotConvenience(option.startAt);
            const features = buildSlotModelFeatures(
                option.startAt,
                votesShare,
                teacherAvailable,
                groupAvailable,
                convenience
            );

            return {
                pollId: poll.id,
                optionId: option.id,
                votesCount,
                participantsCount,
                votesShare: roundScore(votesShare),
                teacherAvailable,
                groupAvailable,
                studentsAvailable,
                convenience,
                dayOfWeek: getIsoDay(option.startAt),
                startHour: roundScore(option.startAt.getHours() + option.startAt.getMinutes() / 60),
                normalizedDayOfWeek: features.normalizedDayOfWeek,
                normalizedStartHour: features.normalizedStartHour,
                selectedByTeacher: option.id === selectedOptionId ? 1 : 0,
                features,
            };
        });
    }

    private async getSlotConflictMap(poll: TrainingPoll) {
        const conflictMap = new Map<number, SlotConflicts>(
            poll.options.map((option) => [option.id, this.createEmptyConflicts()])
        );

        if (poll.options.length === 0) {
            return conflictMap;
        }

        const rangeStart = new Date(Math.min(...poll.options.map((option) => option.startAt.getTime())));
        const rangeEnd = new Date(Math.max(...poll.options.map((option) => option.endAt.getTime())));
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
                if (!intervalsIntersect(option.startAt, option.endAt, event.startAt, event.endAt)) {
                    continue;
                }

                if (event.teacherId === poll.teacherId) {
                    conflicts.teacher = true;
                }

                if (event.groupId !== null && targetGroupIds.has(event.groupId)) {
                    groupIds.add(event.groupId);
                }

                const conflictedStudentIds = event.poll?.participants
                    .map((participant) => participant.studentId)
                    .filter((studentId) => participantIds.has(studentId)) ?? [];

                for (const studentId of conflictedStudentIds) {
                    studentIds.add(studentId);
                }
            }

            conflicts.groupIds = [...groupIds];
            conflicts.studentsCount = studentIds.size;
            conflictMap.set(option.id, conflicts);
        }

        return conflictMap;
    }

    private createEmptyConflicts(): SlotConflicts {
        return {
            teacher: false,
            groupIds: [],
            studentsCount: 0,
        };
    }

    private getPollScopeWhere(currentUser: AuthUser) {
        if (currentUser.role === users_role.admin) {
            return {};
        }

        return {
            teacherId: currentUser.id,
        };
    }
}
