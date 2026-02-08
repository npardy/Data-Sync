package com.pardysurveys.datasync;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class FileDownloadManager {
    private static final String TAG = "FileDownloadManager";
    private static final String TRIMBLE_DATA_PATH = "/storage/emulated/0/Trimble Data/Projects/";
    
    private final Context context;
    private final WebView webView;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    
    public FileDownloadManager(Context context, WebView webView) {
        this.context = context;
        this.webView = webView;
    }
    
    public void downloadJob(String serverUrl, String jobPath) {
        executor.execute(() -> {
            try {
                // Remove trailing slash from serverUrl if present
                String baseUrl = serverUrl.endsWith("/") ? serverUrl.substring(0, serverUrl.length() - 1) : serverUrl;
                
                // Check if this is a single file download (has file extension)
                boolean isSingleFile = jobPath.matches(".*\\.[a-zA-Z0-9]+$");
                
                if (isSingleFile) {
                    // Single file download
                    downloadSingleFile(baseUrl, jobPath);
                    return;
                }
                
                // Step 1: Get file list from server for folder download
                String listUrl = baseUrl + "/api/download-job/" + jobPath;
                Log.d(TAG, "Getting file list from: " + listUrl);
                
                URL url = new URL(listUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                
                if (conn.getResponseCode() == 200) {
                    InputStream is = conn.getInputStream();
                    String response = convertStreamToString(is);
                    is.close();
                    
                    JSONObject json = new JSONObject(response);
                    if (json.getBoolean("success")) {
                        JSONArray files = json.getJSONArray("files");
                        // String baseUrl = json.getString("baseUrl"); // Not needed - we use our own baseUrl
                        
                        // Step 2: Create local directory structure
                        String localPath = TRIMBLE_DATA_PATH + jobPath;
                        File localDir = new File(localPath);
                        if (!localDir.exists()) {
                            localDir.mkdirs();
                        }
                        
                        // Step 3: Download each file
                        int totalFiles = files.length();
                        for (int i = 0; i < totalFiles; i++) {
                            JSONObject fileInfo = files.getJSONObject(i);
                            String fileName = fileInfo.getString("name");
                            String filePath = fileInfo.getString("path");
                            
                            // Skip .job file if it already exists
                            File localFile = new File(localPath + "/" + filePath);
                            if (localFile.exists() && fileName.endsWith(".job")) {
                                Log.d(TAG, "Skipping existing .job file: " + fileName);
                                updateProgress(i + 1, totalFiles, fileName + " (skipped)");
                                continue;
                            }
                            
                            // Create subdirectories if needed
                            File parentDir = localFile.getParentFile();
                            if (parentDir != null && !parentDir.exists()) {
                                parentDir.mkdirs();
                            }
                            
                            // Download file
                            String fileUrl = baseUrl + "/api/download-file/" + jobPath + "/" + filePath;
                            downloadFile(fileUrl, localFile);
                            
                            updateProgress(i + 1, totalFiles, fileName);
                        }
                        
                        // Success callback
                        notifySuccess(jobPath, totalFiles);
                        
                    } else {
                        notifyError("Failed to get file list");
                    }
                } else {
                    notifyError("Server returned: " + conn.getResponseCode());
                }
                
                conn.disconnect();
                
            } catch (Exception e) {
                Log.e(TAG, "Download error", e);
                notifyError(e.getMessage());
            }
        });
    }
    
    private void downloadFile(String fileUrl, File localFile) throws Exception {
        Log.d(TAG, "Downloading: " + fileUrl + " to " + localFile.getAbsolutePath());
        
        URL url = new URL(fileUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(30000);
        
        try (InputStream is = conn.getInputStream();
             FileOutputStream fos = new FileOutputStream(localFile)) {
            
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = is.read(buffer)) != -1) {
                fos.write(buffer, 0, bytesRead);
            }
        }
        
        conn.disconnect();
    }
    
    private void downloadSingleFile(String baseUrl, String filePath) {
        try {
            // Determine local path - preserve folder structure
            String localPath = TRIMBLE_DATA_PATH + filePath;
            File localFile = new File(localPath);
            
            // Create parent directories if needed
            File parentDir = localFile.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }
            
            // Download the file
            String fileUrl = baseUrl + "/api/download-file/" + filePath;
            
            updateProgress(1, 1, localFile.getName());
            downloadFile(fileUrl, localFile);
            
            // Notify success
            mainHandler.post(() -> {
                String message = "Downloaded: " + localFile.getName();
                webView.evaluateJavascript(
                    "alert('" + message + "')", null
                );
            });
            
            // Refresh TSC5 jobs list
            notifySuccess(filePath, 1);
            
        } catch (Exception e) {
            Log.e(TAG, "Single file download error", e);
            notifyError(e.getMessage());
        }
    }
    
    private void updateProgress(int current, int total, String fileName) {
        mainHandler.post(() -> {
            String js = String.format(
                "if (window.TrimbleSyncCallback && window.TrimbleSyncCallback.onDownloadProgress) { " +
                "window.TrimbleSyncCallback.onDownloadProgress(%d, %d, '%s'); }",
                current, total, fileName.replace("'", "\\'")
            );
            webView.evaluateJavascript(js, null);
        });
    }
    
    private void notifySuccess(String jobPath, int fileCount) {
        mainHandler.post(() -> {
            String js = String.format(
                "if (window.TrimbleSyncCallback && window.TrimbleSyncCallback.onDownloadComplete) { " +
                "window.TrimbleSyncCallback.onDownloadComplete('%s', %d); }",
                jobPath.replace("'", "\\'"), fileCount
            );
            webView.evaluateJavascript(js, null);
        });
    }
    
    private void notifyError(String error) {
        mainHandler.post(() -> {
            String js = String.format(
                "if (window.TrimbleSyncCallback && window.TrimbleSyncCallback.onDownloadError) { " +
                "window.TrimbleSyncCallback.onDownloadError('%s'); }",
                error.replace("'", "\\'")
            );
            webView.evaluateJavascript(js, null);
        });
    }
    
    private String convertStreamToString(InputStream is) throws Exception {
        StringBuilder sb = new StringBuilder();
        byte[] buffer = new byte[1024];
        int length;
        while ((length = is.read(buffer)) != -1) {
            sb.append(new String(buffer, 0, length));
        }
        return sb.toString();
    }
}