import { Controller, Get } from '@nestjs/common';
import { getObjectStorage, storageSetupHint } from '@worksyzo/storage';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    let storage = { driver: 'unknown', detail: 'unavailable' };
    try {
      const s = getObjectStorage();
      storage = { driver: s.driver, detail: s.describe() };
    } catch (error) {
      storage = { driver: 'error', detail: (error as Error).message };
    }

    return {
      ok: true,
      service: 'worksyzo-api',
      time: new Date().toISOString(),
      step: 'B',
      storage,
      storageHint: storageSetupHint(),
      aiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    };
  }
}
