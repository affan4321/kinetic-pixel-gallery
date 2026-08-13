import { createFileRoute } from "@tanstack/react-router";
import { streamDriveFile } from "@/lib/drive.server";

export const Route = createFileRoute("/api/public/media/$fileId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => streamDriveFile(params.fileId, request),
      HEAD: async ({ request, params }) => streamDriveFile(params.fileId, request),
    },
  },
});
