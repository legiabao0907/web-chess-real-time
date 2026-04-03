import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from './drizzle/drizzle.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './drizzle/schema/schema';

@Injectable()
export class AppService {
  constructor(
    @Inject(DRIZZLE) private drizzle: NodePgDatabase<typeof schema>
  ) {}

  getHello(): string {
    return 'Hello World!';
  }
}
