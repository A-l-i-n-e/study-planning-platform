import jwt from "jsonwebtoken";

export type JwtPayload = {
    id: number;
    email: string;
    role: string;
};

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key";

export function signAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: "1d",
    });
}

export function verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
}