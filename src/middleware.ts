import { NextRequest, NextResponse } from 'next/server';

// Comma-separated list of allowed IPv4 addresses or CIDR ranges, e.g. "203.0.113.5,192.168.1.0/24"
const ALLOWED_IPS = (process.env.ALLOWED_IPS ?? '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean);

function ipToLong(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isIpAllowed(ip: string): boolean {
  if (ALLOWED_IPS.length === 0) return true; // no restriction configured

  return ALLOWED_IPS.some((entry) => {
    if (entry.includes('/')) {
      const [range, bits] = entry.split('/');
      const mask = ~((1 << (32 - Number(bits))) - 1) >>> 0;
      return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
    }
    return entry === ip;
  });
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow the admin dashboard to be accessed from anywhere once the Firebase admin login is completed.
  if (pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  const clientIp = forwardedFor?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? '';

  if (!isIpAllowed(clientIp)) {
    return new NextResponse('Access denied.', { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|admin).*)'],
};
