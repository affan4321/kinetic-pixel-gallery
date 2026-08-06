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
 * Upload a file to R2
 */
async function uploadFile(key, filePath, contentType) {
  const fileContent = fs.readFileSync(filePath);
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    console.log(`✓ Uploaded: ${key}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to upload ${key}:`, error.message);
    return false;
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
  
  if (fs.existsSync(metadataPath)) {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return metadata;
    } catch (error) {
      console.error(`  ✗ Failed to parse metadata for ${projectName}:`, error.message);
    }
  }
  
  // Generate default metadata if not exists
  const cleanName = projectName.split('/').pop(); // Get the last part of the path
  return {
    title: toTitleCase(cleanName),
    tag: 'Video',
    year: new Date().getFullYear().toString(),
    span: 'lg:col-span-6',
    description: `Video project: ${toTitleCase(cleanName)}`,
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
  const videoUploadSuccess = await uploadFile(videoKey, videoPath, getContentType(videoFile));
  
  if (!videoUploadSuccess) {
    return null;
  }
  
  const videoUrl = `https://videoassets.smaffan.com/${videoKey}`;
  
  // Upload thumbnail if exists, otherwise use a placeholder
  let thumbnailUrl = null;
  if (thumbnailFile) {
    const thumbnailKey = `${project.name}/${thumbnailFile}`;
    const thumbnailPath = path.join(project.path, thumbnailFile);
    const uploadSuccess = await uploadFile(thumbnailKey, thumbnailPath, getContentType(thumbnailFile));
    
    if (uploadSuccess) {
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
async function buildSharedMetadata(workItems) {
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
  
  // Create a map of existing items by title to avoid duplicates
  const existingMap = new Map();
  existingMetadata.forEach(item => {
    existingMap.set(item.title, item);
  });
  
  // Update or add new work items
  workItems.forEach(item => {
    existingMap.set(item.title, item);
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
    console.log(`\n✓ Uploaded shared metadata.json with ${metadata.length} items`);
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
  
  // Build and upload shared metadata
  const sharedMetadata = await buildSharedMetadata(workItems);
  await uploadSharedMetadata(sharedMetadata);
  
  console.log('\n=== Sync Complete ===');
  console.log(`Video projects are now available at: https://videoassets.smaffan.com/metadata.json`);
}

// Run sync
sync().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});