import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { config } from '../../config';
import { getContext } from '../request-context';
import { SessionService } from '../../modules/auth/session.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(SessionService) private readonly sessions: SessionService) {}

  async canActivate(execContext: ExecutionContext): Promise<boolean> {
    const req = execContext.switchToHttp().getRequest<Request>();
    const token = req.cookies?.[config.session.cookieName] as string | undefined;
    if (!token) throw new UnauthorizedException('Sign in to continue');

    const user = await this.sessions.resolve(token);
    if (!user) throw new UnauthorizedException('Your session has expired');

    const ctx = getContext();
    if (ctx) ctx.user = user;
    return true;
  }
}
