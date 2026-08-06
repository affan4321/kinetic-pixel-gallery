#!/usr/bin/env node

/**
 * Cloudflare R2 Work Sync Script for Kinetic Pixel Gallery
 * This script syncs work projects from the work-projects folder to Cloudflare R2
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
const WORK_PROJECTS_DIR = path.join(__dirname, '../work-projects');
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
    
    const projectPath = path.join(WORK_PROJECTS_DIR, item);
    const stats = fs.statSync(projectPath);
    
    if (stats.isDirectory()) {
      projects.push({
        name: item,
        path: projectPath,
      });
    }
  }

  return projects;
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
  return {
    title: toTitleCase(projectName),
    tag: 'Portfolio',
    year: new Date().getFullYear().toString(),
    span: 'lg:col-span-6',
    description: `Work project: ${toTitleCase(projectName)}`,
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
  
  if (!thumbnailFile) {
    console.log(`  ⚠️  No thumbnail found for ${project.name}, skipping...`);
    return null;
  }
  
  // Upload thumbnail with project folder prefix
  const thumbnailKey = `work/${project.name}/${thumbnailFile}`;
  const thumbnailPath = path.join(project.path, thumbnailFile);
  
  const uploadSuccess = await uploadFile(thumbnailKey, thumbnailPath, getContentType(thumbnailFile));
  
  if (!uploadSuccess) {
    return null;
  }
  
  // Generate work item for shared metadata
  const workItem = {
    ...metadata,
    thumbnail: `https://videoassets.smaffan.com/${thumbnailKey}`,
    projectType: 'work', // Distinguish from video projects
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
  
  // Separate video projects from work projects
  const videoProjects = existingMetadata.filter(item => !item.projectType || item.projectType !== 'work');
  
  // Combine video projects with new work projects
  const combinedMetadata = [...videoProjects, ...workItems];
  
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
  console.log('=== Kinetic Pixel Gallery Work Sync ===\n');
  
  const projects = getLocalWorkProjects();
  
  if (projects.length === 0) {
    console.log('No local work projects found to sync.');
    console.log('The frontend will continue to fetch from the existing R2 bucket.');
    console.log('To add new work, create folders in work-projects/ with thumbnail.jpg and metadata.json');
    return;
  }
  
  console.log(`Found ${projects.length} work project(s) to process.\n`);
  
  // Process all work projects
  const workItems = [];
  for (const project of projects) {
    const workItem = await processProject(project);
    if (workItem) {
      workItems.push(workItem);
    }
  }
  
  if (workItems.length === 0) {
    console.log('\nNo work items were successfully processed.');
    return;
  }
  
  // Build and upload shared metadata
  const sharedMetadata = await buildSharedMetadata(workItems);
  await uploadSharedMetadata(sharedMetadata);
  
  console.log('\n=== Sync Complete ===');
  console.log(`Work projects are now available at: https://videoassets.smaffan.com/metadata.json`);
}

// Run sync
sync().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});