# Captivate Creative Studio

I'm building a stunning website for my video editing portfolio. I have my picture and my work to showcase. I want a website that can impress and stand out in terms of style, design, strong motives, animations, and everything flawlessly put.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3e81460d-4193-4867-98a5-75e81fa117d8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deployment

### Vercel Deployment

This project is configured for Vercel deployment:

1. **Push to GitHub**: Ensure your code is pushed to a GitHub repository
2. **Import to Vercel**: 
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
3. **Configure Settings**:
   - Build Command: `npm run build`
   - Output Directory: `.output`
   - Install Command: `npm install`
4. **Environment Variables** (optional - only needed for sync-work script):
   - `CLOUDFLARE_R2_ACCOUNT_ID`
   - `CLOUDFLARE_R2_ACCESS_KEY_ID`
   - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
   - `CLOUDFLARE_R2_BUCKET`
5. **Deploy**: Click "Deploy"

The frontend fetches work data from `https://videoassets.smaffan.com/metadata.json`, so no environment variables are required for the site to function.

### Adding New Work

To add new portfolio items:

1. Create a folder in `work-projects/` (e.g., `work-projects/my-project/`)
2. Add files:
   - `thumbnail.jpg` (or .png/.webp)
   - `metadata.json` with:
     ```json
     {
       "title": "Project Title",
       "tag": "Category",
       "year": "2025",
       "span": "lg:col-span-6",
       "description": "Project description"
     }
     ```
3. Run sync script: `npm run sync-work`
4. Commit and push changes

The sync script uploads your work to the shared Cloudflare R2 bucket, making it available on both this site and your Muhammad_Affan portfolio.
