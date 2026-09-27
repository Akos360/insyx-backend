import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WorksQueryDto } from './works-query.dto';

// Regression test: enableImplicitConversion made Boolean("false") true, so ?is_oa=false
// silently behaved like ?is_oa=true. Fixed by removing it in main.ts; this guards it stays fixed.
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
