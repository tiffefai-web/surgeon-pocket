import { SignJWT, jwtVerify } from 'jose';

const secretKey = process.env.JWT_SECRET || 'super-secret-key-for-surgeon-pocket';
const key = new TextEncoder().encode(secretKey);

export type SessionPayload = {
  userId: number;
  username: string;
  role: 'Admin' | 'Surgeon';
  expiresAt: Date;
};

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(key);
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, key, {
      algorithms: ['HS256'],
    });
    return payload as SessionPayload;
  } catch (error) {
    return null;
  }
}
