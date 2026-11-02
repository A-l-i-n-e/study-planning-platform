import { z } from "zod";

export const CreateVoteSchema = z.object({
    pollId: z.coerce.number().positive(),
    optionId: z.coerce.number().positive().optional(),
    optionIds: z.array(z.coerce.number().positive()).min(1).optional(),
}).refine((data) => data.optionId !== undefined || data.optionIds !== undefined, {
    message: "Не выбран вариант голосования",
    path: ["optionIds"],
});

export type CreateVoteDto = z.infer<typeof CreateVoteSchema>;

export const GetVoteByPollSchema = z.object({
    pollId: z.coerce.number().positive(),
});

export type GetVoteByPollDto = z.infer<typeof GetVoteByPollSchema>;

export const DeleteVoteSchema = z.object({
    pollId: z.coerce.number().positive(),
});

export type DeleteVoteDto = z.infer<typeof DeleteVoteSchema>;
