package com.pardysurveys.datasync;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.documentfile.provider.DocumentFile;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.DataOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;
import android.util.Log;
import android.provider.Settings;
import android.app.AlertDialog;

public class MainActivity extends Activity {
    private static final String TAG = "TrimbleSync";
    private WebView webView;
    private ValueCallback<Uri[]> uploadMessage;
    private static final int FILE_CHOOSER_RESULT_CODE = 1;
    private static final int PERMISSION_REQUEST_CODE = 2;
    private static final int MANAGE_STORAGE_REQUEST_CODE = 3;
    
    // Trimble paths - using proper method instead of hardcoded path
    private static final String TRIMBLE_DATA_FOLDER = "Trimble Data/Projects/";
    private static final String PORTAL_URL = "http://pardysurveys.direct.quickconnect.to:3000/";
    
    // Trimble Access package name (update this when you find the actual package)
    private static final String TRIMBLE_ACCESS_PACKAGE = "com.trimble.access";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Request permissions
        checkPermissions();
        
        // Setup WebView
        webView = new WebView(this);
        setContentView(webView);
        
        setupWebView();
        
        // Always load the portal
        webView.loadUrl(PORTAL_URL);
    }
    
    private void checkPermissions() {
        String[] permissions = {
            Manifest.permission.INTERNET,
            Manifest.permission.ACCESS_NETWORK_STATE,
            Manifest.permission.READ_EXTERNAL_STORAGE,
            Manifest.permission.WRITE_EXTERNAL_STORAGE
        };
        
        List<String> permissionsToRequest = new ArrayList<>();
        
        for (String permission : permissions) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(permission);
            }
        }
        
        if (!permissionsToRequest.isEmpty()) {
            ActivityCompat.requestPermissions(this, 
                permissionsToRequest.toArray(new String[0]), 
                PERMISSION_REQUEST_CODE);
        }
    }
    
    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true); // Required for the portal to work
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        
        // Add viewport settings for better mobile experience
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(true);
        
        // Enable smooth scrolling
        webView.setScrollBarStyle(WebView.SCROLLBARS_INSIDE_OVERLAY);
        webView.setVerticalScrollBarEnabled(true);
        
        // Enable debugging for development
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        
        // Add JavaScript interface for file system access
        webView.addJavascriptInterface(new TrimbleFileInterface(), "TrimbleSync");
        
        // Handle file uploads
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (uploadMessage != null) {
                    uploadMessage.onReceiveValue(null);
                }
                uploadMessage = filePathCallback;
                
                Intent intent = fileChooserParams.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_RESULT_CODE);
                } catch (Exception e) {
                    uploadMessage = null;
                    Toast.makeText(MainActivity.this, "Cannot open file chooser", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });
        
        // Keep in app
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });
    }
    
    // JavaScript interface for Trimble file operations
    public class TrimbleFileInterface {
        
        @JavascriptInterface
        @SuppressWarnings("unused") // Used by JavaScript
        public String listTrimbleJobs() {
            try {
                Log.d(TAG, "========== STARTING JOB SCAN ==========");
                Log.d(TAG, "Android version: " + Build.VERSION.SDK_INT);
                
                // For Android 11+, check if we have all files access
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    if (!Environment.isExternalStorageManager()) {
                        Log.d(TAG, "No MANAGE_EXTERNAL_STORAGE permission");
                        // Return a special response to trigger permission request
                        JSONObject response = new JSONObject();
                        response.put("needsStorageAccess", true);
                        response.put("permissionType", "all_files");
                        return response.toString();
                    }
                }
                
                // We have permission, use fast direct access
                return listTrimbleJobsDirect();
                
            } catch (Exception e) {
                Log.e(TAG, "Error listing jobs", e);
                e.printStackTrace();
                return "{}";
            }
        }
        
        // List jobs using direct file access (FAST!)
        private String listTrimbleJobsDirect() {
            try {
                File externalStorage = Environment.getExternalStorageDirectory();
                File trimbleDir = new File(externalStorage, TRIMBLE_DATA_FOLDER);
                
                Log.d(TAG, "Looking for Trimble jobs in: " + trimbleDir.getAbsolutePath());
                
                if (!trimbleDir.exists()) {
                    Log.d(TAG, "Trimble directory does not exist");
                    return "{}";
                }
                
                // Build tree structure with job-aware parsing
                JSONObject tree = buildFolderTree(trimbleDir, "");
                
                String result = tree.toString();
                Log.d(TAG, "========== FINAL TREE STRUCTURE ==========");
                Log.d(TAG, result);
                Log.d(TAG, "========== END JOB SCAN ==========");
                
                return result;
            } catch (Exception e) {
                Log.e(TAG, "Error in direct file listing", e);
                return "{}";
            }
        }
        
        // Build folder tree using direct file access
        private JSONObject buildFolderTree(File directory, String indent) {
            JSONObject tree = new JSONObject();
            
            try {
                Log.d(TAG, indent + "Scanning directory: " + directory.getName());
                
                File[] files = directory.listFiles();
                if (files != null) {
                    Log.d(TAG, indent + "Found " + files.length + " items");
                    
                    // Process all files
                    processFolderContents(directory, files, tree, indent);
                    
                } else {
                    Log.d(TAG, indent + "listFiles() returned null - permission issue?");
                }
            } catch (Exception e) {
                Log.e(TAG, indent + "Error building folder tree", e);
                e.printStackTrace();
            }
            
            return tree;
        }
        
        // Process folder contents for direct file access
        private void processFolderContents(File directory, File[] files, JSONObject tree, String indent) throws Exception {
            // First pass - find all .job files in this directory
            List<JobInfo> jobs = new ArrayList<>();
            for (File file : files) {
                if (file.isFile() && (file.getName().endsWith(".job") || file.getName().endsWith(".JOB"))) {
                    Log.d(TAG, indent + ">>> Found .job file: " + file.getName());
                    JobInfo job = parseJobFile(file);
                    if (job != null) {
                        jobs.add(job);
                    }
                }
            }
            
            // If we found job files, create job entries
            if (!jobs.isEmpty()) {
                Log.d(TAG, indent + "Creating entries for " + jobs.size() + " job files");
                for (JobInfo job : jobs) {
                    createJobEntry(tree, job, directory, indent);
                }
            }
            
            // Second pass - add directories and non-job files
            for (File file : files) {
                if (file.isDirectory()) {
                    processDirectory(file, jobs, tree, indent);
                } else if (!file.getName().endsWith(".job") && !file.getName().endsWith(".JOB")) {
                    processFile(file, tree);
                }
            }
        }
        
        // Create job entry for direct file access
        private void createJobEntry(JSONObject tree, JobInfo job, File directory, String indent) throws Exception {
            JSONObject jobItem = new JSONObject();
            jobItem.put("type", "trimbleJob");
            jobItem.put("jobFile", job.fileName);
            jobItem.put("jobName", job.jobName);
            jobItem.put("address", job.address);
            
            // Create arrays for different file types
            JSONArray linkedFiles = new JSONArray();
            for (String file : job.linkedFiles) {
                linkedFiles.put(file);
            }
            jobItem.put("linkedFiles", linkedFiles);
            
            JSONArray exportedFiles = new JSONArray();
            for (String file : job.exportedFiles) {
                exportedFiles.put(file);
            }
            jobItem.put("exportedFiles", exportedFiles);
            
            // Count files
            int photoCount = 0;
            int csvCount = 0;
            int dxfCount = 0;
            
            // Count from exported files list
            for (String exportedFile : job.exportedFiles) {
                if (exportedFile.toLowerCase().endsWith(".csv")) csvCount++;
                else if (exportedFile.toLowerCase().endsWith(".dxf")) dxfCount++;
            }
            
            // Count photos from associated Files folder
            String baseJobName = job.fileName.substring(0, job.fileName.lastIndexOf('.'));
            File photosFolder = new File(directory, baseJobName + " Files");
            if (photosFolder.exists() && photosFolder.isDirectory()) {
                File[] photos = photosFolder.listFiles();
                if (photos != null) {
                    for (File photo : photos) {
                        if (photo.isFile() && isPhotoFile(photo.getName())) {
                            photoCount++;
                        }
                    }
                    Log.d(TAG, indent + "  Found " + photoCount + " photos in " + photosFolder.getName());
                }
            }
            
            jobItem.put("photos", photoCount);
            jobItem.put("csvCount", csvCount);
            jobItem.put("dxfCount", dxfCount);
            jobItem.put("children", new JSONObject()); // Jobs don't have children
            
            Log.d(TAG, indent + "  Job entry: " + job.fileName + " - CSV:" + csvCount + " DXF:" + dxfCount + " Photos:" + photoCount);
            tree.put(job.fileName, jobItem);
        }
        
        // Process directory for direct file access
        private void processDirectory(File file, List<JobInfo> jobs, JSONObject tree, String indent) throws Exception {
            String name = file.getName();
            
            // Skip photo folders that belong to jobs we already processed
            boolean isJobPhotoFolder = false;
            for (JobInfo job : jobs) {
                String baseJobName = job.fileName.substring(0, job.fileName.lastIndexOf('.'));
                if (name.equals(baseJobName + " Files")) {
                    isJobPhotoFolder = true;
                    Log.d(TAG, indent + "Skipping photo folder: " + name);
                    break;
                }
            }
            
            if (!isJobPhotoFolder) {
                JSONObject item = new JSONObject();
                
                // Determine folder type based on pattern for styling
                String folderType = "folder";
                if (name.matches("\\d{2}-\\d{3}-\\d{3}")) {
                    folderType = "mainFolder";
                } else if (name.matches("\\d{2}-\\d{3}")) {
                    folderType = "jobNumber";
                }
                
                Log.d(TAG, indent + "Adding " + folderType + ": " + name);
                item.put("type", folderType);
                
                // Recurse into subdirectories
                JSONObject children = buildFolderTree(file, indent + "  ");
                item.put("children", children);
                
                tree.put(name, item);
            }
        }
        
        // Process file for direct access
        private void processFile(File file, JSONObject tree) throws Exception {
            JSONObject item = new JSONObject();
            item.put("type", "file");
            item.put("size", formatFileSize(file.length()));
            
            String fileName = file.getName().toLowerCase();
            item.put("core", fileName.contains("control") || fileName.contains("layout"));
            item.put("photo", isPhotoFile(fileName));
            item.put("csv", fileName.endsWith(".csv"));
            item.put("dxf", fileName.endsWith(".dxf"));
            
            tree.put(file.getName(), item);
        }
        
        // Parse binary .job file to extract job information
        private JobInfo parseJobFile(File jobFile) {
            Log.d(TAG, "  === PARSING JOB FILE: " + jobFile.getName() + " ===");
            JobInfo info = new JobInfo();
            info.fileName = jobFile.getName();
            info.jobName = jobFile.getName().substring(0, jobFile.getName().lastIndexOf('.'));
            
            try {
                // Read binary file and look for text patterns
                FileInputStream fis = new FileInputStream(jobFile);
                byte[] data = new byte[(int) jobFile.length()];
                fis.read(data);
                fis.close();
                
                Log.d(TAG, "  File size: " + data.length + " bytes");
                
                // Convert to string to search for patterns (ISO-8859-1 preserves binary data)
                String content = new String(data, StandardCharsets.ISO_8859_1);
                
                // Look for exported files pattern: "Exported file: /path/to/file"
                Pattern exportPattern = Pattern.compile("Exported file: ([^\\x00]+?)(?=\\x00|Exported|$)");
                Matcher exportMatcher = exportPattern.matcher(content);
                while (exportMatcher.find()) {
                    String filePath = exportMatcher.group(1).trim();
                    String fileName = new File(filePath).getName();
                    if (!fileName.isEmpty() && !info.exportedFiles.contains(fileName)) {
                        info.exportedFiles.add(fileName);
                        Log.d(TAG, "  Found exported file: " + fileName);
                    }
                }
                
                // Look for linked files (layout files)
                Pattern linkedPattern = Pattern.compile("([^/\\x00]+(?:layout|Layout)[^/\\x00]*\\.(?:csv|dxf|CSV|DXF))");
                Matcher linkedMatcher = linkedPattern.matcher(content);
                while (linkedMatcher.find()) {
                    String fileName = linkedMatcher.group(1).trim();
                    if (!fileName.isEmpty() && !info.linkedFiles.contains(fileName)) {
                        info.linkedFiles.add(fileName);
                        Log.d(TAG, "  Found linked file: " + fileName);
                    }
                }
                
                // Also look for simple file references in paths
                Pattern pathPattern = Pattern.compile("/storage/[^\\x00]+/([^/\\x00]+\\.(?:csv|dxf|CSV|DXF))");
                Matcher pathMatcher = pathPattern.matcher(content);
                while (pathMatcher.find()) {
                    String fileName = pathMatcher.group(1).trim();
                    // If it contains "layout" and isn't already in linked files, add it
                    if (fileName.toLowerCase().contains("layout") && !info.linkedFiles.contains(fileName)) {
                        info.linkedFiles.add(fileName);
                        Log.d(TAG, "  Found linked layout file: " + fileName);
                    }
                }
                
                Log.d(TAG, "  === PARSING COMPLETE ===");
                Log.d(TAG, "  Summary - Exported: " + info.exportedFiles.size() + ", Linked: " + info.linkedFiles.size());
                
                return info;
            } catch (Exception e) {
                Log.e(TAG, "  ERROR parsing job file: " + jobFile.getName(), e);
                return info; // Return partial info
            }
        }
        
        // Helper class to hold job information
        private class JobInfo {
            String fileName;
            String jobName;
            String address = "";
            Set<String> linkedFiles = new HashSet<>();  // Layout files
            Set<String> exportedFiles = new HashSet<>(); // Exported CSV/DXF files
        }
        
        // Check if file is a photo
        private boolean isPhotoFile(String fileName) {
            if (fileName == null) return false;
            String lower = fileName.toLowerCase();
            return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png");
        }
        
        // Format file size to human readable
        private String formatFileSize(long bytes) {
            String[] sizes = {"B", "KB", "MB", "GB"};
            if (bytes == 0) return "0 B";
            int i = (int) Math.floor(Math.log(bytes) / Math.log(1024));
            return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
        }
        
        @JavascriptInterface
        @SuppressWarnings("unused")
        public void requestStorageAccess() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    new AlertDialog.Builder(MainActivity.this)
                        .setTitle("All Files Access Required")
                        .setMessage("This app needs access to all files to read Trimble job files.\n\n" +
                                   "On the next screen, please enable 'Allow access to manage all files' for this app.")
                        .setPositiveButton("Open Settings", (dialog, which) -> {
                            try {
                                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                                Uri uri = Uri.fromParts("package", getPackageName(), null);
                                intent.setData(uri);
                                startActivityForResult(intent, MANAGE_STORAGE_REQUEST_CODE);
                            } catch (Exception e) {
                                // Fallback to general manage storage settings
                                Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                                startActivityForResult(intent, MANAGE_STORAGE_REQUEST_CODE);
                            }
                        })
                        .setNegativeButton("Cancel", (dialog, which) -> {
                            Toast.makeText(MainActivity.this, "Cannot access job files without permission", Toast.LENGTH_LONG).show();
                        })
                        .setCancelable(false)
                        .show();
                } else {
                    Toast.makeText(MainActivity.this, "Permission not needed for this Android version", Toast.LENGTH_SHORT).show();
                }
            });
        }
        
        @JavascriptInterface
        @SuppressWarnings("unused")
        public boolean hasStorageAccess() {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                return Environment.isExternalStorageManager();
            }
            // For older Android, we have direct access
            return true;
        }
        
        @JavascriptInterface
        @SuppressWarnings("unused") // Used by JavaScript
        public boolean syncJobToTrimble(String jobName, String filesJson) {
            try {
                File externalStorage = Environment.getExternalStorageDirectory();
                File trimbleDir = new File(externalStorage, TRIMBLE_DATA_FOLDER);
                File jobDir = new File(trimbleDir, jobName);
                
                if (!jobDir.exists()) {
                    boolean created = jobDir.mkdirs();
                    if (!created) {
                        return false;
                    }
                }
                
                // Parse filesJson and sync files here
                // This is where you would implement the actual file sync logic
                // For now, just returning true as placeholder
                
                return true;
            } catch (Exception e) {
                e.printStackTrace();
                return false;
            }
        }
        
        @JavascriptInterface
        @SuppressWarnings("unused") // Used by JavaScript
        public void uploadFieldData(String jobPath) {
            // Run file upload on background thread
            new Thread(() -> {
                try {
                    File externalStorage = Environment.getExternalStorageDirectory();
                    File trimbleDir = new File(externalStorage, TRIMBLE_DATA_FOLDER);
                    
                    // Parse the job path to find the actual job file
                    String[] pathParts = jobPath.split("/");
                    File currentDir = trimbleDir;
                    
                    // Navigate to the parent directory
                    for (int i = 0; i < pathParts.length - 1; i++) {
                        currentDir = new File(currentDir, pathParts[i]);
                    }
                    
                    // Get the job file name (last part)
                    String jobFileName = pathParts[pathParts.length - 1];
                    File jobFile = new File(currentDir, jobFileName);
                    
                    if (!jobFile.exists()) {
                        showToast("Job file not found: " + jobFileName);
                        return;
                    }
                    
                    // Parse job file to get exported and linked files
                    JobInfo jobInfo = parseJobFile(jobFile);
                    if (jobInfo == null) {
                        showToast("Could not parse job file");
                        return;
                    }
                    
                    // Collect all files associated with this job
                    List<File> allFiles = new ArrayList<>();
                    
                    // Add the job file itself
                    allFiles.add(jobFile);
                    
                    // Add all exported files (these are the main outputs)
                    for (String exportedFile : jobInfo.exportedFiles) {
                        File file = new File(currentDir, exportedFile);
                        if (file.exists()) {
                            allFiles.add(file);
                            Log.d(TAG, "Adding exported file: " + exportedFile);
                        } else {
                            Log.w(TAG, "Exported file not found: " + exportedFile);
                        }
                    }
                    
                    // Add linked files (layout files) if they exist
                    for (String linkedFile : jobInfo.linkedFiles) {
                        File file = new File(currentDir, linkedFile);
                        if (file.exists()) {
                            allFiles.add(file);
                            Log.d(TAG, "Adding linked file: " + linkedFile);
                        } else {
                            Log.w(TAG, "Linked file not found: " + linkedFile);
                        }
                    }
                    
                    // Add photos from companion Files folder
                    String baseJobName = jobFileName.substring(0, jobFileName.lastIndexOf('.'));
                    File photosFolder = new File(currentDir, baseJobName + " Files");
                    if (photosFolder.exists() && photosFolder.isDirectory()) {
                        File[] photos = photosFolder.listFiles();
                        if (photos != null) {
                            for (File photo : photos) {
                                if (photo.isFile()) {
                                    allFiles.add(photo);
                                }
                            }
                            Log.d(TAG, "Added " + photos.length + " photos from Files folder");
                        }
                    }
                    
                    if (allFiles.isEmpty()) {
                        showToast("No files to upload for " + jobFileName);
                        return;
                    }
                    
                    // Create final variables for upload
                    final int fileCount = allFiles.size();
                    final String jobName = jobInfo.jobName;
                    
                    // Show progress
                    runOnUiThread(() -> showToast("Uploading " + fileCount + " files for job " + jobName));
                    
                    // Perform the actual upload
                    uploadFilesToServer(jobPath, allFiles);
                    
                } catch (Exception e) {
                    showToast("Error: " + e.getMessage());
                    e.printStackTrace();
                }
            }).start();
        }
        
        // Upload files to server using multipart form data
        private void uploadFilesToServer(String jobPath, List<File> files) {
            HttpURLConnection connection = null;
            DataOutputStream outputStream = null;
            
            String lineEnd = "\r\n";
            String twoHyphens = "--";
            String boundary = "*****" + System.currentTimeMillis() + "*****";
            
            try {
                URL url = new URL(PORTAL_URL + "api/upload-field-data");
                connection = (HttpURLConnection) url.openConnection();
                
                // Set up the connection
                connection.setDoInput(true);
                connection.setDoOutput(true);
                connection.setUseCaches(false);
                connection.setRequestMethod("POST");
                connection.setRequestProperty("Connection", "Keep-Alive");
                connection.setRequestProperty("Content-Type", "multipart/form-data;boundary=" + boundary);
                
                outputStream = new DataOutputStream(connection.getOutputStream());
                
                // Add job path parameter
                outputStream.writeBytes(twoHyphens + boundary + lineEnd);
                outputStream.writeBytes("Content-Disposition: form-data; name=\"jobPath\"" + lineEnd);
                outputStream.writeBytes(lineEnd);
                outputStream.writeBytes(jobPath);
                outputStream.writeBytes(lineEnd);
                
                // Upload each file
                int uploadedCount = 0;
                for (File file : files) {
                    outputStream.writeBytes(twoHyphens + boundary + lineEnd);
                    outputStream.writeBytes("Content-Disposition: form-data; name=\"files\"; filename=\"" + file.getName() + "\"" + lineEnd);
                    outputStream.writeBytes("Content-Type: application/octet-stream" + lineEnd);
                    outputStream.writeBytes(lineEnd);
                    
                    // Read file and write to output stream
                    FileInputStream fileInputStream = new FileInputStream(file);
                    byte[] buffer = new byte[4096];
                    int bytesRead;
                    
                    while ((bytesRead = fileInputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, bytesRead);
                    }
                    fileInputStream.close();
                    
                    outputStream.writeBytes(lineEnd);
                    
                    uploadedCount++;
                    final int progress = uploadedCount;
                    final int total = files.size();
                    
                    // Update progress
                    runOnUiThread(() -> {
                        String progressMsg = "Uploading: " + progress + "/" + total + " files";
                        Log.d(TAG, progressMsg);
                        // Could update a progress bar here if we had one
                    });
                }
                
                // End of multipart/form-data
                outputStream.writeBytes(twoHyphens + boundary + twoHyphens + lineEnd);
                outputStream.flush();
                outputStream.close();
                
                // Get response
                int responseCode = connection.getResponseCode();
                Log.d(TAG, "Upload response code: " + responseCode);
                
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    // Read response
                    BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                    reader.close();
                    
                    Log.d(TAG, "Upload response: " + response.toString());
                    
                    // Parse response
                    JSONObject jsonResponse = new JSONObject(response.toString());
                    if (jsonResponse.optBoolean("success")) {
                        String fieldDataPath = jsonResponse.optString("fieldDataPath", "");
                        int filesUploaded = jsonResponse.optInt("filesUploaded", 0);
                        
                        showToast("Upload complete! " + filesUploaded + " files uploaded to " + fieldDataPath);
                        
                        // Refresh the job list
                        runOnUiThread(() -> {
                            webView.evaluateJavascript("if (window.loadFolders) window.loadFolders();", null);
                        });
                    } else {
                        showToast("Upload failed: " + jsonResponse.optString("error", "Unknown error"));
                    }
                } else {
                    showToast("Upload failed with code: " + responseCode);
                }
                
            } catch (Exception e) {
                Log.e(TAG, "Upload error", e);
                showToast("Upload error: " + e.getMessage());
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }
        
        private void showToast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }
        
        @JavascriptInterface
        @SuppressWarnings("unused") // Used by JavaScript
        public void launchTrimbleAccess(String jobPath) {
            try {
                Intent intent = getPackageManager().getLaunchIntentForPackage(TRIMBLE_ACCESS_PACKAGE);
                if (intent != null) {
                    // Add job path as extra if Trimble Access supports it
                    intent.putExtra("job_path", jobPath);
                    startActivity(intent);
                } else {
                    runOnUiThread(() -> 
                        Toast.makeText(MainActivity.this, "Trimble Access not found", Toast.LENGTH_SHORT).show()
                    );
                }
            } catch (Exception e) {
                runOnUiThread(() -> 
                    Toast.makeText(MainActivity.this, "Error launching Trimble Access", Toast.LENGTH_SHORT).show()
                );
            }
        }
    }
    
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == MANAGE_STORAGE_REQUEST_CODE) {
            // Check if permission was granted
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (Environment.isExternalStorageManager()) {
                    Toast.makeText(this, "All files access granted!", Toast.LENGTH_SHORT).show();
                    // Reload the jobs
                    webView.postDelayed(() -> {
                        webView.evaluateJavascript("if (window.loadTSC5Jobs) window.loadTSC5Jobs();", null);
                    }, 500);
                } else {
                    Toast.makeText(this, "Permission denied - cannot access job files", Toast.LENGTH_LONG).show();
                }
            }
        } else if (requestCode == FILE_CHOOSER_RESULT_CODE) {
            if (uploadMessage == null) return;
            uploadMessage.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            uploadMessage = null;
        }
    }
    
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                finish();
            } else {
                super.onBackPressed();
            }
        }
    }
}