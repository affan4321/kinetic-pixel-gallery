// Pure URL builders, safe to import from client code — no Node-only deps,
// no service account, no API key. Kept out of drive.server.ts so a client
// import can never accidentally pull in google-auth-library.

export function getDriveThumbnailUrl(fileId: string, width = 800): string {
  return `https://lh3.googleusercontent.com/d/${fileId}=w${width}`;
}

export function getDriveEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview?usp=embed`;
}
