#!/usr/bin/env node

/**
 * Cloudflare R2 Work Sync Script for Kinetic Pixel Gallery
 * This script syncs video projects from the Muhammad_Affan/video-projects folder to Cloudflare R2
 * It shares the same bucket as the Muhammad_Affan video projects
 * Usage: node scripts/sync-work.js
 * 
 * Environment variables required:
 * - CLOUDFLARE_R2_ACCOUNT_ID: Your Cloudflare account ID
 * - CLOUDFLARE_R2_ACCESS_KEY_ID: R2 access key ID
 * - CLOUDFLARE_R2_SECRET_ACCESS_KEY: R2 secret access key
 * - CLOUDFLARE_R2_BUCKET: Bucket name (default: muhammad-affan-video-editing)
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET || 'muhammad-affan-video-editing';
const WORK_PROJECTS_DIR = path.join('/Users/apple/Data/-----------GITHUB Repositories-----------/Muhammad_Affan/video-projects');
const METADATA_FILE = 'metadata.json';
const SHARED_METADATA_KEY = 'metadata.json'; // Shared metadata for both projects

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: 'https://f80ab5850311ec5bb7df99128daea526.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Get MD5 hash of a file
 */
function getFileHash(filePath) {
  const fileContent = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(fileContent).digest('hex');
}

/**
 * Upload a file to R2 with change detection
 */
async function uploadFile(key, filePath, contentType, forceUpload = false) {
  const fileContent = fs.readFileSync(filePath);
  const fileHash = crypto.createHash('md5').update(fileContent).digest('hex');
  
  // Check if file already exists and hasn't changed by listing and comparing ETags
  if (!forceUpload) {
    try {
      const r2Objects = await listR2Objects();
      const existingObject = r2Objects.find(obj => obj.Key === key);
      if (existingObject && existingObject.ETag) {
        // ETag is often quoted, remove quotes for comparison
        const remoteEtag = existingObject.ETag.replace(/"/g, '');
        if (remoteEtag === fileHash) {
          console.log(`⊘ Skipped (unchanged): ${key}`);
          return { uploaded: false, hash: fileHash };
        }
      }
    } catch (error) {
      console.error(`✗ Failed to check existing file ${key}:`, error.message);
    }
  }
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    console.log(`✓ Uploaded: ${key}`);
    return { uploaded: true, hash: fileHash };
  } catch (error) {
    console.error(`✗ Failed to upload ${key}:`, error.message);
    return { uploaded: false, hash: fileHash };
  }
}

/**
 * Delete a file from R2
 */
async function deleteFile(key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  try {
    await s3Client.send(command);
    console.log(`✓ Deleted: ${key}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to delete ${key}:`, error.message);
    return false;
  }
}

/**
 * List all objects in R2 bucket
 */
async function listR2Objects() {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
  });

  try {
    const response = await s3Client.send(command);
    return response.Contents || [];
  } catch (error) {
    console.error('✗ Failed to list R2 objects:', error.message);
    return [];
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.json': 'application/json',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Convert folder name to title case
 */
function toTitleCase(str) {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\//g, ' - ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Get all local work projects
 */
function getLocalWorkProjects() {
  const projects = [];
  
  if (!fs.existsSync(WORK_PROJECTS_DIR)) {
    console.log('Work projects directory does not exist.');
    return projects;
  }

  const items = fs.readdirSync(WORK_PROJECTS_DIR);
  
  for (const item of items) {
    if (item.startsWith('.')) continue;
    
    const itemPath = path.join(WORK_PROJECTS_DIR, item);
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      // Check if this directory contains subdirectories with actual projects
      const subItems = fs.readdirSync(itemPath);
      const hasSubProjects = subItems.some(subItem => {
        const subPath = path.join(itemPath, subItem);
        const subStats = fs.statSync(subPath);
        return subStats.isDirectory() && (fs.existsSync(path.join(subPath, 'metadata.json')) || hasVideoFile(subPath));
      });
      
      if (hasSubProjects) {
        // Process each subdirectory that contains metadata.json or video files
        for (const subItem of subItems) {
          if (subItem.startsWith('.')) continue;
          
          const subPath = path.join(itemPath, subItem);
          const subStats = fs.statSync(subPath);
          
          if (subStats.isDirectory() && (fs.existsSync(path.join(subPath, 'metadata.json')) || hasVideoFile(subPath))) {
            projects.push({
              name: `${item}/${subItem}`,
              path: subPath,
            });
          }
        }
      } else {
        // Treat as a single project if it has metadata.json directly or video files
        if (fs.existsSync(path.join(itemPath, 'metadata.json')) || hasVideoFile(itemPath)) {
          projects.push({
            name: item,
            path: itemPath,
          });
        }
      }
    }
  }

  return projects;
}

/**
 * Check if directory contains video files
 */
function hasVideoFile(dirPath) {
  const files = fs.readdirSync(dirPath);
  return files.some(f => f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mov'));
}

/**
 * Load metadata from a project folder
 */
function loadProjectMetadata(projectPath, projectName) {
  const metadataPath = path.join(projectPath, METADATA_FILE);
  const cleanName = projectName.split('/').pop();
  const titleCaseName = toTitleCase(cleanName);
  
  if (fs.existsSync(metadataPath)) {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      // Override title and description to match folder name for consistency
      metadata.title = titleCaseName;
      metadata.description = `Video project: ${titleCaseName}`;
      return metadata;
    } catch (error) {
      console.error(`  ✗ Failed to parse metadata for ${projectName}:`, error.message);
    }
  }
  
  // Generate default metadata if not exists
  return {
    title: titleCaseName,
    tag: 'Video',
    year: new Date().getFullYear().toString(),
    span: 'lg:col-span-6',
    description: `Video project: ${titleCaseName}`,
  };
}

/**
 * Process a single work project
 */
async function processProject(project) {
  console.log(`\nProcessing project: ${project.name}`);
  
  const files = fs.readdirSync(project.path);
  const metadata = loadProjectMetadata(project.path, project.name);
  
  // Find thumbnail image
  const thumbnailFile = files.find(f => 
    f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.webp')
  );
  
  // Find video file
  const videoFile = files.find(f => 
    f.endsWith('.mp4') || f.endsWith('.webm') || f.endsWith('.mov')
  );
  
  if (!videoFile) {
    console.log(`  ⚠️  No video found for ${project.name}, skipping...`);
    return null;
  }
  
  // Upload video file
  const videoKey = `${project.name}/${videoFile}`;
  const videoPath = path.join(project.path, videoFile);
  const videoUploadResult = await uploadFile(videoKey, videoPath, getContentType(videoFile));
  
  if (!videoUploadResult.uploaded && !videoUploadResult.hash) {
    return null;
  }
  
  const videoUrl = `https://videoassets.smaffan.com/${videoKey}`;
  
  // Upload thumbnail if exists, otherwise use a placeholder
  let thumbnailUrl = null;
  if (thumbnailFile) {
    const thumbnailKey = `${project.name}/${thumbnailFile}`;
    const thumbnailPath = path.join(project.path, thumbnailFile);
    const uploadResult = await uploadFile(thumbnailKey, thumbnailPath, getContentType(thumbnailFile));
    
    if (uploadResult.uploaded || uploadResult.hash) {
      thumbnailUrl = `https://videoassets.smaffan.com/${thumbnailKey}`;
    }
  } else {
    console.log(`  ⚠️  No thumbnail found for ${project.name}, using video as thumbnail`);
    thumbnailUrl = videoUrl; // Fallback to video URL
  }
  
  // Get file modification time for sorting
  const videoStats = fs.statSync(videoPath);
  const timestamp = videoStats.mtime.getTime();
  
  // Generate work item for shared metadata
  const workItem = {
    ...metadata,
    thumbnail: thumbnailUrl,
    videoUrl: videoUrl,
    timestamp: timestamp,
  };
  
  console.log(`  ✓ Processed ${project.name}`);
  return workItem;
}

/**
 * Build shared metadata from both work and video projects
 */
async function buildSharedMetadata(workItems, localProjects) {
  console.log('\n=== Updating metadata ===');
  
  // Get current local project paths for validation
  const localProjectPaths = new Set(localProjects.map(p => p.name));
  
  // Fetch existing metadata to preserve video projects
  let existingMetadata = [];
  try {
    const response = await fetch('https://videoassets.smaffan.com/metadata.json');
    if (response.ok) {
      existingMetadata = await response.json();
    }
  } catch (error) {
    console.log('⚠️  Could not fetch existing metadata, starting fresh');
  }
  
  // Create a map of existing items by project path (not title) to avoid duplicates
  const existingMap = new Map();
  existingMetadata.forEach(item => {
    // Use videoUrl to extract project path as unique identifier
    if (item.videoUrl) {
      const urlPath = item.videoUrl.replace('https://videoassets.smaffan.com/', '');
      // Extract the full path (directory) without the filename
      const pathParts = urlPath.split('/');
      pathParts.pop(); // Remove the filename
      const projectPath = pathParts.join('/');
      
      // Only keep items that still exist locally
      if (localProjectPaths.has(projectPath)) {
        // Update the title and description to match current folder structure
        const cleanName = projectPath.split('/').pop();
        const updatedTitle = toTitleCase(cleanName);
        
        if (item.title !== updatedTitle) {
          console.log(`✓ Updating title: "${item.title}" → "${updatedTitle}"`);
          item.title = updatedTitle;
          item.description = `Video project: ${updatedTitle}`;
        }
        
        existingMap.set(projectPath, item);
      } else {
        console.log(`⊘ Removing orphaned metadata: ${item.title} (${projectPath})`);
      }
    }
  });
  
  // Update or add new work items using project path as key
  workItems.forEach(item => {
    if (item.videoUrl) {
      const urlPath = item.videoUrl.replace('https://videoassets.smaffan.com/', '');
      const pathParts = urlPath.split('/');
      pathParts.pop(); // Remove the filename
      const projectPath = pathParts.join('/');
      existingMap.set(projectPath, item);
    }
  });
  
  // Convert back to array and sort by timestamp (newest first)
  const combinedMetadata = Array.from(existingMap.values());
  
  // Sort by timestamp descending (newest first)
  // If no timestamp, use year as fallback, then oldest timestamp
  combinedMetadata.sort((a, b) => {
    // If both have timestamps, use them
    if (a.timestamp && b.timestamp) {
      return b.timestamp - a.timestamp;
    }
    // If only one has timestamp, prioritize it
    if (a.timestamp && !b.timestamp) return -1;
    if (!a.timestamp && b.timestamp) return 1;
    // If neither has timestamp, sort by year descending
    const yearA = parseInt(a.year || '2024');
    const yearB = parseInt(b.year || '2024');
    return yearB - yearA;
  });
  
  return combinedMetadata;
}

/**
 * Clean up orphaned files in R2 that are no longer present locally
 */
async function cleanupOrphanedFiles(localProjects) {
  console.log('\n=== Cleaning up orphaned files ===');
  
  // Get all files from local projects
  const localFiles = new Set();
  localProjects.forEach(project => {
    const files = fs.readdirSync(project.path);
    files.forEach(file => {
      if (!file.startsWith('.')) {
        localFiles.add(`${project.name}/${file}`);
      }
    });
  });
  
  // Get all objects from R2
  const r2Objects = await listR2Objects();
  const orphanedFiles = [];
  
  r2Objects.forEach(obj => {
    const key = obj.Key;
    // Skip metadata.json and files not in our project structure
    if (key === 'metadata.json' || !key.includes('/')) {
      return;
    }
    
    // Check if this file still exists locally
    if (!localFiles.has(key)) {
      orphanedFiles.push(key);
    }
  });
  
  if (orphanedFiles.length === 0) {
    console.log('✓ No orphaned files to clean up');
    return;
  }
  
  console.log(`Found ${orphanedFiles.length} orphaned file(s) to delete:`);
  orphanedFiles.forEach(file => console.log(`  - ${file}`));
  
  // Delete orphaned files (batch delete for efficiency)
  const deletePromises = orphanedFiles.map(key => deleteFile(key));
  await Promise.all(deletePromises);
  
  console.log('✓ Cleanup complete');
}

/**
 * Upload shared metadata to R2
 */
async function uploadSharedMetadata(metadata) {
  const metadataContent = JSON.stringify(metadata, null, 2);
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: SHARED_METADATA_KEY,
    Body: metadataContent,
    ContentType: 'application/json',
  });

  try {
    await s3Client.send(command);
    console.log(`✓ Uploaded shared metadata.json with ${metadata.length} items`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to upload metadata.json:`, error.message);
    return false;
  }
}

/**
 * Main sync function
 */
async function sync() {
  console.log('=== Kinetic Pixel Gallery Video Sync ===\n');
  console.log('Syncing from Muhammad_Affan/video-projects directory\n');
  
  const projects = getLocalWorkProjects();
  
  if (projects.length === 0) {
    console.log('No local video projects found to sync.');
    console.log('The frontend will continue to fetch from the existing R2 bucket.');
    console.log('To add new videos, create folders in Muhammad_Affan/video-projects/ with thumbnail, video.mp4 and metadata.json');
    return;
  }
  
  console.log(`Found ${projects.length} video project(s) to process.\n`);
  
  // Process all work projects
  const workItems = [];
  for (const project of projects) {
    const workItem = await processProject(project);
    if (workItem) {
      workItems.push(workItem);
    }
  }
  
  if (workItems.length === 0) {
    console.log('\nNo video items were successfully processed.');
    return;
  }
  
  // Clean up orphaned files
  await cleanupOrphanedFiles(projects);
  
  // Build and upload shared metadata (pass projects for validation)
  const sharedMetadata = await buildSharedMetadata(workItems, projects);
  await uploadSharedMetadata(sharedMetadata);
  
  console.log('\n=== Sync Complete ===');
  console.log(`Video projects are now available at: https://videoassets.smaffan.com/metadata.json`);
}

// Run sync
sync().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});