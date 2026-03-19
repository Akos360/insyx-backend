import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Trino, BasicAuth } from 'trino-client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TrinoService implements OnModuleInit {
  private readonly logger = new Logger(TrinoService.name);
  private client: Trino;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.client = Trino.create({
      server:
        this.configService.getOrThrow<string>('TRINO_HOST') ??
        'http://localhost:8080',
      catalog: 'iceberg',
      schema: 'scisci',
      auth: new BasicAuth(
        this.configService.getOrThrow<string>('TRINO_USER') ?? 'backend',
      ),
    });
    this.logger.log(
      `Connected to Trino at ${this.configService.getOrThrow<string>('TRINO_HOST')}`,
    );
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    try {
      const iter = await this.client.query(sql);
      const rows: T[] = [];
      let columns: string[] = [];

      for await (const chunk of iter) {
        if (chunk.columns && columns.length === 0) {
          columns = chunk.columns.map((c: { name: string }) => c.name);
        }
        if (chunk.data && columns.length > 0) {
          for (const row of chunk.data as unknown[][]) {
            const obj = Object.fromEntries(
              columns.map((col, i) => [col, row[i]]),
            );
            rows.push(obj as T);
          }
        }
      }

      return rows;
    } catch (error) {
      this.logger.error(`Query failed: ${sql}`, error);
      throw error;
    }
  }
}
