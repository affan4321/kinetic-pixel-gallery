import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

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

let driveClient: any = null;

function getDriveClient() {
  if (driveClient) return driveClient;
  
  const credentials = process.env["GOOGLE_SERVICE_ACCOUNT_CREDENTIALS"];
  if (!credentials) {
    throw new Error("Google Service Account credentials are not configured");
  }
  
  let credentialsObj;
  try {
    credentialsObj = JSON.parse(credentials);
  } catch (e) {
    throw new Error("Invalid Google Service Account credentials JSON");
  }
  
  const auth = new GoogleAuth({
    credentials: credentialsObj,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  
  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

async function listChildren(folderIds: string[]): Promise<DriveFile[]> {
  if (folderIds.length === 0) return [];
  
  const drive = getDriveClient();
  const q = `(${folderIds.map((id) => `'${id}' in parents`).join(" or ")}) and trashed=false`;
  
  try {
    const response = await drive.files.list({
      q: q,
      pageSize: 200,
      fields: 'files(id,name,mimeType,modifiedTime,parents,videoMediaMetadata)',
    });
    
    return response.data.files as DriveFile[] || [];
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
  const range = request.headers.get("range");
  const drive = getDriveClient();
  
  try {
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media',
      acknowledgeAbuse: true,
    }, { responseType: 'stream' });

    const responseHeaders = new Headers();
    responseHeaders.set("content-type", "video/mp4");
    responseHeaders.set("accept-ranges", "bytes");
    responseHeaders.set("cache-control", "public, max-age=3600");
    
    if (range) {
      // Handle range requests for video streaming
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : response.data.size - 1;
      const chunksize = (end - start) + 1;
      
      responseHeaders.set("content-range", `bytes ${start}-${end}/${response.data.size}`);
      responseHeaders.set("content-length", chunksize.toString());
      
      return new Response(response.data, {
        status: 206,
        headers: responseHeaders,
      });
    } else {
      responseHeaders.set("content-length", response.data.size?.toString() || "0");
      return new Response(response.data, {
        status: 200,
        headers: responseHeaders,
      });
    }
  } catch (error) {
    console.error(`Drive media failed:`, error);
    return new Response(`Drive media failed: ${error}`, {
      status: 500,
    });
  }
}
