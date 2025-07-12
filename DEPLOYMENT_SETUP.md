# Deployment Setup Guide

## Files Created:
- `.github/workflows/azure-deploy.yml` - GitHub Actions workflow
- `azure-pipelines.yml` - Azure DevOps pipeline

## Setup Instructions:

### For GitHub Actions Deployment:

1. **Create Azure App Service:**
   - Go to Azure Portal
   - Create a new App Service (Web App)
   - Choose Node.js 18 LTS runtime
   - Name it `microlearn-backend` (or update the YAML file)

2. **Download Publish Profile:**
   - In Azure Portal, go to your App Service
   - Click "Get publish profile" and download the file
   - Copy the entire contents of the downloaded file

3. **Add GitHub Secrets:**
   - Go to your GitHub repository
   - Settings → Secrets and Variables → Actions
   - Click "New repository secret"
   - Name: `AZURE_WEBAPP_PUBLISH_PROFILE`
   - Value: Paste the entire publish profile content

4. **Configure Environment Variables in Azure:**
   - Go to your App Service in Azure Portal
   - Configuration → Application settings
   - Add these environment variables:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_key
   SUPABASE_SERVICE_KEY=your_service_key
   AZURE_OPENAI_ENDPOINT=your_openai_endpoint
   AZURE_OPENAI_KEY=your_openai_key
   WATI_API_TOKEN=your_wati_token
   WATI_API_URL=your_wati_url
   NODE_ENV=production
   PORT=80
   ```

### For Azure DevOps Pipeline:

1. **Create Service Connection:**
   - Go to Azure DevOps → Project Settings
   - Service connections → New service connection
   - Choose "Azure Resource Manager"
   - Complete the authentication setup

2. **Update Pipeline Variables:**
   - Edit `azure-pipelines.yml`
   - Update `azureSubscription` with your service connection name
   - Update `webAppName` with your actual app name
   - Update `resourceGroupName` with your resource group

3. **Create Pipeline:**
   - Go to Pipelines → New pipeline
   - Choose your repository
   - Select "Existing Azure Pipelines YAML file"
   - Choose `/azure-pipelines.yml`

## Important Notes:

- **Update App Names:** Replace `microlearn-backend` with your actual Azure App Service name
- **Node.js Version:** The workflows use Node.js 18.x (update if you need a different version)
- **Environment Variables:** Make sure to set all required environment variables in Azure App Service
- **Resource Group:** Update the resource group name in azure-pipelines.yml
- **Startup Command:** Both workflows use `node server.js` as the startup command

## Testing:

1. Push your code to the `main` branch
2. Check the Actions/Pipelines tab to see the deployment progress
3. Once deployed, your app will be available at: `https://your-app-name.azurewebsites.net`

## Troubleshooting:

- Check the deployment logs in GitHub Actions or Azure DevOps
- Verify all environment variables are set correctly in Azure
- Ensure your `package.json` has all required dependencies
- Check Azure App Service logs for runtime errors
