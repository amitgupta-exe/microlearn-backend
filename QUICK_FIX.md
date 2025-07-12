# Azure Deployment - Quick Fix Guide

## Current Issue: 
You're getting a SERVICE_PRINCIPAL authentication error, which means GitHub Actions is trying to use the wrong authentication method.

## Solution:
I've created a clean, simple workflow: `deploy-simple.yml` that ONLY uses the publish profile method.

## Step-by-Step Fix:

### 1. **Get Your Azure App Service Publish Profile**
```bash
# In Azure Portal:
1. Go to your App Service (should be named 'microlearn-backend')
2. Click "Get publish profile" button (top menu)
3. Save the .PublishSettings file to your computer
4. Open the file in a text editor (Notepad, VS Code, etc.)
5. Copy ALL the content (the entire XML)
```

### 2. **Add the Secret to GitHub**
```bash
# In GitHub:
1. Go to: https://github.com/amitgupta-exe/microlearn-backend/settings/secrets/actions
2. Click "New repository secret"
3. Name: AZURE_WEBAPP_PUBLISH_PROFILE
4. Value: Paste the ENTIRE XML content from the publish profile file
5. Click "Add secret"
```

### 3. **Test the Deployment**
```bash
# After adding the secret:
1. Go to Actions tab in your GitHub repo
2. Click "Deploy to Azure - Publish Profile Only" workflow
3. Click "Run workflow" → "Run workflow"
4. Watch it deploy successfully
```

## Important Notes:

- ✅ **Only use `deploy-simple.yml`** - all other workflows are now disabled
- ✅ **No Azure CLI login needed** - publish profile handles everything
- ✅ **No service principal setup required** - much simpler method
- ✅ **The secret must contain the COMPLETE XML** from the publish profile file

## Verify Your Setup:

1. **Check secret exists:** GitHub Settings → Secrets → Should see `AZURE_WEBAPP_PUBLISH_PROFILE`
2. **Check app name:** Make sure your Azure App Service is actually named `microlearn-backend`
3. **Test manually:** Use the "Run workflow" button to test before pushing code

## If It Still Fails:

- Check that your Azure App Service is running
- Verify the app name matches exactly
- Make sure you copied the COMPLETE publish profile content
- The publish profile file should start with `<?xml version="1.0"...` and end with `</publishData>`
