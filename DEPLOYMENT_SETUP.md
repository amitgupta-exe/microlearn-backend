# Deployment Setup Guide

## Files Created:
- `.github/workflows/main_microlearn-backend.yml` - GitHub Actions workflow (Publish Profile method)
- `.github/workflows/azure-deploy-sp.yml` - GitHub Actions workflow (Service Principal method)
- `azure-pipelines.yml` - Azure DevOps pipeline
- `web.config` - Azure App Service configuration
- `process.json` - Process management
- `.deployment` - Azure deployment configuration

## Recent Fixes Applied:
1. **Fixed Azure authentication error** by reverting to azure/webapps-deploy@v2 with publish profile
2. **Added alternative Service Principal workflow** for advanced authentication
3. **Added health check endpoints** at `/` and `/health`
4. **Improved error handling** with graceful shutdown
5. **Added web.config** for proper Node.js handling in Azure
6. **Fixed npm installation** to include all dependencies
7. **Added engine specifications** in package.json

## Setup Instructions:

### For GitHub Actions Deployment:

**Method 1: Using Publish Profile (Recommended - Simpler Setup)**

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

4. **Use the main workflow:** The `main_microlearn-backend.yml` workflow will automatically deploy when you push to main.

**Method 2: Using Service Principal (Advanced)**

1. **Create Service Principal:**
   ```bash
   az ad sp create-for-rbac --name "microlearn-backend-sp" --role contributor \
     --scopes /subscriptions/{subscription-id}/resourceGroups/{resource-group} \
     --sdk-auth
   ```

2. **Add Azure Credentials Secret:**
   - Copy the entire JSON output from the above command
   - Go to GitHub repository → Settings → Secrets and Variables → Actions
   - Create secret named `AZURE_CREDENTIALS`
   - Paste the JSON as the value

3. **Use the Service Principal workflow:** Rename `azure-deploy-sp.yml` to `main_microlearn-backend.yml` to use this method.

4. **Configure Environment Variables in Azure:**
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

## Troubleshooting Common Azure Deployment Issues:

### 1. **Application Error / 500 Internal Server Error:**
- Check Azure App Service logs: `Diagnose and solve problems` → `Application Logs`
- Verify all environment variables are set correctly
- Ensure Node.js version matches (18.x)

### 2. **Module Not Found Errors:**
- Ensure `package.json` includes all dependencies
- Check if `npm ci` completed successfully in deployment logs
- Verify Node.js version compatibility

### 3. **Database Connection Issues:**
- Verify `SUPABASE_URL` and `SUPABASE_KEY` environment variables
- Check if `SUPABASE_SERVICE_KEY` is set for backend operations
- Test database connectivity from Azure

### 4. **OpenAI API Issues:**
- Confirm `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_KEY` are correct
- Ensure Azure OpenAI resource is properly configured
- Check API quotas and limits

### 5. **WhatsApp/WATI Integration:**
- Verify `WATI_API_TOKEN` and `WATI_API_URL` are set
- Update webhook URL in WATI dashboard to your Azure app URL
- Test webhook endpoint: `https://your-app.azurewebsites.net/wati-webhook`

### 6. **GitHub Actions Authentication Errors:**
```
Error: No credentials found. Add an Azure login action before this action.
```
**Solutions:**
- **For Publish Profile method:** Ensure `AZURE_WEBAPP_PUBLISH_PROFILE` secret is correctly set
- **For Service Principal method:** Ensure `AZURE_CREDENTIALS` secret contains valid JSON
- **Check secret name:** Make sure the secret name matches exactly what's in the workflow
- **Verify workflow file:** Use the correct workflow file for your authentication method

### 7. **Deployment Logs Show Build Errors:**
```bash
# Common fixes in GitHub Actions:
- Ensure publish profile is correctly added as secret
- Check app name matches Azure App Service name
- Verify resource group and subscription are correct
```

### 7. **App Service Won't Start:**
- Check startup command is set to `node server.js`
- Verify PORT environment variable (should auto-detect)
- Check if process is binding to correct port (`process.env.PORT`)

## Testing Your Deployment:

1. **Health Check:** Visit `https://your-app.azurewebsites.net/health`
2. **API Test:** POST to `https://your-app.azurewebsites.net/generate-course`
3. **Webhook Test:** Send test message through WATI

## Emergency Rollback:
If deployment fails, you can quickly rollback:
1. Go to Azure Portal → Your App Service
2. Deployment Center → Deployment History
3. Click "Redeploy" on the last working version
