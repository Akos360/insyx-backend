import { forceHttps } from './force-https.middleware';

function mockReq(headers: Record<string, string>) {
  return { headers, originalUrl: '/works?limit=1' } as any;
}

function mockRes() {
  return { redirect: jest.fn() } as any;
}

describe('forceHttps', () => {
  it('redirects to https when x-forwarded-proto proves a proxy forwarded as http', () => {
    const req = mockReq({ 'x-forwarded-proto': 'http', host: 'insyx.example.com' });
    const res = mockRes();
    const next = jest.fn();

    forceHttps(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith(301, 'https://insyx.example.com/works?limit=1');
    expect(next).not.toHaveBeenCalled();
  });

  it('does nothing when x-forwarded-proto is already https', () => {
    const req = mockReq({ 'x-forwarded-proto': 'https', host: 'insyx.example.com' });
    const res = mockRes();
    const next = jest.fn();

    forceHttps(req, res, next);

    expect(res.redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('does nothing when there is no x-forwarded-proto header at all (direct/unproxied access — our local Docker setup)', () => {
    const req = mockReq({ host: 'localhost:3000' });
    const res = mockRes();
    const next = jest.fn();

    forceHttps(req, res, next);

    expect(res.redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
