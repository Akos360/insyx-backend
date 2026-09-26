import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WorksQueryDto } from './works-query.dto';

// Regression test for a real bug caught during manual verification: with
// ValidationPipe's `enableImplicitConversion: true`, class-transformer's own
// implicit Boolean(value) cast ran instead of/after the custom @Transform,
// and Boolean("false") is `true` (any non-empty string is truthy) — so
// `?is_oa=false` silently behaved identically to `?is_oa=true`. Fixed by
// removing enableImplicitConversion (main.ts) since every field already has
// an explicit @Type()/@Transform(). This test exercises the DTO exactly the
// way ValidationPipe does (plainToInstance, no implicit conversion) so the
// bug can't silently come back.
describe('WorksQueryDto', () => {
  async function transformAndValidate(plain: Record<string, string>) {
    const dto = plainToInstance(WorksQueryDto, plain);
    const errors = await validate(dto);
    return { dto, errors };
  }

  it('is_oa=false transforms to boolean false, not true', async () => {
    const { dto, errors } = await transformAndValidate({ is_oa: 'false' });
    expect(errors).toHaveLength(0);
    expect(dto.is_oa).toBe(false);
  });

  it('is_oa=true transforms to boolean true', async () => {
    const { dto, errors } = await transformAndValidate({ is_oa: 'true' });
    expect(errors).toHaveLength(0);
    expect(dto.is_oa).toBe(true);
  });

  it('omitted is_oa stays undefined (no filter applied)', async () => {
    const { dto, errors } = await transformAndValidate({});
    expect(errors).toHaveLength(0);
    expect(dto.is_oa).toBeUndefined();
  });

  it('numeric fields transform string query params to real numbers', async () => {
    const { dto, errors } = await transformAndValidate({ limit: '25', yearFrom: '2020' });
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(25);
    expect(dto.yearFrom).toBe(2020);
  });

  it('rejects an out-of-range limit', async () => {
    const { errors } = await transformAndValidate({ limit: '500' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a sortBy value outside the whitelist', async () => {
    const { errors } = await transformAndValidate({ sortBy: 'hackme' });
    expect(errors.length).toBeGreaterThan(0);
  });
});
