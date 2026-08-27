import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE_LABELS, can, type Permission } from '@worksyzo/shared';
import { PERMISSION_KEY } from '../decorators';
import { getContext } from '../request-context';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(execContext: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, [
      execContext.getHandler(),
      execContext.getClass(),
    ]);
    if (!required) return true;

    const role = getContext()?.role;
    if (!role) throw new ForbiddenException('No role resolved for this organization');

    if (!can(role, required)) {
      throw new ForbiddenException(
        `Your role (${ROLE_LABELS[role]}) does not allow this action.`,
      );
    }
    return true;
  }
}
