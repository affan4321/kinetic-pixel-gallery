const GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
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

export function driveHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey || !connectionKey) throw new Error("Google Drive connection is not configured");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
  };
}

async function listChildren(folderIds: string[]): Promise<DriveFile[]> {
  if (folderIds.length === 0) return [];
  const q = `(${folderIds.map((id) => `'${id}' in parents`).join(" or ")}) and trashed=false`;
  const url = `${GATEWAY}/files?q=${encodeURIComponent(q)}&pageSize=200&fields=${encodeURIComponent(
    "files(id,name,mimeType,modifiedTime,parents,videoMediaMetadata)",
  )}`;
  const res = await fetch(url, { headers: driveHeaders() });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Drive list failed [${res.status}]: ${body}`);
    throw new Error(`Drive list failed [${res.status}]: ${body}`);
  }
  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files ?? [];
}

const NOISE =
  /\b(final|finals|affan|edit|edited|export|output|render|copy|v\d+|ver\d+|sample|extended)\b/gi;

function prettyTitle(name: string) {
  const base = name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");
  const cleaned = base
    .replace(NOISE, " ")
    .replace(/\b\d{1,3}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const text = cleaned.length > 2 ? cleaned : base.replace(/\s+/g, " ").trim();
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

  cache = { at: Date.now(), data };
  return data;
}

export async function streamDriveFile(fileId: string, request: Request): Promise<Response> {
  const range = request.headers.get("range");
  const upstream = await fetch(
    `${GATEWAY}/files/${encodeURIComponent(fileId)}?alt=media&acknowledgeAbuse=true`,
    {
      method: request.method === "HEAD" ? "GET" : request.method,
      headers: range ? { ...driveHeaders(), Range: range } : driveHeaders(),
    },
  );

  if (!upstream.ok && upstream.status !== 206) {
    const body = await upstream.text();
    console.error(`Drive media failed [${upstream.status}]: ${body}`);
    return new Response(`Drive media failed [${upstream.status}]: ${body}`, {
      status: upstream.status,
    });
  }

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("content-type")) headers.set("content-type", "video/mp4");
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=3600");

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
}
