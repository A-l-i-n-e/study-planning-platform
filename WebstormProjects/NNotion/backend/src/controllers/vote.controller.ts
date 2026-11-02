import { Request, Response, NextFunction } from "express";
import { z, ZodTypeAny } from "zod";
import {
    CreateVoteSchema,
    DeleteVoteSchema,
    GetVoteByPollSchema,
} from "../schemas/vote.schema";
import { VoteService } from "../services/vote.service";
import { AppError } from "../errors/app-error";

function validateOrThrow<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
    const parsed = schema.safeParse(data);

    if (!parsed.success) {
        throw new AppError("Ошибка валидации", 400, parsed.error.flatten());
    }

    return parsed.data;
}

export class VoteController {
    static create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = validateOrThrow(CreateVoteSchema, req.body);

            const studentId = req.user?.id;
            if (!studentId) {
                return next(new AppError("Необходима авторизация", 401));
            }

            const service = new VoteService();
            const votes = await service.create(studentId, dto);

            return res.status(201).json({ votes });
        } catch (e) {
            return next(e);
        }
    };

    static getMyVote = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetVoteByPollSchema, req.params);

            const studentId = req.user?.id;
            if (!studentId) {
                return next(new AppError("Необходима авторизация", 401));
            }

            const service = new VoteService();
            const votes = await service.getMyVote(studentId, params);

            return res.json({ votes });
        } catch (e) {
            return next(e);
        }
    };

    static deleteMyVote = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(DeleteVoteSchema, req.params);

            const studentId = req.user?.id;
            if (!studentId) {
                return next(new AppError("Необходима авторизация", 401));
            }

            const service = new VoteService();
            await service.deleteMyVote(studentId, params);

            return res.status(204).send();
        } catch (e) {
            return next(e);
        }
    };

    static listPollVotes = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetVoteByPollSchema, req.params);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new VoteService();
            const votes = await service.listPollVotes(currentUser, params.pollId);

            return res.json({ votes });
        } catch (e) {
            return next(e);
        }
    };

    static getPollResults = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const params = validateOrThrow(GetVoteByPollSchema, req.params);
            const currentUser = req.user;

            if (!currentUser) {
                return next(new AppError("Требуется авторизация", 401));
            }

            const service = new VoteService();
            const results = await service.getPollResults(currentUser, params.pollId);

            return res.json({ results });
        } catch (e) {
            return next(e);
        }
    };
}
