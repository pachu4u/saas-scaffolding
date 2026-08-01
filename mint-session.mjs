import { encode } from 'next-auth/jwt';

const token = await encode({
  token: { sub: process.argv[2], email: process.argv[3] },
  secret: process.env.AUTH_SECRET,
  salt: '__Secure-authjs.session-token',
});

console.log(token);
