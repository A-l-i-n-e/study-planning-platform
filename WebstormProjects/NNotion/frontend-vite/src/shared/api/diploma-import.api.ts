import { api } from './base';

export interface DiplomaImportResult {
    users: {
        created: number;
        updated: number;
    };
    groups: {
        created: number;
        updated: number;
    };
    studentsAssigned: number;
    polls: {
        created: number;
        skipped: number;
    };
    votes: {
        created: number;
        skipped: number;
    };
    events?: {
        created: number;
        skipped: number;
    };
    defaultPasswords: Record<'admin' | 'teacher' | 'student', string>;
    errors: Array<{
        sheet: string;
        row?: number;
        message: string;
    }>;
}

export const diplomaImportApi = {
    importDataset: async (file: File): Promise<DiplomaImportResult> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post<{ result: DiplomaImportResult }>('/admin/import-diploma', formData);

        return response.data.result;
    },
};
