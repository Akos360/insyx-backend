import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Trino, BasicAuth } from 'trino-client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TrinoService implements OnModuleInit {
  private readonly logger = new Logger(TrinoService.name);
  private client: Trino;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const server = this.configService.get<string>('TRINO_HOST') ?? 'http://localhost:8080';
    const catalog = this.configService.get<string>('TRINO_CATALOG') ?? 'iceberg';
    const schema = this.configService.get<string>('TRINO_SCHEMA') ?? 'scisci';
    const user = this.configService.get<string>('TRINO_USER') ?? 'backend';
    const password = this.configService.get<string>('TRINO_PASSWORD');

    this.client = Trino.create({
      server,
      catalog,
      schema,
      auth: new BasicAuth(user, password),
    });
    this.logger.log(`Configured Trino connection: ${server}/${catalog}/${schema} as ${user}`);
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

  async health(): Promise<{ ok: boolean; rows: Record<string, unknown>[] }> {
    const rows = await this.query('SELECT current_catalog AS catalog, current_schema AS schema');
    return { ok: true, rows };
  }
}
