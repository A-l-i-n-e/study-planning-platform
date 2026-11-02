import { api } from './base';
import type { StudyGroup } from './polls.api';
import type { BackendUser } from './users.api';

export interface CreateGroupPayload {
    name: string;
    description: string;
    teacherId?: number | null;
}

export interface UpdateGroupPayload {
    name?: string;
    description?: string;
    teacherId?: number | null;
}

export const groupsApi = {
    list: async (): Promise<StudyGroup[]> => {
        const response = await api.get<{ groups: StudyGroup[] }>('/groups');

        return response.data.groups;
    },

    teachingDisciplines: async (): Promise<string[]> => {
        const response = await api.get<{ disciplines: string[] }>('/groups/teaching-disciplines');

        return response.data.disciplines;
    },

    byDiscipline: async (discipline: string): Promise<StudyGroup[]> => {
        const response = await api.get<{ groups: StudyGroup[] }>('/groups/by-discipline', {
            params: { discipline },
        });

        return response.data.groups;
    },

    create: async (payload: CreateGroupPayload): Promise<StudyGroup> => {
        const response = await api.post<{ group: StudyGroup }>('/groups', payload);

        return response.data.group;
    },

    update: async (id: number, payload: UpdateGroupPayload): Promise<StudyGroup> => {
        const response = await api.patch<{ group: StudyGroup }>(`/groups/${id}`, payload);

        return response.data.group;
    },

    students: async (id: number): Promise<BackendUser[]> => {
        const response = await api.get<{ students: BackendUser[] }>(`/groups/${id}/students`);

        return response.data.students;
    },

    addStudent: async (groupId: number, studentId: number): Promise<BackendUser> => {
        const response = await api.post<{ groupStudent: BackendUser }>(`/groups/${groupId}/students`, {
            studentId,
        });

        return response.data.groupStudent;
    },

    removeStudent: async (groupId: number, studentId: number): Promise<void> => {
        await api.delete(`/groups/${groupId}/students/${studentId}`);
    },
};
