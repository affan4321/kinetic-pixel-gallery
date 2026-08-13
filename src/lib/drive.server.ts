import { GoogleAuth } from 'google-auth-library';

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const ROOT_FOLDER_ID = "1h6mGR_WOLZwqC-UrJqVrlkB6HmBlebfF";
const CACHE_MS = 5 * 60 * 1000;

export type DriveWork = {
  id: string;
  title: string;
  tag: string;
  year: string;
  duration: number;
  portrait: boolean;
  videoUrl: string;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  parents?: string[];
  videoMediaMetadata?: { width?: number; height?: number; durationMillis?: string };
};

let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }
  
  const credentials = process.env["GOOGLE_SERVICE_ACCOUNT_CREDENTIALS"];
  if (!credentials) {
    console.error("Google Service Account credentials are not configured");
    throw new Error("Google Service Account credentials are not configured");
  }
  
  let credentialsObj;
  try {
    credentialsObj = JSON.parse(credentials);
  } catch (e) {
    console.error("Invalid Google Service Account credentials JSON:", e);
    throw new Error("Invalid Google Service Account credentials JSON");
  }
  
  try {
    const auth = new GoogleAuth({
      credentials: credentialsObj,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    
    if (!tokenResponse.token) {
      throw new Error("Failed to obtain access token from Google Auth");
    }
    
    accessToken = tokenResponse.token;
    // Set expiry to 55 minutes (default token lifetime is 1 hour)
    tokenExpiry = Date.now() + 55 * 60 * 1000;
    
    return accessToken;
  } catch (error) {
    console.error("Failed to get access token:", error);
    throw new Error(`Failed to get access token: ${error}`);
  }
}

async function listChildren(folderIds: string[]): Promise<DriveFile[]> {
  if (folderIds.length === 0) return [];
  
  const accessToken = await getAccessToken();
  const q = `(${folderIds.map((id) => `'${id}' in parents`).join(" or ")}) and trashed=false`;
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&pageSize=200&fields=${encodeURIComponent(
    "files(id,name,mimeType,modifiedTime,parents,videoMediaMetadata)",
  )}`;
  
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!res.ok) {
      const body = await res.text();
      console.error(`Drive list failed [${res.status}]: ${body}`);
      throw new Error(`Drive list failed [${res.status}]: ${body}`);
    }
    
    const data = (await res.json()) as { files?: DriveFile[] };
    return data.files ?? [];
  } catch (error) {
    console.error(`Drive list failed:`, error);
    throw new Error(`Drive list failed: ${error}`);
  }
}

const NOISE = new Set([
  "final",
  "finals",
  "affan",
  "edit",
  "edited",
  "export",
  "output",
  "render",
  "copy",
  "sample",
  "extended",
  "v",
  "ver",
  "version",
  "main",
  "new",
  "old",
]);

function prettyTitle(name: string) {
  const base = name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");
  const tokens = base
    .split(/\s+/)
    .map((t) => t.replace(/\d+$/, "").trim())
    .filter((t) => t.length > 0 && !NOISE.has(t.toLowerCase()));
  const text = tokens.length ? tokens.join(" ") : base.trim() || "Untitled";
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}

let cache: { at: number; data: DriveWork[] } | null = null;

export async function fetchDriveWork(): Promise<DriveWork[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  const top = await listChildren([ROOT_FOLDER_ID]);
  const folders = top.filter((f) => f.mimeType === "application/vnd.google-apps.folder");
  const folderName = new Map(folders.map((f) => [f.id, f.name]));
  const nested = folders.length ? await listChildren(folders.map((f) => f.id)) : [];

  const files = [...top, ...nested].filter((f) => f.mimeType.startsWith("video/"));

  const data = files
    .sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""))
    .map((f) => {
      const meta = f.videoMediaMetadata ?? {};
      const width = meta.width ?? 16;
      const height = meta.height ?? 9;
      return {
        id: f.id,
        title: prettyTitle(f.name),
        tag: folderName.get(f.parents?.[0] ?? "") ?? "Film",
        year: (f.modifiedTime ?? "").slice(0, 4) || String(new Date().getFullYear()),
        duration: Math.round(Number(meta.durationMillis ?? 0) / 1000),
        portrait: height > width,
        videoUrl: `/api/public/media/${f.id}`,
      } satisfies DriveWork;
    });

  const seen = new Map<string, number>();
  const numerals = ["", " II", " III", " IV", " V", " VI"];
  for (const item of data) {
    const n = seen.get(item.title) ?? 0;
    seen.set(item.title, n + 1);
    item.title += numerals[n] ?? ` ${n + 1}`;
  }

  cache = { at: Date.now(), data };
  return data;
}

export async function streamDriveFile(fileId: string, request: Request): Promise<Response> {
  try {
    const range = request.headers.get("range");
    console.log(`Streaming file ${fileId}, range: ${range}`);
    
    const accessToken = await getAccessToken();
    console.log(`Got access token successfully`);
    
    // For Google Drive API, we need to use alt=media to get the file content
    const url = `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&acknowledgeAbuse=true`;
    
    const options: RequestInit = {
      method: request.method === "HEAD" ? "GET" : request.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
    
    if (range) {
      options.headers = {
        ...options.headers,
        Range: range,
      };
    }
    
    console.log(`Fetching from Drive API: ${url}`);
    const upstream = await fetch(url, options);
    console.log(`Drive API response status: ${upstream.status}`);

    if (!upstream.ok && upstream.status !== 206) {
      const body = await upstream.text();
      console.error(`Drive media failed [${upstream.status}]: ${body}`);
      return new Response(`Drive media failed [${upstream.status}]: ${body}`, {
        status: upstream.status,
      });
    }

    const responseHeaders = new Headers();
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag"]) {
      const v = upstream.headers.get(h);
      if (v) responseHeaders.set(h, v);
    }
    if (!responseHeaders.has("content-type")) responseHeaders.set("content-type", "video/mp4");
    if (!responseHeaders.has("accept-ranges")) responseHeaders.set("accept-ranges", "bytes");
    responseHeaders.set("cache-control", "public, max-age=3600");

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`Drive media failed for file ${fileId}:`, error);
    return new Response(`Drive media failed: ${error}`, {
      status: 500,
    });
  }
}
