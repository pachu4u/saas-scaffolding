import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://docs.example.com/scim',
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: true },
    authenticationSchemes: [
      {
        name: 'OAuth Bearer Token',
        description: 'Authentication scheme using the OAuth Bearer Token Standard',
        specUri: 'http://www.rfc-editor.org/info/rfc6750',
        type: 'oauthbearertoken',
        primary: true,
      },
    ],
  });
}
