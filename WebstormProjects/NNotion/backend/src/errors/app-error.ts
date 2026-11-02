export class AppError extends Error {
    status: number;
    details?: unknown;

    constructor(message: string, status = 500, details?: unknown) {
        super(message);
        this.name = "AppError";
        this.status = status;
        this.details = details;
    }
}