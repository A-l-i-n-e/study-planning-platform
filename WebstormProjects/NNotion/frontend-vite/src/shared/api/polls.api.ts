import { api } from './base';
import { tokenStorage } from '../lib/token-storage';
import type { PollDetails, PollOption, PollPreview, PollRecommendation, PollStatus } from '../types/poll';

type BackendFormat = 'ONLINE' | 'OFFLINE';
type BackendPollStatus = 'draft' | 'active' | 'closed';

export interface StudyGroup {
    id: number;
    name: string;
    description?: string | null;
    teacherId?: number | null;
}

interface BackendPollOption {
    id: number;
    startAt: string;
    endAt: string;
    format: BackendFormat;
    location?: string | null;
    link?: string | null;
}

interface BackendPoll {
    id: number;
    teacherId: number;
    title: string;
    description?: string | null;
    discipline?: string | null;
    lessonType?: string;
    deadlineAt: string;
    status: BackendPollStatus;
    teacher?: {
        id: number;
        name: string;
        email: string;
    };
    targetGroups?: StudyGroup[];
    pollTargets?: Array<{ group: StudyGroup }>;
    options?: BackendPollOption[];
    votes?: Array<{ optionId: number; studentId: number }>;
    votesCount?: number;
    participantsCount?: number;
    _count?: {
        options: number;
        votes: number;
        participants: number;
    };
}

interface BackendPollRecommendation {
    optionId: number;
    rank: number;
    startTime?: string;
    endTime?: string;
    startAt: string;
    endAt: string;
    durationMinutes: number;
    votesCount: number;
    participantsCount: number;
    votesShare: number;
    dynamicPmin: number;
    minVotesRequired: number;
    passedThreshold: boolean;
    thresholdExplanation: string;
    teacherAvailable: boolean | null;
    groupAvailable: boolean | null;
    studentsAvailable: boolean | null;
    teacherAvailabilityScore: number;
    groupAvailabilityScore: number;
    convenienceScore: number;
    durationScore: number;
    finalScore: number;
    recommendationStatus: PollRecommendation['recommendationStatus'];
    warnings: string[];
    explanation: string;
    conflicts: {
        hasAnyConflict: boolean;
        teacher: boolean;
        groupIds: number[];
        studentsCount: number;
    };
}

export interface CreatePollPayload {
    title: string;
    description?: string | null;
    discipline?: string | null;
    lessonType: string;
    deadlineAt: string;
    targetGroupIds: number[];
    participantStudentIds?: number[];
    options: Array<{
        startAt: string;
        endAt: string;
        durationMinutes?: number;
        format: 'OFFLINE';
        location?: string | null;
        link?: string | null;
    }>;
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
});

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
});

const deadlineFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
});

const toStatus = (status: BackendPollStatus): PollStatus => status;

const toGroups = (poll: BackendPoll) =>
    poll.targetGroups ?? poll.pollTargets?.map((target) => target.group) ?? [];

const formatOption = (option: BackendPollOption, index: number, votes: BackendPoll['votes'] = []): PollOption => {
    const start = new Date(option.startAt);
    const end = new Date(option.endAt);
    const place = option.location ?? '';

    return {
        id: String(option.id),
        rawId: option.id,
        label: `Вариант ${index + 1}`,
        date: dateFormatter.format(start),
        time: `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`,
        startAt: option.startAt,
        endAt: option.endAt,
        durationMinutes: Math.round((end.getTime() - start.getTime()) / (60 * 1000)),
        location: place,
        votesCount: votes.filter((vote) => vote.optionId === option.id).length,
        format: 'offline',
        link: null,
    };
};

const formatRecommendation = (item: BackendPollRecommendation): PollRecommendation => {
    const start = new Date(item.startAt);
    const end = new Date(item.endAt);

    return {
        optionId: String(item.optionId),
        rawOptionId: item.optionId,
        rank: item.rank,
        date: dateFormatter.format(start),
        time: `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`,
        startAt: item.startAt,
        endAt: item.endAt,
        startTime: item.startTime ?? item.startAt,
        endTime: item.endTime ?? item.endAt,
        durationMinutes: item.durationMinutes,
        votesCount: item.votesCount,
        participantsCount: item.participantsCount,
        votesShare: item.votesShare,
        dynamicPmin: item.dynamicPmin,
        minVotesRequired: item.minVotesRequired,
        passedThreshold: item.passedThreshold,
        thresholdExplanation: item.thresholdExplanation,
        teacherAvailable: item.teacherAvailable,
        groupAvailable: item.groupAvailable,
        studentsAvailable: item.studentsAvailable,
        teacherAvailabilityScore: item.teacherAvailabilityScore,
        groupAvailabilityScore: item.groupAvailabilityScore,
        convenienceScore: item.convenienceScore,
        durationScore: item.durationScore,
        finalScore: item.finalScore,
        recommendationStatus: item.recommendationStatus,
        warnings: item.warnings ?? [],
        explanation: item.explanation,
        conflicts: item.conflicts,
    };
};

export const mapBackendPoll = (poll: BackendPoll): PollDetails => {
    const groups = toGroups(poll);
    const options = (poll.options ?? []).map((option, index) => formatOption(option, index, poll.votes));
    const votesCount = poll.votesCount ?? poll._count?.votes ?? poll.votes?.length ?? 0;
    const currentUser = tokenStorage.getUser();
    const selectedOptionIds = currentUser?.role === 'student'
        ? (poll.votes ?? [])
            .filter((vote) => vote.studentId === currentUser.id)
            .map((vote) => String(vote.optionId))
        : [];

    return {
        id: String(poll.id),
        rawId: poll.id,
        title: poll.discipline ? `${poll.discipline} · ${poll.title}` : poll.title,
        description: poll.description ?? poll.lessonType ?? 'Без описания',
        teacher: poll.teacher?.name ?? `Преподаватель #${poll.teacherId}`,
        teacherId: poll.teacherId,
        group: groups.map((group) => group.name).join(', ') || 'Группа не указана',
        deadline: deadlineFormatter.format(new Date(poll.deadlineAt)),
        status: toStatus(poll.status),
        optionsCount: poll._count?.options ?? options.length,
        participantsCount: poll.participantsCount ?? poll._count?.participants,
        votesCount,
        selectedOptionIds,
        isMine: false,
        options: options.length
            ? options
            : Array.from({ length: poll._count?.options ?? 0 }, (_, index) => ({
                id: `${poll.id}-option-${index}`,
                label: `Вариант ${index + 1}`,
                date: 'Дата уточняется',
                time: 'Время уточняется',
                location: '',
                votesCount,
            })),
    };
};

export const pollsApi = {
    list: async (): Promise<PollPreview[]> => {
        const response = await api.get<{ polls: BackendPoll[] }>('/polls');

        return response.data.polls.map(mapBackendPoll);
    },

    getById: async (id: string | number): Promise<PollDetails> => {
        const response = await api.get<{ poll: BackendPoll }>(`/polls/${id}`);

        return mapBackendPoll(response.data.poll);
    },

    create: async (payload: CreatePollPayload): Promise<PollDetails> => {
        const response = await api.post<{ poll: BackendPoll }>('/polls', payload);

        return mapBackendPoll(response.data.poll);
    },

    activate: async (id: string | number): Promise<PollDetails> => {
        const response = await api.patch<{ poll: BackendPoll }>(`/polls/${id}/activate`);

        return mapBackendPoll(response.data.poll);
    },

    vote: async (pollId: string | number, optionIds: Array<string | number> | string | number): Promise<void> => {
        const normalizedOptionIds = Array.isArray(optionIds) ? optionIds : [optionIds];

        await api.post('/votes', {
            pollId: Number(pollId),
            optionIds: normalizedOptionIds.map(Number),
        });
    },

    clearVote: async (pollId: string | number): Promise<void> => {
        await api.delete(`/votes/polls/${pollId}/my`);
    },

    approveResult: async (pollId: string | number, optionId: string | number): Promise<PollDetails> => {
        const response = await api.post<{ poll: BackendPoll }>(`/polls/${pollId}/approve-result`, {
            optionId: Number(optionId),
        });

        return mapBackendPoll(response.data.poll);
    },

    getRecommendations: async (pollId: string | number): Promise<PollRecommendation[]> => {
        const response = await api.get<{ recommendations: BackendPollRecommendation[] }>(
            `/polls/${pollId}/recommendations`
        );

        return response.data.recommendations.map(formatRecommendation);
    },
};
