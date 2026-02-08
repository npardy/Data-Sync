package com.pardysurveys.datasync;

import com.pardysurveys.datasync.BuildConfig;
import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ApplicationInfo;
import android.content.pm.ResolveInfo;
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
import android.widget.ProgressBar;
import android.widget.LinearLayout;
import android.widget.TextView;
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
import java.util.concurrent.TimeUnit;

public class MainActivity extends Activity {
    private static final String TAG = "TrimbleSync";
    private WebView webView;
    private ValueCallback<Uri[]> uploadMessage;
    private FileDownloadManager downloadManager;
    private AlertDialog progressDialog;
    private static final int FILE_CHOOSER_RESULT_CODE = 1;
    private static final int PERMISSION_REQUEST_CODE = 2;
    private static final int MANAGE_STORAGE_REQUEST_CODE = 3;

    // Trimble paths - using proper method instead of hardcoded path
    private static final String TRIMBLE_DATA_FOLDER = "Trimble Data/Projects/";
    private static final String PORTAL_URL = "https://pardysurveys.synology.me/";

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
        
        // Initialize download manager
        downloadManager = new FileDownloadManager(this, webView);

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
        
        // Add JavaScript callbacks for download progress
        webView.evaluateJavascript(
            "window.TrimbleSyncCallback = {" +
            "  onDownloadProgress: function(current, total, fileName) {" +
            "    console.log('Downloading ' + current + '/' + total + ': ' + fileName);" +
            "    if (window.onDownloadProgress) window.onDownloadProgress(current, total, fileName);" +
            "  }," +
            "  onDownloadComplete: function(jobPath, fileCount) {" +
            "    console.log('Download complete: ' + jobPath + ' (' + fileCount + ' files)');" +
            "    if (window.onDownloadComplete) window.onDownloadComplete(jobPath, fileCount);" +
            "    if (window.TrimbleSync && window.TrimbleSync.listTrimbleJobs) {" +
            "      window.TrimbleSync.listTrimbleJobs();" +
            "    }" +
            "  }," +
            "  onDownloadError: function(error) {" +
            "    console.error('Download error: ' + error);" +
            "    alert('Download failed: ' + error);" +
            "  }" +
            "};", null
        );

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
        public void syncJobToTrimble(String jobPath) {
            Log.d(TAG, "Syncing job to Trimble: " + jobPath);
            
            // Use the current portal URL
            String serverUrl = PORTAL_URL;
            
            // Start download
            runOnUiThread(() -> {
                Toast.makeText(MainActivity.this, "Starting download...", Toast.LENGTH_SHORT).show();
            });
            
            downloadManager.downloadJob(serverUrl, jobPath);
        }

        // Pre-flight health check
        private boolean checkServerHealth() {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(PORTAL_URL + "healthz");
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                // Be tolerant: some links are slow; 10s is safer than 3s
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                // If any proxy adds redirects, follow them
                connection.setInstanceFollowRedirects(true);
                HttpURLConnection.setFollowRedirects(true);

                int code = connection.getResponseCode();
                // healthz should return 200. Treat 3xx as reachable too, just in case.
                return (code == HttpURLConnection.HTTP_OK)
                       || (code == HttpURLConnection.HTTP_MOVED_PERM)
                       || (code == HttpURLConnection.HTTP_MOVED_TEMP)
                       || (code == 307) || (code == 308);
            } catch (Exception e) {
                Log.w(TAG, "Pre-flight health check failed: " + e.getClass().getSimpleName() + ": " + e.getMessage());
                return false;
            } finally {
                if (connection != null) connection.disconnect();
            }
        }

        @JavascriptInterface
        @SuppressWarnings("unused") // Used by JavaScript
        public void uploadFieldData(String jobPath) {
            // Run file upload on background thread
            new Thread(() -> {
                try {
                    // Optional pre-flight; don't abort if it fails
                    if (!checkServerHealth()) {
                        Log.w(TAG, "Health check failed; attempting upload anyway");
                        // do not return here
                    }

                    // Show progress indicator
                    showProgress("Uploading…");

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
                        hideProgress();
                        showToast("Job file not found: " + jobFileName);
                        return;
                    }

                    // Parse job file to get exported and linked files
                    JobInfo jobInfo = parseJobFile(jobFile);
                    if (jobInfo == null) {
                        hideProgress();
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
                        hideProgress();
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
                    hideProgress();
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

            int maxRetries = 3;
            int attempt = 0;

            while (attempt < maxRetries) {
                try {
                    attempt++;
                    URL url = new URL(PORTAL_URL + "api/upload-field-data-android");
                    connection = (HttpURLConnection) url.openConnection();

                    // Set up the connection with extended timeouts
                    connection.setDoInput(true);
                    connection.setDoOutput(true);
                    connection.setUseCaches(false);
                    connection.setRequestMethod("POST");
                    // Stream request body in chunks (prevents large in-memory buffering)
                    connection.setChunkedStreamingMode(16 * 1024); // 16KB chunks
                    connection.setConnectTimeout(60000); // 60 seconds
                    connection.setReadTimeout(600000);   // 600 seconds (10 minutes)
                    connection.setRequestProperty("Connection", "Keep-Alive");
                    connection.setRequestProperty("Content-Type", "multipart/form-data;boundary=" + boundary);
                    connection.setRequestProperty("X-Client-Version", BuildConfig.VERSION_NAME);
                    connection.setRequestProperty("User-Agent", "TrimbleSync/" + BuildConfig.VERSION_NAME);

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

                        hideProgress();
                        showToast("Upload complete! " + filesUploaded + " files uploaded to " + fieldDataPath);

                        // Refresh the job list
                        runOnUiThread(() -> {
                            webView.evaluateJavascript("if (window.loadFolders) window.loadFolders();", null);
                        });
                        break; // Success - exit retry loop
                    } else {
                        hideProgress();
                        showToast("Upload failed: " + jsonResponse.optString("error", "Unknown error"));
                        break; // Server error - don't retry
                    }
                } else {
                    hideProgress();
                    showToast("Upload failed with code: " + responseCode);
                    break; // HTTP error - don't retry
                }

                } catch (Exception e) {
                    Log.e(TAG, "Upload error (attempt " + attempt + "/" + maxRetries + ")", e);
                    if (attempt >= maxRetries) {
                        hideProgress();
                        showToast("Upload error after " + maxRetries + " attempts: " + e.getMessage());
                    } else {
                        Log.d(TAG, "Retrying upload...");
                        final int retryAttempt = attempt;
                        runOnUiThread(() -> Toast.makeText(MainActivity.this, "Retrying upload… (" + retryAttempt + ")", Toast.LENGTH_SHORT).show());
                        try {
                            Thread.sleep(1000 * attempt); // Exponential backoff
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                        }
                    }
                } finally {
                    if (connection != null) {
                        connection.disconnect();
                    }
                }
            }
        }

        private void showToast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }

        private void showProgress(final String message) {
            runOnUiThread(() -> {
                if (progressDialog != null && progressDialog.isShowing()) return;
                ProgressBar pb = new ProgressBar(MainActivity.this, null, android.R.attr.progressBarStyleLarge);
                LinearLayout container = new LinearLayout(MainActivity.this);
                container.setOrientation(LinearLayout.VERTICAL);
                int pad = (int)(16 * getResources().getDisplayMetrics().density);
                container.setPadding(pad, pad, pad, pad);
                TextView tv = new TextView(MainActivity.this);
                tv.setText(message);
                tv.setPadding(0, pad, 0, 0);
                container.addView(pb);
                container.addView(tv);

                progressDialog = new AlertDialog.Builder(MainActivity.this)
                        .setView(container)
                        .setCancelable(false)
                        .create();
                progressDialog.show();
            });
        }

        private void hideProgress() {
            runOnUiThread(() -> {
                if (progressDialog != null) {
                    progressDialog.dismiss();
                    progressDialog = null;
                }
            });
        }

        @JavascriptInterface
        @SuppressWarnings("unused") // Used by JavaScript
        public void debugTrimbleInfo() {
            try {
                // List all installed packages that might be Trimble
                PackageManager pm = getPackageManager();
                List<ApplicationInfo> packages = pm.getInstalledApplications(PackageManager.GET_META_DATA);
                
                StringBuilder trimbleApps = new StringBuilder("Apps that might handle .job files:\n\n");
                
                // First, look for any Trimble/Survey/Field apps
                for (ApplicationInfo packageInfo : packages) {
                    String packageName = packageInfo.packageName.toLowerCase();
                    String appName = "";
                    try {
                        appName = (String) pm.getApplicationLabel(packageInfo);
                    } catch (Exception e) {
                        appName = "Unknown";
                    }
                    
                    // Broader search terms
                    if (packageName.contains("trimble") || 
                        packageName.contains("tsc") ||
                        packageName.contains("survey") ||
                        packageName.contains("field") ||
                        packageName.contains("access") ||
                        appName.toLowerCase().contains("trimble") ||
                        appName.toLowerCase().contains("access") ||
                        appName.toLowerCase().contains("survey")) {
                        
                        trimbleApps.append("Package: ").append(packageInfo.packageName).append("\n");
                        trimbleApps.append("  Name: ").append(appName).append("\n\n");
                    }
                }
                
                // Also check what apps can handle .job files
                trimbleApps.append("\n--- Apps that can open .job files ---\n");
                Intent testIntent = new Intent(Intent.ACTION_VIEW);
                testIntent.setType("*/*");
                
                List<ResolveInfo> resolveInfos = pm.queryIntentActivities(testIntent, 0);
                for (ResolveInfo info : resolveInfos) {
                    String pkgName = info.activityInfo.packageName;
                    String appLabel = info.loadLabel(pm).toString();
                    
                    // Show file managers and potential handlers
                    if (!pkgName.contains("android") && !pkgName.contains("google")) {
                        trimbleApps.append("  ").append(pkgName).append(" (").append(appLabel).append(")\n");
                    }
                }
                
                Log.d(TAG, trimbleApps.toString());
                
                final String message = trimbleApps.toString();
                runOnUiThread(() -> {
                    new AlertDialog.Builder(MainActivity.this)
                        .setTitle("App Analysis")
                        .setMessage(message)
                        .setPositiveButton("OK", null)
                        .show();
                });
                
            } catch (Exception e) {
                Log.e(TAG, "Error getting Trimble info", e);
            }
        }

        @JavascriptInterface
        @SuppressWarnings("unused") // Used by JavaScript
        public void launchTrimbleAccess(String jobPath) {
            try {
                // Show job location in a helpful dialog
                final String trimblePath = "Trimble Data/Projects/" + jobPath;
                
                runOnUiThread(() -> {
                    new AlertDialog.Builder(MainActivity.this)
                        .setTitle("Open in Trimble Access")
                        .setMessage("To open this job:\n\n" +
                                   "1. Open Trimble Access\n" +
                                   "2. Navigate to Jobs\n" + 
                                   "3. Look for:\n   " + jobPath + "\n\n" +
                                   "The job is located at:\n" + trimblePath)
                        .setPositiveButton("Copy Job Name", (dialog, which) -> {
                            // Extract just the job name (last part of path)
                            String[] parts = jobPath.split("/");
                            String jobName = parts[parts.length - 1];
                            
                            // Copy to clipboard
                            android.content.ClipboardManager clipboard = (android.content.ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                            android.content.ClipData clip = android.content.ClipData.newPlainText("Job Name", jobName);
                            clipboard.setPrimaryClip(clip);
                            Toast.makeText(MainActivity.this, "Job name copied: " + jobName, Toast.LENGTH_SHORT).show();
                        })
                        .setNeutralButton("Copy Full Path", (dialog, which) -> {
                            // Copy full path to clipboard
                            android.content.ClipboardManager clipboard = (android.content.ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                            android.content.ClipData clip = android.content.ClipData.newPlainText("Job Path", trimblePath);
                            clipboard.setPrimaryClip(clip);
                            Toast.makeText(MainActivity.this, "Path copied to clipboard", Toast.LENGTH_SHORT).show();
                        })
                        .setNegativeButton("OK", null)
                        .show();
                });
                
            } catch (Exception e) {
                Log.e(TAG, "Error showing job info", e);
                runOnUiThread(() ->
                        Toast.makeText(MainActivity.this, "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show()
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