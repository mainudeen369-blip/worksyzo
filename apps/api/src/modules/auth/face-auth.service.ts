import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { queryOne, withIdentity } from '@worksyzo/db';
import {
  AUDIT_ACTIONS,
  type FaceChallengeResponse,
  type FaceCredentialStatus,
  type FaceLoginInput,
  type FaceRegisterInput,
  type SessionResponse,
} from '@worksyzo/shared';
import { AuditService } from '../audit/audit.service';
import { SessionService } from './session.service';
import { AuthService } from './auth.service';
import { getContext } from '../../common/request-context';

const CHALLENGE_INSTRUCTIONS: Record<'smile' | 'blink' | 'surprise' | 'neutral', string> = {
  smile: 'Smile at the camera to verify your identity',
  blink: 'Blink your eyes at the camera to verify liveness',
  surprise: 'Open your mouth in surprise at the camera',
  neutral: 'Look directly at the camera with a neutral expression',
};

@Injectable()
export class FaceAuthService {
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async createChallenge(email?: string): Promise<FaceChallengeResponse> {
    let userId: string | null = null;
    if (email) {
      const user = await withIdentity((c) =>
        queryOne<{ id: string }>(c, 'SELECT id FROM users WHERE lower(email) = lower($1)', [email]),
      );
      if (user) userId = user.id;
    }

    const types: ('smile' | 'blink' | 'surprise' | 'neutral')[] = ['smile', 'blink', 'neutral'];
    const chosenType = types[Math.floor(Math.random() * types.length)] || 'smile';
    const nonce = randomBytes(16).toString('hex');
    const expiresInSeconds = 120;

    const row = await withIdentity((c) =>
      queryOne<{ id: string }>(
        c,
        `INSERT INTO face_auth_challenges (user_id, challenge_type, nonce, expires_at)
         VALUES ($1, $2, $3, now() + interval '120 seconds')
         RETURNING id`,
        [userId, chosenType, nonce],
      ),
    );

    if (!row) throw new Error('Failed to create face challenge');

    return {
      challengeId: row.id,
      challengeType: chosenType,
      instruction: CHALLENGE_INSTRUCTIONS[chosenType],
      expiresInSeconds,
    };
  }

  async getStatus(userId: string): Promise<FaceCredentialStatus> {
    const cred = await withIdentity((c) =>
      queryOne<{
        registered_expression: string;
        created_at: Date;
        last_used_at: Date | null;
      }>(
        c,
        'SELECT registered_expression, created_at, last_used_at FROM user_face_credentials WHERE user_id = $1',
        [userId],
      ),
    );

    if (!cred) {
      return { enrolled: false };
    }

    return {
      enrolled: true,
      registeredExpression: cred.registered_expression,
      createdAt: cred.created_at.toISOString(),
      lastUsedAt: cred.last_used_at ? cred.last_used_at.toISOString() : null,
    };
  }

  async register(
    userId: string,
    input: FaceRegisterInput,
  ): Promise<{ ok: boolean; status: FaceCredentialStatus }> {
    await this.verifyAndConsumeChallenge(input.challengeId, input.expression, userId);

    if (!input.descriptor || input.descriptor.length < 16) {
      throw new BadRequestException('Invalid face descriptor vector');
    }

    await withIdentity((c) =>
      c.query(
        `INSERT INTO user_face_credentials (user_id, descriptor, registered_expression, updated_at)
         VALUES ($1, $2::jsonb, $3, now())
         ON CONFLICT (user_id) DO UPDATE SET
           descriptor = EXCLUDED.descriptor,
           registered_expression = EXCLUDED.registered_expression,
           updated_at = now()`,
        [userId, JSON.stringify(input.descriptor), input.expression],
      ),
    );

    return {
      ok: true,
      status: await this.getStatus(userId),
    };
  }

  async login(input: FaceLoginInput): Promise<{ sessionToken: string; session: SessionResponse }> {
    const user = await withIdentity((c) =>
      queryOne<{ id: string; email: string }>(
        c,
        'SELECT id, email FROM users WHERE lower(email) = lower($1)',
        [input.email],
      ),
    );

    if (!user) {
      throw new UnauthorizedException('No account found for this email address');
    }

    await this.verifyAndConsumeChallenge(input.challengeId, input.expression, user.id);

    const cred = await withIdentity((c) =>
      queryOne<{ descriptor: number[] }>(
        c,
        'SELECT descriptor FROM user_face_credentials WHERE user_id = $1',
        [user.id],
      ),
    );

    if (!cred || !Array.isArray(cred.descriptor)) {
      throw new UnauthorizedException(
        'Face login is not enrolled for this account. Please sign in with password first to enroll your face.',
      );
    }

    const distance = this.computeDistance(cred.descriptor, input.descriptor);
    const similarity = this.computeCosineSimilarity(cred.descriptor, input.descriptor);

    // Accept if Euclidean distance <= 0.58 OR Cosine Similarity >= 0.72
    const isMatch = distance <= 0.58 || similarity >= 0.72;

    if (!isMatch) {
      // eslint-disable-next-line no-console
      console.warn(
        `Face match rejected for ${user.email}: distance=${distance.toFixed(4)}, similarity=${similarity.toFixed(4)}`,
      );
      throw new UnauthorizedException(
        `Face verification did not match. Please ensure good lighting and look directly at the camera.`,
      );
    }

    await withIdentity((c) =>
      c.query(
        'UPDATE user_face_credentials SET last_used_at = now() WHERE user_id = $1',
        [user.id],
      ),
    );
    await withIdentity((c) =>
      c.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]),
    );

    const ctx = getContext();
    const sessionToken = await this.sessions.create(user.id, {
      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
    });

    return { sessionToken, session: await this.auth.buildSession(user.id) };
  }

  private async verifyAndConsumeChallenge(
    challengeId: string,
    expression: string,
    expectedUserId?: string,
  ): Promise<void> {
    const challenge = await withIdentity((c) =>
      queryOne<{
        id: string;
        user_id: string | null;
        challenge_type: string;
        expires_at: Date;
        used_at: Date | null;
      }>(c, 'SELECT * FROM face_auth_challenges WHERE id = $1', [challengeId]),
    );

    if (!challenge) {
      throw new BadRequestException('Face authentication challenge not found or expired');
    }

    if (challenge.used_at) {
      throw new BadRequestException('This biometric challenge has already been used');
    }

    if (new Date() > new Date(challenge.expires_at)) {
      throw new BadRequestException('Biometric verification challenge expired. Please retry.');
    }

    if (challenge.challenge_type !== expression) {
      throw new BadRequestException(
        `Liveness check failed: required expression was "${challenge.challenge_type}", but detected "${expression}"`,
      );
    }

    if (expectedUserId && challenge.user_id && challenge.user_id !== expectedUserId) {
      throw new UnauthorizedException('Challenge user mismatch');
    }

    await withIdentity((c) =>
      c.query('UPDATE face_auth_challenges SET used_at = now() WHERE id = $1', [challengeId]),
    );
  }

  private computeDistance(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    if (len === 0) return 1.0;
    let sum = 0;
    for (let i = 0; i < len; i++) {
      const diff = (a[i] ?? 0) - (b[i] ?? 0);
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  private computeCosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    if (len === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < len; i++) {
      const valA = a[i] ?? 0;
      const valB = b[i] ?? 0;
      dot += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  }
}
