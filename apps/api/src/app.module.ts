import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ContextMiddleware } from './common/context.middleware';
import { OrgGuard } from './common/guards/org.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { SessionGuard } from './common/guards/session.guard';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { AiModule } from './modules/ai/ai.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { HealthController } from './modules/health/health.controller';
import { OrgsModule } from './modules/orgs/orgs.module';

@Module({
  imports: [AuditModule, AuthModule, OrgsModule, DocumentsModule, AiModule],
  controllers: [HealthController],
  providers: [SessionGuard, OrgGuard, PermissionGuard],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ContextMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
