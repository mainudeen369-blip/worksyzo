import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  faceChallengeRequestSchema,
  faceLoginSchema,
  faceRegisterSchema,
  loginSchema,
  registerSchema,
} from '@worksyzo/shared';
import { CurrentUser } from '../../common/decorators';
import type { AuthenticatedUser } from '../../common/request-context';
import { SessionGuard } from '../../common/guards/session.guard';
import { ZodValidationPipe } from '../../common/zod.pipe';
import { config } from '../../config';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { FaceAuthService } from './face-auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(FaceAuthService) private readonly faceAuth: FaceAuthService,
  ) {}

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: ReturnType<typeof registerSchema.parse>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(body);
    this.setSessionCookie(res, result.sessionToken);
    return result.session;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: ReturnType<typeof loginSchema.parse>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(body);
    this.setSessionCookie(res, result.sessionToken);
    return result.session;
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() _user: AuthenticatedUser,
  ) {
    const token = req.cookies?.[config.session.cookieName] as string | undefined;
    if (token) await this.sessions.revoke(token);
    res.clearCookie(config.session.cookieName, this.cookieOptions());
    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.buildSession(user.id);
  }

  @Post('face/challenge')
  @HttpCode(200)
  async createFaceChallenge(
    @Body(new ZodValidationPipe(faceChallengeRequestSchema))
    body: ReturnType<typeof faceChallengeRequestSchema.parse>,
  ) {
    return this.faceAuth.createChallenge(body.email);
  }

  @Get('face/status')
  @UseGuards(SessionGuard)
  async getFaceStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.faceAuth.getStatus(user.id);
  }

  @Post('face/register')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async registerFace(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(faceRegisterSchema))
    body: ReturnType<typeof faceRegisterSchema.parse>,
  ) {
    return this.faceAuth.register(user.id, body);
  }

  @Post('face/login')
  @HttpCode(200)
  async loginWithFace(
    @Body(new ZodValidationPipe(faceLoginSchema))
    body: ReturnType<typeof faceLoginSchema.parse>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.faceAuth.login(body);
    this.setSessionCookie(res, result.sessionToken);
    return result.session;
  }

  private setSessionCookie(res: Response, token: string): void {
    res.cookie(config.session.cookieName, token, {
      ...this.cookieOptions(),
      maxAge: config.session.ttlDays * 24 * 60 * 60 * 1000,
    });
  }

  private cookieOptions() {
    // Cross-site (Vercel web → Render API) needs SameSite=None + Secure.
    const crossSite = config.session.secure;
    return {
      httpOnly: true,
      sameSite: (crossSite ? 'none' : 'lax') as 'none' | 'lax',
      secure: crossSite,
      path: '/',
    };
  }
}
