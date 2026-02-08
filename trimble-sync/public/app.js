// Trimble Sync Portal - React Component
const { useState, useEffect } = React;

// Icon component for Lucide icons
const Icon = ({ name, className = "w-4 h-4" }) => {
    const icons = {
        'folder-open': 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
        'chevron-right': 'M9 18l6-6-6-6',
        'chevron-down': 'M6 9l6 6 6-6',
        'file': 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z',
        'upload': 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m14-7l-5-5-5 5m5-5v12',
        'download': 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m7-5l-5 5 5 5m-5-5h12',
        'plus': 'M12 5v14m-7-7h14',
        'map-pin': 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z',
        'calendar': 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z',
        'check': 'M20 6L9 17l-5-5',
        'clock': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 0v10l7 4',
        'refresh-cw': 'M23 4v6h-6M1 20v-6h6',
        'folder-plus': 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2zM12 11v6m-3-3h6',
        'camera': 'M23 19a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h3l2-3h6l2 3h3a3 3 0 0 1 3 3z',
        'trash-2': 'M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-6 5v6m4-6v6',
        'cloud-off': 'M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5l14 14m-9-7v7',
        'cloud-upload': 'M20 16.2A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9m6.88-5v9m-4-4l4 4 4-4',
        'cloud-download': 'M8 17l4 4 4-4m-4-11v15',
        'cloud': 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
        'smartphone': 'M12 2h5a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h5m-2 16h4',
        'database': 'M3 12c0 1.657 3.582 3 8 3s8-1.343 8-3m-16 6c0 1.657 3.582 3 8 3s8-1.343 8-3M3 6c0 1.657 3.582 3 8 3s8-1.343 8-3-3.582-3-8-3-8 1.343-8 3z',
        'briefcase': 'M20 7h-4l-1-3h-6l-1 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z',
        'alert-circle': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6v4m0 4h.01'
    };
    
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={icons[name] || ''} />
        </svg>
    );
};

// Sync status indicator component
const SyncStatus = ({ syncStatus }) => {
    if (!syncStatus) return null;
    
    let icon, color, title;
    switch (syncStatus) {
        case 'synced':
            icon = 'check';
            color = 'text-green-500';
            title = 'Fully synced';
            break;
        case 'office-only':
            icon = 'cloud-download';
            color = 'text-blue-500';
            title = 'Only in office - needs download';
            break;
        case 'controller-only':
            icon = 'cloud-upload';
            color = 'text-orange-500';
            title = 'Only on controller - needs upload';
            break;
        case 'conflict':
            icon = 'refresh-cw';
            color = 'text-red-500';
            title = 'Files differ - needs sync';
            break;
        default:
            return null;
    }
    
    return <Icon name={icon} className={`w-4 h-4 ${color} ml-2`} title={title} />;
};

// Check if running in Android app
const isAndroidApp = typeof window.TrimbleSync !== 'undefined';
console.log('Android app detected:', isAndroidApp);
if (isAndroidApp) {
    console.log('window.TrimbleSync:', window.TrimbleSync);
}

// Logging helper - sends logs to server (fail-safe, never blocks UI)
async function logAction(action, detail = '') {
    try {
        await fetch('/api/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, detail })
        });
    } catch (error) {
        // Fail silently - logging errors should never impact app
        console.error('Logging error (non-critical):', error);
    }
}

// Callback handler for Android responses
window.TrimbleSyncCallback = {
    onFieldDataReady: (callbackData) => {
        console.log('Field data ready for upload:', callbackData);

        // Parse the callback data
        const { jobPath, jobName, files } = callbackData;

        // Create FormData for upload
        const formData = new FormData();
        formData.append('jobPath', jobPath);

        // In a real implementation, we'd need to actually read the files
        // For now, we'll just show what would be uploaded
        alert(`Ready to upload ${files.length} files for job ${jobName}:\n` +
              `- Job file\n` +
              `- Exported CSV/DXF files\n` +
              `- Photos from Files folder`);

        // TODO: Implement actual file upload
        // This would require the Android app to provide file content
        // or a different approach to transfer files
    },
    onDownloadProgress: (current, total, fileName) => {
        console.log(`Download progress: ${current}/${total} - ${fileName}`);
        // You could update a progress indicator here
    },
    onDownloadComplete: (jobPath, fileCount) => {
        console.log(`Download complete: ${jobPath} (${fileCount} files)`);
        alert(`Download complete!\n${fileCount} files downloaded to:\nTrimble Data/Projects/${jobPath}`);
        // Refresh the TSC5 jobs list if the function exists
        if (window.loadTSC5Jobs) {
            window.loadTSC5Jobs();
        }
    },
    onDownloadError: (error) => {
        console.error('Download error:', error);
        alert(`Download failed: ${error}`);
    }
};

// Make loadTSC5Jobs and loadFolders available globally
window.loadTSC5Jobs = null;
window.loadFolders = null;

function TrimbleSyncPortal() {
    const [expandedFolders, setExpandedFolders] = useState(['office', 'controller']);
    const [selectedFolder, setSelectedFolder] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showNewJobDialog, setShowNewJobDialog] = useState(false);
    const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
    const [selectedJob, setSelectedJob] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [lastSync, setLastSync] = useState(new Date().toLocaleTimeString());
    const [loading, setLoading] = useState(true);
    const [folderStructure, setFolderStructure] = useState({ office: {}, controller: {} });
    const [templates, setTemplates] = useState([]);
    const [syncStatus, setSyncStatus] = useState({});
    const [tsc5Jobs, setTsc5Jobs] = useState({});
    const [expandedTSC5Folders, setExpandedTSC5Folders] = useState([]);
    const [needsStorageAccess, setNeedsStorageAccess] = useState(false);
    const [loadingTSC5, setLoadingTSC5] = useState(false);
    
    const [newJobData, setNewJobData] = useState({
        selectedPath: '',
        jobNumber: '',
        date: '',
        address: '',
        jobType: 'survey_rpr',
        customJobType: '',
        template: '',
        referenceNumber: '',
        description: '',
        operator: ''
    });
    
    const [jobFiles, setJobFiles] = useState([]); // Files to be added to the new job
    const [jobDragActive, setJobDragActive] = useState(false);
    
    const [newFolderName, setNewFolderName] = useState('');
    const [activeTab, setActiveTab] = useState('local'); // For mobile tab navigation

    // Field status form state
    const [showFieldStatusForm, setShowFieldStatusForm] = useState(false);
    const [fieldStatusData, setFieldStatusData] = useState({
        jobPath: '',
        jobInfo: null,
        jobType: '',
        customJobType: '',
        operator: 'Allan',
        uploadType: 'complete', // 'intermediate', 'complete', or 'reupload'
        replacesFolder: '',
        timeOnSite: '',
        travelTime: '',
        fieldWorkDone: '',
        estimatedTimeRemaining: '',
        notesWhatLeft: '',
        pinsFound: '',
        pinsPlaced: '',
        constructionTasks: [],
        customTasks: '',
        notes: ''
    });

    // Job type configuration
    const JOB_TYPE_CONFIG = {
        "survey_rpr": {
            label: "Survey & RPR",
            asks_pins_found: true,
            asks_pins_placed: true,
            construction_checklist: false
        },
        "rpr": {
            label: "RPR",
            asks_pins_found: true,
            asks_pins_placed: false,
            construction_checklist: false
        },
        "survey": {
            label: "Survey",
            asks_pins_found: true,
            asks_pins_placed: true,
            construction_checklist: false
        },
        "building_construction": {
            label: "Building Construction",
            asks_pins_found: true,
            asks_pins_placed: false,
            construction_checklist: true
        },
        "topo": {
            label: "Topo",
            asks_pins_found: true,
            asks_pins_placed: false,
            construction_checklist: false
        },
        "subdivision": {
            label: "Subdivision",
            asks_pins_found: true,
            asks_pins_placed: true,
            construction_checklist: false
        },
        "other": {
            label: "Other",
            asks_pins_found: true,
            asks_pins_placed: true,
            construction_checklist: false
        }
    };

    // Helper function to extract job number from path
    const extractJobNumberFromPath = (path) => {
        if (!path) return '';
        // Split the path and get the last part
        const parts = path.split('/');
        const lastPart = parts[parts.length - 1];
        // Check if it matches job number pattern (e.g., 25-123)
        if (/^\d{2}-\d{3}/.test(lastPart)) {
            return lastPart;
        }
        return '';
    };

    // Helper function to format today's date as YYMMDD
    const getTodaysDateYYMMDD = () => {
        const today = new Date();
        const year = today.getFullYear().toString().slice(-2);
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        return year + month + day;
    };

    // Load folder structure and templates on mount
    useEffect(() => {
        loadFolders();
        loadTemplates();
        if (isAndroidApp) {
            // Log that controller opened the app
            logAction('controller-opened');
            // Make functions available globally
            window.loadTSC5Jobs = loadTSC5Jobs;
            window.loadFolders = loadFolders;
            loadTSC5Jobs();
        }
    }, []);

    const loadFolders = async () => {
        try {
            const response = await fetch('/api/folders');
            const data = await response.json();
            setFolderStructure(data);
            
            // Calculate sync status
            const status = calculateSyncStatus(data.office, data.controller);
            setSyncStatus(status);
            
            setLoading(false);
        } catch (error) {
            console.error('Error loading folders:', error);
            setLoading(false);
        }
    };
    
    const loadTSC5Jobs = () => {
        if (window.TrimbleSync && window.TrimbleSync.listTrimbleJobs) {
            setLoadingTSC5(true);
            try {
                console.log('Loading TSC5 jobs...');
                const jobsJson = window.TrimbleSync.listTrimbleJobs();
                const jobs = JSON.parse(jobsJson);
                console.log('TSC5 jobs response:', jobs);
                
                // Check if we need storage access
                if (jobs.needsStorageAccess) {
                    console.log('Storage access needed');
                    setNeedsStorageAccess(true);
                    setTsc5Jobs({});
                } else {
                    setNeedsStorageAccess(false);
                    setTsc5Jobs(jobs);
                }
            } catch (error) {
                console.error('Error loading TSC5 jobs:', error);
                setTsc5Jobs({});
            } finally {
                setLoadingTSC5(false);
            }
        }
    };
    
    const requestStorageAccess = () => {
        if (window.TrimbleSync && window.TrimbleSync.requestStorageAccess) {
            console.log('Requesting storage access...');
            window.TrimbleSync.requestStorageAccess();
        }
    };
    
    const calculateSyncStatus = (officeTree, controllerTree, path = '') => {
        const status = {};
        
        // Check all paths in office
        const checkTree = (tree, currentPath, location) => {
            Object.entries(tree).forEach(([name, item]) => {
                const fullPath = currentPath ? `${currentPath}/${name}` : name;
                
                if (item.type === 'folder' || item.type === 'mainFolder' || item.type === 'jobNumber' || item.type === 'job') {
                    const otherTree = location === 'office' ? controllerTree : officeTree;
                    const otherItem = getItemAtPath(otherTree, fullPath);
                    
                    if (!status[fullPath]) {
                        if (!otherItem) {
                            status[fullPath] = location === 'office' ? 'office-only' : 'controller-only';
                        } else {
                            // Compare contents
                            const hasConflict = compareContents(item, otherItem);
                            status[fullPath] = hasConflict ? 'conflict' : 'synced';
                        }
                    }
                    
                    // Recurse
                    if (item.children) {
                        checkTree(item.children, fullPath, location);
                    }
                }
            });
        };
        
        checkTree(officeTree, '', 'office');
        checkTree(controllerTree, '', 'controller');
        
        return status;
    };
    
    const getItemAtPath = (tree, path) => {
        const parts = path.split('/');
        let current = tree;
        
        for (const part of parts) {
            if (!current[part]) return null;
            current = current[part].children || {};
        }
        
        return current;
    };
    
    const compareContents = (item1, item2) => {
        // Simple comparison - can be enhanced
        const files1 = Object.keys(item1.children || {}).filter(k => item1.children[k].type === 'file').sort();
        const files2 = Object.keys(item2.children || {}).filter(k => item2.children[k].type === 'file').sort();
        
        return JSON.stringify(files1) !== JSON.stringify(files2);
    };
    
    const loadTemplates = async () => {
        try {
            const response = await fetch('/api/templates');
            const data = await response.json();
            setTemplates(data);
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    };

    // Toggle folder expansion
    const toggleFolder = (path) => {
        setExpandedFolders(prev => 
            prev.includes(path) 
                ? prev.filter(p => p !== path)
                : [...prev, path]
        );
    };
    
    // Toggle TSC5 folder expansion
    const toggleTSC5Folder = (path) => {
        setExpandedTSC5Folders(prev => 
            prev.includes(path) 
                ? prev.filter(p => p !== path)
                : [...prev, path]
        );
    };

    // Handle delete
    const handleDelete = async () => {
        if (!selectedFolder && selectedFiles.length === 0) return;
        
        const itemsToDelete = selectedFolder ? 
            `folder "${selectedFolder}"` : 
            `${selectedFiles.length} file(s)`;
            
        if (!confirm(`Are you sure you want to delete ${itemsToDelete}?`)) return;
        
        try {
            const response = await fetch('/api/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folder: selectedFolder,
                    files: selectedFiles
                })
            });
            
            if (response.ok) {
                setSelectedFolder('');
                setSelectedFiles([]);
                loadFolders();
            } else {
                alert('Error deleting items');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Error deleting items');
        }
    };
    
    // Upload field data from TSC5 - shows field status form first
    const handleUploadFieldData = async (jobPath) => {
        if (!isAndroidApp) {
            alert('This feature only works in the Android app');
            return;
        }

        // Log upload button click
        logAction('upload-clicked', jobPath);

        try {
            // Strip .job filename if present (jobPath might be "26-001/26-001-260106/26-001-260106.job")
            let cleanJobPath = jobPath;
            if (jobPath.endsWith('.job')) {
                // Remove the filename, keep just the directory path
                cleanJobPath = jobPath.substring(0, jobPath.lastIndexOf('/'));
            }

            // Fetch job_info.json to get jobType and previous uploads
            const url = `/api/download-file/${cleanJobPath}/job_info.json`;
            const response = await fetch(url);

            let jobInfo = null;
            if (response.ok) {
                const text = await response.text();
                try {
                    jobInfo = JSON.parse(text);
                } catch (parseError) {
                    console.error('Failed to parse job_info.json:', parseError);
                }
            }

            // Set up field status form
            // Store original jobPath for Android, but we'll use cleanJobPath for API calls
            setFieldStatusData({
                jobPath: jobPath,
                cleanJobPath: cleanJobPath,
                jobInfo: jobInfo,
                jobType: jobInfo?.jobType || '', // Empty if missing - will show dropdown
                customJobType: '',
                operator: 'Allan',
                uploadType: 'complete', // 'intermediate', 'complete', or 'reupload'
                replacesFolder: '',
                timeOnSite: '',
                travelTime: '',
                fieldWorkDone: '',
                estimatedTimeRemaining: '',
                notesWhatLeft: '',
                pinsFound: '',
                pinsPlaced: '',
                constructionTasks: [],
                customTasks: '',
                notes: ''
            });

            // Show the form
            setShowFieldStatusForm(true);

        } catch (error) {
            console.error('Error in handleUploadFieldData:', error);
            alert('Error loading job information: ' + error.message);
        }
    };
    
    // Submit field status form and perform upload
    const handleFieldStatusSubmit = async () => {
        // Check if job type was missing and needs to be set
        const jobTypeMissing = !fieldStatusData.jobInfo?.jobType;

        if (jobTypeMissing) {
            // Validate job type is selected
            if (!fieldStatusData.jobType) {
                alert('Please select a job type');
                return;
            }
            // If "other" selected, require custom type
            if (fieldStatusData.jobType === 'other' && !fieldStatusData.customJobType.trim()) {
                alert('Please enter a custom job type');
                return;
            }
        }

        // Validate required fields based on upload type
        if (!fieldStatusData.operator) {
            alert('Please enter operator name');
            return;
        }

        if (fieldStatusData.uploadType === 'complete') {
            // Complete upload requires all tracking fields
            if (!fieldStatusData.timeOnSite || !fieldStatusData.travelTime || !fieldStatusData.fieldWorkDone) {
                alert('Please fill in all required fields');
                return;
            }

            // If field work not done, require additional fields
            if (fieldStatusData.fieldWorkDone === 'no' && (!fieldStatusData.estimatedTimeRemaining || !fieldStatusData.notesWhatLeft)) {
                alert('Please provide estimated time remaining and notes about what\'s left to do');
                return;
            }
        } else if (fieldStatusData.uploadType === 'reupload') {
            // Re-upload requires selecting which folder to replace
            if (!fieldStatusData.replacesFolder) {
                alert('Please select which upload this replaces');
                return;
            }
        }
        // Intermediate upload only requires operator (already checked above)

        try {
            // Determine final job type - use selected if missing, or existing from jobInfo
            const finalJobType = jobTypeMissing
                ? (fieldStatusData.jobType === 'other' ? fieldStatusData.customJobType : fieldStatusData.jobType)
                : fieldStatusData.jobInfo.jobType;

            // Build field status object
            const fieldStatus = {
                operator: fieldStatusData.operator,
                uploadType: fieldStatusData.uploadType, // 'intermediate', 'complete', or 'reupload'
                replacesFolder: fieldStatusData.replacesFolder || null,
                timeOnSite: fieldStatusData.timeOnSite || null,
                travelTime: fieldStatusData.travelTime || null,
                fieldWorkDone: fieldStatusData.fieldWorkDone || null,
                estimatedTimeRemaining: fieldStatusData.estimatedTimeRemaining || null,
                notesWhatLeft: fieldStatusData.notesWhatLeft || null,
                pinsFound: fieldStatusData.pinsFound || null,
                pinsPlaced: fieldStatusData.pinsPlaced || null,
                constructionTasks: fieldStatusData.constructionTasks,
                customTasks: fieldStatusData.customTasks || null,
                notes: fieldStatusData.notes || null,
                jobType: finalJobType,
                updateJobType: jobTypeMissing // Tell server to update job_info.json
            };

            // Use cleaned path for server API (server needs directory path, not file path)
            const pathForServer = fieldStatusData.cleanJobPath || fieldStatusData.jobPath;

            // First, store the field status on the server
            console.log('Storing field status for path:', pathForServer);
            console.log('Field status data:', fieldStatus);

            const storeResponse = await fetch('/api/store-pending-field-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobPath: pathForServer,
                    fieldStatus: fieldStatus
                })
            });

            if (!storeResponse.ok) {
                const errorData = await storeResponse.json().catch(() => ({}));
                const errorMsg = errorData.error || `Server returned ${storeResponse.status}`;
                console.error('Store field status failed:', errorMsg);
                throw new Error(`Failed to store field status: ${errorMsg}`);
            }

            console.log('Field status stored successfully');

            // Only close form AFTER successful POST
            setShowFieldStatusForm(false);
            setIsUploading(true);

            // Now trigger the Android upload with original path
            // (Android and server both handle .job extension)
            window.TrimbleSync.uploadFieldData(fieldStatusData.jobPath);

        } catch (error) {
            console.error('Field data upload error:', error);
            alert('Error storing field status: ' + error.message + '\n\nPlease check your connection and try again.');
            // Form stays open - user can retry
        }
    };

    // Launch Trimble Access for a job
    const handleLaunchTrimbleAccess = (jobPath) => {
        if (!isAndroidApp) {
            alert('This feature only works in the Android app');
            return;
        }

        try {
            window.TrimbleSync.launchTrimbleAccess(jobPath);
        } catch (error) {
            console.error('Error launching Trimble Access:', error);
            alert('Could not launch Trimble Access');
        }
    };
    
    // Download field data folder as ZIP
    const handleDownloadFieldData = (folderPath, folderName) => {
        console.log(`Downloading field data: ${folderName}`);
        
        // Create and click download link
        const link = document.createElement('a');
        link.href = `/api/download-zip/${folderPath}`;
        link.download = `${folderName}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Render TSC5 folder tree - now handles trimbleJob type
    const renderTSC5FolderTree = (obj, path = '') => {
        // Sort entries: numbered folders/jobs descending, others alphabetically
        const sortedEntries = Object.entries(obj).sort(([nameA], [nameB]) => {
            // Check if both are numbered (e.g., 25-123, 25-100-150)
            const matchA = nameA.match(/^(\d+)-(\d+)(-\d+)?/);
            const matchB = nameB.match(/^(\d+)-(\d+)(-\d+)?/);

            if (matchA && matchB) {
                // Compare first number
                const aFirst = parseInt(matchA[1]);
                const bFirst = parseInt(matchB[1]);
                if (aFirst !== bFirst) return bFirst - aFirst; // Descending

                // Compare second number
                const aSecond = parseInt(matchA[2]);
                const bSecond = parseInt(matchB[2]);
                if (aSecond !== bSecond) return bSecond - aSecond; // Descending

                // Compare third number if exists
                if (matchA[3] && matchB[3]) {
                    const aThird = parseInt(matchA[3].substring(1));
                    const bThird = parseInt(matchB[3].substring(1));
                    return bThird - aThird; // Descending
                }
            }

            // Default: alphabetical
            return nameA.localeCompare(nameB);
        });

        return sortedEntries.map(([name, item]) => {
            const currentPath = path ? `${path}/${name}` : name;
            
            // Handle individual Trimble job files
            if (item.type === 'trimbleJob') {
                const hasLinkedFiles = item.linkedFiles && item.linkedFiles.length > 0;
                const hasExportedFiles = item.exportedFiles && item.exportedFiles.length > 0;
                // Get job note/address from various possible properties
                const jobAddress = item.jobNote || item.address || item.note || '';

                return (
                    <div key={currentPath} className="select-none">
                        <div className="flex items-center py-1 px-2 hover:bg-gray-100 rounded">
                            <span className="w-5 mr-1" />
                            <Icon name="briefcase" className="w-4 h-4 mr-2 text-purple-600" />
                            <span className="text-sm font-medium">{name}</span>

                            {/* Show job address/note if available */}
                            {jobAddress && (
                                <>
                                    <Icon name="map-pin" className="w-3 h-3 ml-2 text-gray-400" />
                                    <span className="text-xs text-gray-600 ml-1 mr-2">{jobAddress}</span>
                                </>
                            )}

                            {/* Show linked files indicator */}
                            {hasLinkedFiles && (
                                <span className="text-xs text-blue-600 font-medium mr-2" title="Has layout files">
                                    📎 {item.linkedFiles.length}
                                </span>
                            )}

                            {/* Show photo count */}
                            {item.photos > 0 && (
                                <span className="text-xs text-purple-600 font-medium mr-2">
                                    📸 {item.photos}
                                </span>
                            )}

                            {/* Show file counts */}
                            <span className="text-xs text-gray-600 mr-2">
                                {item.csvCount > 0 && `${item.csvCount} CSV`}
                                {item.csvCount > 0 && item.dxfCount > 0 && ' • '}
                                {item.dxfCount > 0 && `${item.dxfCount} DXF`}
                            </span>

                            {/* Status indicator */}
                            {!hasExportedFiles && (
                                <span className="text-xs text-orange-500 mr-2" title="No exports yet">
                                    ⚠️
                                </span>
                            )}

                            {/* Action buttons */}
                            {hasExportedFiles && (
                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => handleUploadFieldData(currentPath)}
                                        className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                                        title="Upload field data to office"
                                        disabled={isUploading}
                                    >
                                        <Icon name="cloud-upload" className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
            
            // Handle folders
            if (item.type === 'folder' || item.type === 'mainFolder' || item.type === 'jobNumber' || item.type === 'job' || item.type === 'fieldData') {
                const isExpanded = expandedTSC5Folders.includes(currentPath);
                const hasChildren = Object.keys(item.children || {}).length > 0;
                const isJobFolder = item.type === 'job';
                // Get job address from metadata if available
                const jobAddress = item.address || (item.metadata && item.metadata.address) || '';

                let folderColor = 'text-purple-600';
                if (item.type === 'mainFolder') folderColor = 'text-blue-600';
                if (item.type === 'job') folderColor = 'text-orange-600';
                if (item.type === 'jobNumber') folderColor = 'text-green-600';

                return (
                    <div key={currentPath} className="select-none">
                        <div
                            className="flex items-center py-1 px-2 hover:bg-gray-100 rounded cursor-pointer"
                            onClick={() => toggleTSC5Folder(currentPath)}
                        >
                            {hasChildren && (
                                <Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} className="w-4 h-4 mr-1 text-gray-500" />
                            )}
                            {!hasChildren && <span className="w-5 mr-1" />}
                            <Icon name={item.type === 'job' ? 'calendar' : 'folder-open'} className={`w-4 h-4 mr-2 ${folderColor}`} />
                            <span className="text-sm font-medium">{name}</span>

                            {/* Show job address if available */}
                            {jobAddress && (
                                <>
                                    <Icon name="map-pin" className="w-3 h-3 ml-2 text-gray-400" />
                                    <span className="text-xs text-gray-600 ml-1 mr-2">{jobAddress}</span>
                                </>
                            )}

                            {/* Show photo count for job folders */}
                            {isJobFolder && item.photos > 0 && (
                                <span className="text-xs text-purple-600 font-medium mr-2">📸 {item.photos}</span>
                            )}
                            
                            {/* Show file counts for job folders */}
                            {isJobFolder && (
                                <span className="text-xs text-gray-600 mr-2">
                                    {item.jobCount > 0 && `${item.jobCount} job`}
                                    {item.csvCount > 0 && ` • ${item.csvCount} CSV`}
                                    {item.dxfCount > 0 && ` • ${item.dxfCount} DXF`}
                                </span>
                            )}
                            
                            {/* Action buttons for job folders */}
                            {isJobFolder && (
                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => handleLaunchTrimbleAccess(currentPath)}
                                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                        title="Open in Trimble Access"
                                    >
                                        <Icon name="database" className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => handleUploadFieldData(currentPath)}
                                        className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                                        title="Upload field data to office"
                                    >
                                        <Icon name="cloud-upload" className="w-3 h-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                        {isExpanded && hasChildren && (
                            <div className="ml-6">
                                {renderTSC5FolderTree(item.children, currentPath)}
                            </div>
                        )}
                    </div>
                );
            } else {
                // Don't render individual files in TSC5 view
                return null;
            }
        });
    };

    // Render folder tree with proper path tracking
    const renderFolderTree = (obj, path = '', isController = false) => {
        // Sort entries: numbered folders/jobs descending, others alphabetically
        const sortedEntries = Object.entries(obj).sort(([nameA], [nameB]) => {
            // Check if both are numbered (e.g., 25-123, 25-100-150)
            const matchA = nameA.match(/^(\d+)-(\d+)(-\d+)?/);
            const matchB = nameB.match(/^(\d+)-(\d+)(-\d+)?/);

            if (matchA && matchB) {
                // Compare first number
                const aFirst = parseInt(matchA[1]);
                const bFirst = parseInt(matchB[1]);
                if (aFirst !== bFirst) return bFirst - aFirst; // Descending

                // Compare second number
                const aSecond = parseInt(matchA[2]);
                const bSecond = parseInt(matchB[2]);
                if (aSecond !== bSecond) return bSecond - aSecond; // Descending

                // Compare third number if exists
                if (matchA[3] && matchB[3]) {
                    const aThird = parseInt(matchA[3].substring(1));
                    const bThird = parseInt(matchB[3].substring(1));
                    return bThird - aThird; // Descending
                }
            }

            // Default: alphabetical
            return nameA.localeCompare(nameB);
        });

        return sortedEntries.map(([name, item]) => {
            const currentPath = path ? `${path}/${name}` : name;
            const itemSyncStatus = syncStatus[currentPath];
            
            if (item.type === 'folder' || item.type === 'mainFolder' || item.type === 'jobNumber' || item.type === 'job' || item.type === 'fieldData') {
                const isExpanded = expandedFolders.includes(currentPath);
                const hasChildren = Object.keys(item.children || {}).length > 0;
                
                let folderColor = 'text-blue-600';
                if (isController) folderColor = 'text-green-600';
                if (item.type === 'job') folderColor = 'text-orange-600';
                if (item.type === 'fieldData') folderColor = 'text-purple-600';
                
                // Gray out if not synced
                if (itemSyncStatus === 'office-only' && isController) {
                    folderColor = 'text-gray-400';
                } else if (itemSyncStatus === 'controller-only' && !isController) {
                    folderColor = 'text-gray-400';
                }
                
                return (
                    <div key={currentPath} className="select-none">
                        <div 
                            className={`flex items-center py-1 px-2 hover:bg-gray-100 rounded cursor-pointer ${
                                selectedFolder === currentPath ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => {
                                console.log('Folder clicked:', currentPath);
                                toggleFolder(currentPath);
                                if (!isController) {
                                    setSelectedFolder(currentPath);
                                    setSelectedFiles([]); // Clear file selection when selecting folder
                                    console.log('Selected folder is now:', currentPath);
                                    // Update the selected path in job dialog if it's open
                                    if (showNewJobDialog) {
                                        setNewJobData(prev => ({ ...prev, selectedPath: currentPath }));
                                    }
                                }
                                if (item.address) setSelectedJob({ name, path: currentPath, ...item });
                            }}
                        >
                            {hasChildren && (
                                <Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} className="w-4 h-4 mr-1 text-gray-500" />
                            )}
                            {!hasChildren && <span className="w-5 mr-1" />}
                            <Icon name={item.type === 'job' ? 'calendar' : item.type === 'fieldData' ? 'smartphone' : 'folder-open'} className={`w-4 h-4 mr-2 ${folderColor}`} />
                            <span className={`text-sm font-medium ${(itemSyncStatus === 'office-only' && isController) || (itemSyncStatus === 'controller-only' && !isController) ? 'text-gray-400' : ''}`}>
                                {name}
                                {item.type === 'fieldData' && ' (Field Data)'}
                            </span>
                            <SyncStatus syncStatus={itemSyncStatus} />
                            {item.address && (
                                <>
                                    <Icon name="map-pin" className="w-3 h-3 ml-2 text-gray-400" />
                                    <span className="text-xs text-gray-600 ml-1">{item.address}</span>
                                </>
                            )}
                            {item.photos && item.photos > 0 && (
                                <span className="text-xs text-purple-600 font-medium ml-2">📸 {item.photos}</span>
                            )}
                            {/* Android download button for folders */}
                            {isAndroidApp && !isController && (item.type === 'job' || item.type === 'folder' || item.type === 'mainFolder' || item.type === 'jobNumber') && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Log download button click
                                        logAction('download-clicked', currentPath);
                                        if (window.TrimbleSync && window.TrimbleSync.syncJobToTrimble) {
                                            window.TrimbleSync.syncJobToTrimble(currentPath);
                                        }
                                    }}
                                    className="ml-auto px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 mr-2"
                                    title="Download to TSC5"
                                >
                                    <Icon name="download" className="w-3 h-3" />
                                </button>
                            )}
                            {/* Download ZIP button for field data folders only */}
                            {!isAndroidApp && !isController && (
                                item.type === 'fieldData' || 
                                name === 'Field_Data' || 
                                /^\d{6}-\d{3,4}[AP]M$/i.test(name) // Matches timestamps like 081225-1035AM
                            ) && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadFieldData(currentPath, name);
                                    }}
                                    className="ml-2 px-2 py-0.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-1"
                                    title="Download field data as ZIP"
                                >
                                    <Icon name="download" className="w-3 h-3" />
                                    ZIP
                                </button>
                            )}
                        </div>
                        {isExpanded && hasChildren && (
                            <div className="ml-6">
                                {renderFolderTree(item.children, currentPath, isController)}
                            </div>
                        )}
                    </div>
                );
            } else {
                const isSelected = selectedFiles.includes(currentPath);
                let fileIcon = 'file';
                let fileColor = 'text-gray-500';
                
                if (item.core) {
                    fileColor = 'text-blue-500';
                } else if (item.photo) {
                    fileIcon = 'camera';
                    fileColor = 'text-purple-500';
                } else if (item.csv) {
                    fileColor = 'text-green-500';
                } else if (item.dxf) {
                    fileColor = 'text-orange-500';
                }
                
                return (
                    <div 
                        key={currentPath}
                        className={`flex items-center py-1 px-2 ml-5 hover:bg-gray-100 rounded cursor-pointer ${
                            isSelected ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => {
                            if (!isController) {
                                setSelectedFolder(''); // Clear folder selection when selecting files
                                setSelectedFiles(prev => 
                                    prev.includes(currentPath)
                                        ? prev.filter(f => f !== currentPath)
                                        : [...prev, currentPath]
                                );
                            }
                        }}
                    >
                        <Icon name={fileIcon} className={`w-4 h-4 mr-2 ${fileColor}`} />
                        <span className="text-sm flex-1">{name}</span>
                        <span className="text-xs text-gray-500 mr-2">{item.size}</span>
                        {/* Download button for individual files in Android */}
                        {isAndroidApp && !isController && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // Log download button click
                                    logAction('download-clicked', currentPath);
                                    if (window.TrimbleSync && window.TrimbleSync.syncJobToTrimble) {
                                        // Download single file by passing the full path
                                        window.TrimbleSync.syncJobToTrimble(currentPath);
                                    }
                                }}
                                className="px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                title="Download file"
                            >
                                <Icon name="download" className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                );
            }
        });
    };

    // Handle file drop
    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (!selectedFolder) {
            alert('Please select a folder first before dropping files');
            return;
        }
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            console.log('Dropping files to folder:', selectedFolder);
            
            const formData = new FormData();
            // IMPORTANT: Add targetPath BEFORE files for multer to read it
            formData.append('targetPath', selectedFolder);
            
            for (let file of e.dataTransfer.files) {
                console.log('Adding file to upload:', file.name);
                formData.append('files', file);
            }
            
            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('Upload successful:', result);
                    loadFolders();
                } else {
                    const error = await response.json();
                    console.error('Upload failed:', error);
                    alert('Upload failed: ' + (error.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Upload error:', error);
                alert('Upload error: ' + error.message);
            }
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };
    
    // Handle file drop for job creation dialog
    const handleJobDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setJobDragActive(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const newFiles = Array.from(e.dataTransfer.files).filter(file => 
                file.name.toLowerCase().endsWith('.csv') || 
                file.name.toLowerCase().endsWith('.dxf') ||
                file.name.toLowerCase().endsWith('.xml') ||
                file.name.toLowerCase().endsWith('.landxml')
            );
            setJobFiles(prev => [...prev, ...newFiles]);
        }
    };
    
    const handleJobDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setJobDragActive(true);
        } else if (e.type === "dragleave") {
            setJobDragActive(false);
        }
    };

    // Create new folder
    const handleCreateFolder = async () => {
        if (!newFolderName) return;
        
        console.log('Creating folder with parent:', selectedFolder);
        
        try {
            await fetch('/api/create-main-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    folderName: newFolderName,
                    parentPath: selectedFolder,
                    location: 'office'
                })
            });
            
            setShowNewFolderDialog(false);
            setNewFolderName('');
            loadFolders();
        } catch (error) {
            console.error('Error creating folder:', error);
        }
    };

    // Create new job
    const handleCreateJob = async () => {
        const { selectedPath, jobNumber, date, address, jobType, customJobType, template, referenceNumber, description, operator } = newJobData;
        if (!selectedPath || !jobNumber || !date || !address) {
            alert('Please fill in all required fields');
            return;
        }

        // Validate custom job type if "other" is selected
        if (jobType === 'other' && !customJobType.trim()) {
            alert('Please enter a custom job type');
            return;
        }

        try {
            // First create the job
            const response = await fetch('/api/create-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    parentPath: selectedPath,
                    jobNumber,
                    date,
                    address,
                    jobType: jobType === 'other' ? customJobType : jobType,
                    template,
                    referenceNumber,
                    description,
                    operator
                })
            });
            
            const result = await response.json();
            if (result.success) {
                const jobPath = `${selectedPath}/${jobNumber}-${date}`;
                let uploadedFiles = [];
                
                // Upload files if any were dropped
                if (jobFiles.length > 0) {
                    const formData = new FormData();
                    // IMPORTANT: targetPath must be added BEFORE files for multer to read it
                    formData.append('targetPath', jobPath);
                    for (let file of jobFiles) {
                        formData.append('files', file);
                    }
                    
                    try {
                        const uploadResponse = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData
                        });
                        
                        if (uploadResponse.ok) {
                            uploadedFiles = jobFiles.map(f => f.name);
                        }
                    } catch (error) {
                        console.error('Error uploading files:', error);
                    }
                }
                
                // Now generate JXL/JOB files
                try {
                    const jxlResponse = await fetch('/api/generate-job-file', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jobPath,
                            jobName: jobNumber,
                            template,
                            referenceNumber,
                            description,
                            operator,
                            address,
                            linkedFiles: uploadedFiles
                        })
                    });
                    
                    const jxlResult = await jxlResponse.json();
                    if (!jxlResult.success) {
                        console.error('Failed to generate JXL/JOB files:', jxlResult);
                        alert('Job created but failed to generate Trimble files. Check server logs.');
                    }
                } catch (error) {
                    console.error('Error generating JXL/JOB files:', error);
                    alert('Job created but failed to generate Trimble files. You can try again later.');
                }
                
                setShowNewJobDialog(false);
                setNewJobData({ selectedPath: '', jobNumber: '', date: '', address: '', jobType: 'survey_rpr', customJobType: '', template: '', referenceNumber: '', description: '', operator: '' });
                setJobFiles([]);
                loadFolders();
            }
        } catch (error) {
            console.error('Error creating job:', error);
            alert('Error creating job. Please check the server.');
        }
    };

    // Sync to controller
    const handleSyncToController = async () => {
        if (selectedFiles.length === 0) return;
        
        setIsUploading(true);
        
        try {
            await fetch('/api/sync-to-controller', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: selectedFiles })
            });
            
            setSelectedFiles([]);
            setLastSync(new Date().toLocaleTimeString());
            loadFolders();
            alert(`Synced ${selectedFiles.length} files to controller!`);
        } catch (error) {
            console.error('Sync error:', error);
            alert('Error syncing files. Please check the server.');
        }
        
        setIsUploading(false);
    };

    // Sync from controller
    const handleSyncFromController = async () => {
        const jobPath = prompt('Enter job path to sync from controller (e.g., 25-100-150/25-123/25-123-250708):', '');
        if (!jobPath) return;
        
        try {
            const response = await fetch('/api/sync-from-controller', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobPath })
            });
            
            const result = await response.json();
            if (result.success) {
                loadFolders();
                alert(`Synced from controller:\n${result.results.files.length} files\n${result.results.photos.length} photos\nField data saved to: ${result.fieldDataPath}`);
            }
        } catch (error) {
            console.error('Sync from controller error:', error);
            alert('Error syncing from controller.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="spinner mb-4"></div>
                    <p>Loading Data Sync Portal...</p>
                </div>
            </div>
        );
    }

    // Mobile UI for Android - reuse existing render functions with mobile wrapper
    if (isAndroidApp) {
        return (
            <div className="min-h-screen bg-gray-100">
                {/* Native-style header */}
                <div className="bg-[#2196F3] text-white shadow-lg">
                    <div className="px-4 py-4">
                        <h1 className="text-xl font-medium">Data Sync</h1>
                        <p className="text-sm opacity-90">Pardy Surveys</p>
                    </div>
                </div>

                {/* Tab bar */}
                <div className="bg-white shadow-sm border-b">
                    <div className="flex">
                        <button 
                            onClick={() => setActiveTab('local')}
                            className={`flex-1 py-3 text-center font-medium ${
                                activeTab === 'local' 
                                    ? 'text-[#2196F3] border-b-2 border-[#2196F3]' 
                                    : 'text-gray-600'
                            }`}
                        >
                            <Icon name="smartphone" className="w-5 h-5 mx-auto mb-1" />
                            <span className="text-sm">Controller Jobs</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('office')}
                            className={`flex-1 py-3 text-center font-medium ${
                                activeTab === 'office' 
                                    ? 'text-[#2196F3] border-b-2 border-[#2196F3]' 
                                    : 'text-gray-600'
                            }`}
                        >
                            <Icon name="briefcase" className="w-5 h-5 mx-auto mb-1" />
                            <span className="text-sm">Office Jobs</span>
                        </button>
                    </div>
                </div>

                {/* Content area - using existing render functions */}
                <div className="mobile-view overflow-y-auto pb-16">
                    {activeTab === 'local' ? (
                        /* Local TSC5 Jobs - use existing renderTSC5FolderTree */
                        needsStorageAccess ? (
                            <div className="p-8 text-center">
                                <Icon name="folder-open" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">Storage Access Required</h3>
                                <p className="text-gray-600 mb-6">To view and manage Trimble jobs, please grant storage permissions</p>
                                <button
                                    onClick={requestStorageAccess}
                                    className="px-6 py-3 bg-[#2196F3] text-white rounded-full font-medium shadow-lg"
                                >
                                    Grant Access
                                </button>
                            </div>
                        ) : Object.keys(tsc5Jobs).length === 0 ? (
                            <div className="p-8 text-center">
                                <Icon name="briefcase" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs Found</h3>
                                <p className="text-gray-600">Download jobs from the Office tab to get started</p>
                            </div>
                        ) : (
                            <div className="p-2">
                                {renderTSC5FolderTree(tsc5Jobs)}
                            </div>
                        )
                    ) : (
                        /* Office Jobs - use existing renderFolderTree */
                        <div className="p-2">
                            {renderFolderTree(folderStructure.office)}
                        </div>
                    )}
                </div>

                {/* Floating refresh button */}
                {activeTab === 'local' && !needsStorageAccess && (
                    <button
                        onClick={loadTSC5Jobs}
                        disabled={loadingTSC5}
                        className="fixed bottom-20 right-4 w-14 h-14 bg-[#2196F3] text-white rounded-full shadow-lg flex items-center justify-center"
                    >
                        <Icon name="refresh-cw" className={`w-6 h-6 ${loadingTSC5 ? 'animate-spin' : ''}`} />
                    </button>
                )}
                {/* Field Status Form Dialog - Android Version */}
                {showFieldStatusForm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
                            {/* Fixed header */}
                            <div className="p-6 pb-4 border-b">
                                <h3 className="text-lg font-semibold">Field Work Status - {fieldStatusData.jobInfo?.jobNumber || 'Job'}</h3>
                                <p className="text-sm text-gray-600 mt-1">{fieldStatusData.jobInfo?.address}</p>
                            </div>

                            {/* Scrollable content */}
                            <div className="flex-1 overflow-y-auto p-6 pt-4">
                                <div className="space-y-4">
                                    {/* Job Type - only show if missing from job_info.json */}
                                    {!fieldStatusData.jobInfo?.jobType && (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                                            <p className="text-sm text-yellow-800 mb-3">This job doesn't have a type set. Please select one:</p>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Job Type <span className="text-red-500">*</span></label>
                                                <select
                                                    value={fieldStatusData.jobType}
                                                    onChange={(e) => setFieldStatusData({...fieldStatusData, jobType: e.target.value, customJobType: ''})}
                                                    className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                                >
                                                    <option value="">Select job type...</option>
                                                    <option value="survey_rpr">Survey & RPR</option>
                                                    <option value="rpr">RPR</option>
                                                    <option value="survey">Survey</option>
                                                    <option value="building_construction">Building Construction</option>
                                                    <option value="topo">Topo</option>
                                                    <option value="subdivision">Subdivision</option>
                                                    <option value="other">Other</option>
                                                </select>
                                                {fieldStatusData.jobType === 'other' && (
                                                    <input
                                                        type="text"
                                                        placeholder="Enter custom job type"
                                                        value={fieldStatusData.customJobType}
                                                        onChange={(e) => setFieldStatusData({...fieldStatusData, customJobType: e.target.value})}
                                                        className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none mt-2"
                                                    />
                                                )}
                                                <p className="text-xs text-gray-600 mt-2">This will be saved to the job for future uploads.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Operator */}
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Operator <span className="text-red-500">*</span></label>
                                        <select
                                            value={fieldStatusData.operator}
                                            onChange={(e) => setFieldStatusData({...fieldStatusData, operator: e.target.value})}
                                            className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                        >
                                            <option value="Allan">Allan</option>
                                            <option value="Joe">Joe</option>
                                            <option value="Nick">Nick</option>
                                        </select>
                                    </div>

                                    {/* Upload Type - Radio Buttons */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Upload Type <span className="text-red-500">*</span></label>
                                        <div className="space-y-2">
                                            <label className="flex items-center">
                                                <input
                                                    type="radio"
                                                    name="uploadTypeAndroid"
                                                    value="intermediate"
                                                    checked={fieldStatusData.uploadType === 'intermediate'}
                                                    onChange={(e) => setFieldStatusData({...fieldStatusData, uploadType: e.target.value})}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">Intermediate upload (sending data for review)</span>
                                            </label>
                                            <label className="flex items-center">
                                                <input
                                                    type="radio"
                                                    name="uploadTypeAndroid"
                                                    value="complete"
                                                    checked={fieldStatusData.uploadType === 'complete'}
                                                    onChange={(e) => setFieldStatusData({...fieldStatusData, uploadType: e.target.value})}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm font-semibold">Complete upload (done for today)</span>
                                            </label>
                                            <label className="flex items-center">
                                                <input
                                                    type="radio"
                                                    name="uploadTypeAndroid"
                                                    value="reupload"
                                                    checked={fieldStatusData.uploadType === 'reupload'}
                                                    onChange={(e) => setFieldStatusData({...fieldStatusData, uploadType: e.target.value})}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">Re-upload (fix previous)</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* If re-upload, show dropdown of previous uploads */}
                                    {fieldStatusData.uploadType === 'reupload' && fieldStatusData.jobInfo?.fieldDataUploads && (
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Which upload does this replace? <span className="text-red-500">*</span></label>
                                            <select
                                                value={fieldStatusData.replacesFolder}
                                                onChange={(e) => setFieldStatusData({...fieldStatusData, replacesFolder: e.target.value})}
                                                className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                            >
                                                <option value="">Select previous upload...</option>
                                                {fieldStatusData.jobInfo.fieldDataUploads.map((upload, idx) => (
                                                    <option key={idx} value={upload.folder}>{upload.folder} - {new Date(upload.timestamp).toLocaleString()}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Show full form only for complete upload */}
                                    {fieldStatusData.uploadType === 'complete' && (
                                        <>
                                            {/* Time on site */}
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Time on site <span className="text-red-500">*</span></label>
                                                <select
                                                    value={fieldStatusData.timeOnSite}
                                                    onChange={(e) => setFieldStatusData({...fieldStatusData, timeOnSite: e.target.value})}
                                                    className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                                >
                                                    <option value="">Select time...</option>
                                                    <option value="0.5">0.5 hours</option>
                                                    <option value="1">1 hour</option>
                                                    <option value="1.5">1.5 hours</option>
                                                    <option value="2">2 hours</option>
                                                    <option value="2.5">2.5 hours</option>
                                                    <option value="3">3 hours</option>
                                                    <option value="3.5">3.5 hours</option>
                                                    <option value="4">4 hours</option>
                                                    <option value="4.5">4.5 hours</option>
                                                    <option value="5">5 hours</option>
                                                    <option value="5.5">5.5 hours</option>
                                                    <option value="6">6 hours</option>
                                                    <option value="6+">6+ hours</option>
                                                </select>
                                            </div>

                                            {/* Travel time one way */}
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Travel time one way <span className="text-red-500">*</span></label>
                                                <select
                                                    value={fieldStatusData.travelTime}
                                                    onChange={(e) => setFieldStatusData({...fieldStatusData, travelTime: e.target.value})}
                                                    className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                                >
                                                    <option value="">Select time...</option>
                                                    <option value="0.25">15 min</option>
                                                    <option value="0.5">30 min</option>
                                                    <option value="0.75">45 min</option>
                                                    <option value="1">1 hr</option>
                                                    <option value="1.25">1.25 hr</option>
                                                    <option value="1.5">1.5 hr</option>
                                                    <option value="2">2 hr</option>
                                                    <option value="2.5">2.5 hr</option>
                                                    <option value="3">3 hr</option>
                                                </select>
                                            </div>

                                            {/* Field work completely done */}
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Field work completely done? <span className="text-red-500">*</span></label>
                                                <div className="flex gap-4">
                                                    <label className="flex items-center">
                                                        <input
                                                            type="radio"
                                                            name="fieldWorkDoneAndroid"
                                                            value="yes"
                                                            checked={fieldStatusData.fieldWorkDone === 'yes'}
                                                            onChange={(e) => setFieldStatusData({...fieldStatusData, fieldWorkDone: e.target.value})}
                                                            className="mr-2"
                                                        />
                                                        Yes
                                                    </label>
                                                    <label className="flex items-center">
                                                        <input
                                                            type="radio"
                                                            name="fieldWorkDoneAndroid"
                                                            value="no"
                                                            checked={fieldStatusData.fieldWorkDone === 'no'}
                                                            onChange={(e) => setFieldStatusData({...fieldStatusData, fieldWorkDone: e.target.value})}
                                                            className="mr-2"
                                                        />
                                                        No
                                                    </label>
                                                </div>
                                            </div>

                                            {/* If field work not done, show additional fields */}
                                            {fieldStatusData.fieldWorkDone === 'no' && (
                                                <>
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">Estimated time to complete <span className="text-red-500">*</span></label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g., 2 hours"
                                                            value={fieldStatusData.estimatedTimeRemaining}
                                                            onChange={(e) => setFieldStatusData({...fieldStatusData, estimatedTimeRemaining: e.target.value})}
                                                            className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">Notes / What's left to do <span className="text-red-500">*</span></label>
                                                        <textarea
                                                            placeholder="Describe what still needs to be completed..."
                                                            value={fieldStatusData.notesWhatLeft}
                                                            onChange={(e) => setFieldStatusData({...fieldStatusData, notesWhatLeft: e.target.value})}
                                                            className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                                            rows="3"
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            {/* Pins questions - conditional based on job type */}
                                            {(() => {
                                                const currentJobType = fieldStatusData.jobInfo?.jobType || fieldStatusData.jobType;
                                                return currentJobType && JOB_TYPE_CONFIG[currentJobType]?.asks_pins_found && (
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">Pins found?</label>
                                                        <select
                                                            value={fieldStatusData.pinsFound}
                                                            onChange={(e) => setFieldStatusData({...fieldStatusData, pinsFound: e.target.value})}
                                                            className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                                        >
                                                            <option value="">Select...</option>
                                                            <option value="yes">Yes</option>
                                                            <option value="no">No</option>
                                                            <option value="partial">Partial</option>
                                                            <option value="n/a">N/A</option>
                                                        </select>
                                                    </div>
                                                );
                                            })()}

                                            {(() => {
                                                const currentJobType = fieldStatusData.jobInfo?.jobType || fieldStatusData.jobType;
                                                return currentJobType && JOB_TYPE_CONFIG[currentJobType]?.asks_pins_placed && (
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">Pins placed?</label>
                                                        <select
                                                            value={fieldStatusData.pinsPlaced}
                                                            onChange={(e) => setFieldStatusData({...fieldStatusData, pinsPlaced: e.target.value})}
                                                            className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                                        >
                                                            <option value="">Select...</option>
                                                            <option value="yes">Yes</option>
                                                            <option value="no">No</option>
                                                            <option value="partial">Partial</option>
                                                            <option value="n/a">N/A</option>
                                                        </select>
                                                    </div>
                                                );
                                            })()}

                                            {/* Construction checklist - only for building construction */}
                                            {(fieldStatusData.jobInfo?.jobType === 'building_construction' || fieldStatusData.jobType === 'building_construction') && (
                                                <div>
                                                    <label className="block text-sm font-medium mb-2">Tasks completed this visit:</label>
                                                    <div className="space-y-2 pl-2">
                                                        {['excavation_layout', 'topographic_survey', 'footing_placement', 'building_placement', 'rpr_foundation', 'rpr_all_features', 'final_grading'].map((task) => (
                                                            <label key={task} className="flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={fieldStatusData.constructionTasks.includes(task)}
                                                                    onChange={(e) => {
                                                                        const newTasks = e.target.checked
                                                                            ? [...fieldStatusData.constructionTasks, task]
                                                                            : fieldStatusData.constructionTasks.filter(t => t !== task);
                                                                        setFieldStatusData({...fieldStatusData, constructionTasks: newTasks});
                                                                    }}
                                                                    className="mr-2"
                                                                />
                                                                <span className="text-sm">{task.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                                                            </label>
                                                        ))}
                                                        <div>
                                                            <label className="block text-sm font-medium mb-1 mt-2">Other tasks:</label>
                                                            <input
                                                                type="text"
                                                                placeholder="e.g., Septic layout"
                                                                value={fieldStatusData.customTasks}
                                                                onChange={(e) => setFieldStatusData({...fieldStatusData, customTasks: e.target.value})}
                                                                className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Notes field - shown for intermediate and complete uploads */}
                                    {(fieldStatusData.uploadType === 'intermediate' || fieldStatusData.uploadType === 'complete') && (
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Notes {fieldStatusData.uploadType === 'intermediate' ? '(optional)' : ''}</label>
                                            <textarea
                                                placeholder={fieldStatusData.uploadType === 'intermediate' ? "Any notes about this data..." : "Any additional notes about this visit..."}
                                                value={fieldStatusData.notes}
                                                onChange={(e) => setFieldStatusData({...fieldStatusData, notes: e.target.value})}
                                                className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                                rows="3"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Fixed footer with buttons */}
                            <div className="p-6 pt-4 border-t bg-gray-50">
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleFieldStatusSubmit}
                                        className="flex-1 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                                    >
                                        Upload Field Data
                                    </button>
                                    <button
                                        onClick={() => setShowFieldStatusForm(false)}
                                        className="flex-1 py-2 border border-gray-300 rounded hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Desktop UI (unchanged)
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header with selected folder display */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-bold text-gray-800">Data Sync Portal - Pardy Surveys</h1>
                        <div className="flex items-center gap-4">
                            {selectedFolder && (
                                <div className="text-sm text-gray-600">
                                    Selected: <span className="font-medium">{selectedFolder}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 text-sm">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span>TSC5 Controller • Last sync: {lastSync}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-4">
                {/* Selected Job Info */}
                {selectedJob && (
                    <div className="bg-blue-50 rounded-lg p-3 mb-4 flex items-center">
                        <Icon name="map-pin" className="w-5 h-5 text-blue-600 mr-2" />
                        <div>
                            <span className="font-medium">{selectedJob.path}:</span>
                            <span className="ml-2">{selectedJob.address}</span>
                        </div>
                    </div>
                )}

                {/* Sync Status Legend */}
                <div className="bg-white rounded-lg shadow-sm p-3 mb-4">
                    <div className="flex items-center gap-6 text-sm">
                        <span className="font-medium">Sync Status:</span>
                        <div className="flex items-center gap-1">
                            <Icon name="check" className="w-4 h-4 text-green-500" />
                            <span>Synced</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Icon name="cloud-download" className="w-4 h-4 text-blue-500" />
                            <span>Office Only</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Icon name="cloud-upload" className="w-4 h-4 text-orange-500" />
                            <span>Controller Only</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Icon name="refresh-cw" className="w-4 h-4 text-red-500" />
                            <span>Conflict</span>
                        </div>
                    </div>
                </div>

                {/* TSC5 Local Jobs Section (only in Android app) */}
                {isAndroidApp && (
                    <div className="bg-white rounded-lg shadow-sm mb-4">
                        <div className="p-3 border-b flex items-center justify-between">
                            <h2 className="font-semibold flex items-center gap-2">
                                <Icon name="smartphone" className="w-5 h-5 text-purple-600" />
                                TSC5 Local Jobs
                            </h2>
                            <button
                                onClick={loadTSC5Jobs}
                                className="text-sm text-blue-600 hover:underline"
                                disabled={loadingTSC5}
                            >
                                {loadingTSC5 ? 'Loading...' : 'Refresh'}
                            </button>
                        </div>
                        <div className="p-3 max-h-96 overflow-y-auto">
                            {needsStorageAccess ? (
                                <div className="p-4 text-center">
                                    <Icon name="alert-circle" className="w-12 h-12 text-orange-500 mx-auto mb-3" />
                                    <p className="text-gray-700 mb-4">Storage access is required to view Trimble jobs</p>
                                    <button
                                        onClick={requestStorageAccess}
                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        Grant Storage Access
                                    </button>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Please enable "Allow access to manage all files" when prompted
                                    </p>
                                </div>
                            ) : Object.keys(tsc5Jobs).length === 0 ? (
                                <div className="p-4 text-center text-gray-500">
                                    <p>No jobs found in Trimble Data/Projects</p>
                                    <p className="text-xs mt-2">Check the Android logs for details</p>
                                </div>
                            ) : (
                                renderTSC5FolderTree(tsc5Jobs)
                            )}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    {/* Office Jobs */}
                    <div className="bg-white rounded-lg shadow-sm">
                        <div className="p-3 border-b flex items-center justify-between">
                            <h2 className="font-semibold">Office Jobs</h2>
                            <div className="flex gap-2">
                                {(selectedFolder || selectedFiles.length > 0) && (
                                    <button
                                        onClick={handleDelete}
                                        className="flex items-center gap-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                        <Icon name="trash-2" className="w-4 h-4" />
                                        Delete
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowNewFolderDialog(true)}
                                    className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                                >
                                    <Icon name="folder-plus" className="w-4 h-4" />
                                    New Folder
                                </button>
                                <button
                                    onClick={() => {
                                        console.log('New Job clicked, selectedFolder:', selectedFolder);
                                        const extractedJobNumber = extractJobNumberFromPath(selectedFolder);
                                        console.log('Extracted job number:', extractedJobNumber);
                                        const todayDate = getTodaysDateYYMMDD();
                                        console.log('Today date:', todayDate);

                                        setNewJobData(prev => {
                                            const newData = {
                                                ...prev,
                                                selectedPath: selectedFolder,
                                                jobNumber: extractedJobNumber,
                                                date: todayDate,
                                                template: templates.length > 0 ? templates[0].name : ''
                                            };
                                            console.log('Setting newJobData to:', newData);
                                            return newData;
                                        });
                                        setJobFiles([]);
                                        setShowNewJobDialog(true);
                                    }}
                                    className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    <Icon name="plus" className="w-4 h-4" />
                                    New Job
                                </button>
                            </div>
                        </div>
                        
                        {/* Drop Zone */}
                        <div
                            className={`mx-3 mt-3 mb-2 border-2 border-dashed rounded p-4 text-center transition-colors ${
                                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                            }`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <Icon name="upload" className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600">Drop files here (DXF, CSV, etc.)</p>
                            <p className="text-xs text-gray-500 mt-1">Select a folder first, then drop files</p>
                        </div>

                        {/* Folder Tree */}
                        <div className="p-3 max-h-96 overflow-y-auto">
                            {renderFolderTree(folderStructure.office)}
                        </div>

                        {/* Selected Files Info */}
                        {selectedFiles.length > 0 && (
                            <div className="p-3 border-t bg-gray-50">
                                <p className="text-sm text-gray-600 mb-2">{selectedFiles.length} files selected</p>
                                <button
                                    onClick={handleSyncToController}
                                    disabled={isUploading}
                                    className={`w-full py-2 rounded font-medium transition-colors flex items-center justify-center gap-2 ${
                                        isUploading
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                                >
                                    {isUploading ? (
                                        <>
                                            <Icon name="refresh-cw" className="w-4 h-4 animate-spin" />
                                            Syncing...
                                        </>
                                    ) : (
                                        <>
                                            <Icon name="download" className="w-4 h-4" />
                                            Sync to Controller
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Controller Jobs */}
                    <div className="bg-white rounded-lg shadow-sm">
                        <div className="p-3 border-b">
                            <h2 className="font-semibold">TSC5 Controller</h2>
                        </div>
                        <div className="p-3 max-h-[500px] overflow-y-auto">
                            {renderFolderTree(folderStructure.controller, '', true)}
                        </div>
                        
                        {/* Sync from Controller */}
                        <div className="p-3 border-t">
                            <button
                                onClick={handleSyncFromController}
                                className="w-full py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 flex items-center justify-center gap-2"
                            >
                                <Icon name="upload" className="w-4 h-4 rotate-180" />
                                Sync From Controller
                            </button>
                        </div>
                    </div>
                </div>

                {/* Template Info */}
                {templates.length > 0 && (
                    <div className="mt-4 bg-white rounded-lg shadow-sm p-4">
                        <h3 className="font-semibold mb-2 text-sm">Available Templates</h3>
                        <div className="flex flex-wrap gap-2">
                            {templates.map(template => (
                                <div key={template.name} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                    {template.name} ({template.files.length} files)
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Templates are located in: \\ps-nas\pardy surveys\Data Sync\templates\
                        </p>
                    </div>
                )}
            </div>

            {/* New Folder Dialog */}
            {showNewFolderDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-96">
                        <h3 className="text-lg font-semibold mb-4">
                            {selectedFolder ? `Create Folder in ${selectedFolder}` : 'Create New Main Folder'}
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Folder Name</label>
                                <input
                                    type="text"
                                    placeholder={selectedFolder ? "Subfolder name" : "25-100-150"}
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                />
                                {!selectedFolder && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        Format: XX-XXX-XXX (e.g., 25-100-150)
                                    </p>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleCreateFolder}
                                disabled={!newFolderName}
                                className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                            >
                                Create Folder
                            </button>
                            <button
                                onClick={() => {
                                    setShowNewFolderDialog(false);
                                    setNewFolderName('');
                                }}
                                className="flex-1 py-2 border border-gray-300 rounded hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Job Dialog - Fixed for mobile scrolling */}
            {showNewJobDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
                        {/* Fixed header */}
                        <div className="p-6 pb-4 border-b">
                            <h3 className="text-lg font-semibold">Create New Job</h3>
                        </div>
                        
                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto p-6 pt-4">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Location <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={newJobData.selectedPath || 'No folder selected'}
                                        readOnly
                                        className="w-full px-3 py-2 border rounded bg-gray-50"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Select a folder in the tree first</p>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium mb-1">Job Number <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="25-123"
                                        value={newJobData.jobNumber}
                                        onChange={(e) => setNewJobData({...newJobData, jobNumber: e.target.value})}
                                        className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium mb-1">Date <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="250708"
                                        value={newJobData.date}
                                        onChange={(e) => setNewJobData({...newJobData, date: e.target.value})}
                                        className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Format: YYMMDD</p>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium mb-1">Job Address <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="123 Main Street, Avalon"
                                        value={newJobData.address}
                                        onChange={(e) => setNewJobData({...newJobData, address: e.target.value})}
                                        className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Job Type <span className="text-red-500">*</span></label>
                                    <select
                                        value={newJobData.jobType}
                                        onChange={(e) => setNewJobData({...newJobData, jobType: e.target.value, customJobType: ''})}
                                        className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                    >
                                        <option value="survey_rpr">Survey & RPR</option>
                                        <option value="rpr">RPR</option>
                                        <option value="survey">Survey</option>
                                        <option value="building_construction">Building Construction</option>
                                        <option value="topo">Topo</option>
                                        <option value="subdivision">Subdivision</option>
                                        <option value="other">Other</option>
                                    </select>
                                    {newJobData.jobType === 'other' && (
                                        <input
                                            type="text"
                                            placeholder="Enter custom job type"
                                            value={newJobData.customJobType}
                                            onChange={(e) => setNewJobData({...newJobData, customJobType: e.target.value})}
                                            className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none mt-2"
                                        />
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Template (optional)</label>
                                    <select
                                        value={newJobData.template}
                                        onChange={(e) => setNewJobData({...newJobData, template: e.target.value})}
                                        className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                    >
                                        <option value="">No template</option>
                                        {templates.map(template => (
                                            <option key={template.name} value={template.name}>
                                                {template.name} ({template.files.join(', ')})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium mb-1">Reference Number (optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., PO-12345"
                                        value={newJobData.referenceNumber}
                                        onChange={(e) => setNewJobData({...newJobData, referenceNumber: e.target.value})}
                                        className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium mb-1">Description (optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Boundary survey for subdivision"
                                        value={newJobData.description}
                                        onChange={(e) => setNewJobData({...newJobData, description: e.target.value})}
                                        className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium mb-1">Operator (optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., John Smith"
                                        value={newJobData.operator}
                                        onChange={(e) => setNewJobData({...newJobData, operator: e.target.value})}
                                        className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                                
                                {/* Drop zone for job files */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">Job Files (optional)</label>
                                    <div
                                        className={`border-2 border-dashed rounded p-4 text-center transition-colors ${
                                            jobDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                                        }`}
                                        onDragEnter={handleJobDrag}
                                        onDragLeave={handleJobDrag}
                                        onDragOver={handleJobDrag}
                                        onDrop={handleJobDrop}
                                    >
                                        <Icon name="upload" className="w-6 h-6 mx-auto text-gray-400 mb-1" />
                                        <p className="text-xs text-gray-600">Drop CSV, DXF, or LandXML files here</p>
                                        <p className="text-xs text-gray-500">Files will be added to the job and linked in JXL</p>
                                    </div>
                                    
                                    {/* Show dropped files */}
                                    {jobFiles.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {jobFiles.map((file, index) => (
                                                <div key={index} className="flex items-center text-xs text-gray-600">
                                                    <Icon name="file" className="w-3 h-3 mr-1" />
                                                    <span className="flex-1">{file.name}</span>
                                                    <button
                                                        onClick={() => setJobFiles(prev => prev.filter((_, i) => i !== index))}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        <Icon name="x" className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="bg-gray-50 p-3 rounded text-sm">
                                    <p className="font-medium">Job folder will be created as:</p>
                                    <p className="text-gray-600 break-all">
                                        {newJobData.selectedPath || '[Select Folder]'}/{newJobData.jobNumber || '[Job Number]'}-{newJobData.date || '[Date]'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Fixed footer with buttons */}
                        <div className="p-6 pt-4 border-t bg-gray-50">
                            <div className="flex gap-3">
                                <button
                                    onClick={handleCreateJob}
                                    disabled={!newJobData.selectedPath || !newJobData.jobNumber || !newJobData.date || !newJobData.address}
                                    className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                                >
                                    Create Job
                                </button>
                                <button
                                    onClick={() => {
                                        setShowNewJobDialog(false);
                                        setNewJobData({ selectedPath: '', jobNumber: '', date: '', address: '', jobType: 'survey_rpr', customJobType: '', template: '', referenceNumber: '', description: '', operator: '' });
                                        setJobFiles([]);
                                    }}
                                    className="flex-1 py-2 border border-gray-300 rounded hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Field Status Form Dialog */}
            {showFieldStatusForm && (
                <div className="fixed inset-0 bg-red-900 bg-opacity-90 flex items-center justify-center p-4" style={{zIndex: 9999}}>
                    <div className="bg-yellow-300 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col" style={{border: '10px solid red'}}>
                    <div style={{padding: '20px', fontSize: '24px', fontWeight: 'bold', color: 'red'}}>
                        DEBUG: FORM IS RENDERING! If you see this, the form works.
                    </div>
                        {/* Fixed header */}
                        <div className="p-6 pb-4 border-b">
                            <h3 className="text-lg font-semibold">Field Work Status - {fieldStatusData.jobInfo?.jobNumber || 'Job'}</h3>
                            <p className="text-sm text-gray-600 mt-1">{fieldStatusData.jobInfo?.address}</p>
                        </div>

                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto p-6 pt-4">
                            <div className="space-y-4">
                                {/* Job Type - only show if missing from job_info.json */}
                                {!fieldStatusData.jobInfo?.jobType && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                                        <p className="text-sm text-yellow-800 mb-3">This job doesn't have a type set. Please select one:</p>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Job Type <span className="text-red-500">*</span></label>
                                            <select
                                                value={fieldStatusData.jobType}
                                                onChange={(e) => setFieldStatusData({...fieldStatusData, jobType: e.target.value, customJobType: ''})}
                                                className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                            >
                                                <option value="">Select job type...</option>
                                                <option value="survey_rpr">Survey & RPR</option>
                                                <option value="rpr">RPR</option>
                                                <option value="survey">Survey</option>
                                                <option value="building_construction">Building Construction</option>
                                                <option value="topo">Topo</option>
                                                <option value="subdivision">Subdivision</option>
                                                <option value="other">Other</option>
                                            </select>
                                            {fieldStatusData.jobType === 'other' && (
                                                <input
                                                    type="text"
                                                    placeholder="Enter custom job type"
                                                    value={fieldStatusData.customJobType}
                                                    onChange={(e) => setFieldStatusData({...fieldStatusData, customJobType: e.target.value})}
                                                    className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none mt-2"
                                                />
                                            )}
                                            <p className="text-xs text-gray-600 mt-2">This will be saved to the job for future uploads.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Operator */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">Operator <span className="text-red-500">*</span></label>
                                    <select
                                        value={fieldStatusData.operator}
                                        onChange={(e) => setFieldStatusData({...fieldStatusData, operator: e.target.value})}
                                        className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                    >
                                        <option value="Allan">Allan</option>
                                        <option value="Joe">Joe</option>
                                        <option value="Nick">Nick</option>
                                    </select>
                                </div>

                                {/* Upload Type - Radio Buttons */}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Upload Type <span className="text-red-500">*</span></label>
                                    <div className="space-y-2">
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="uploadType"
                                                value="intermediate"
                                                checked={fieldStatusData.uploadType === 'intermediate'}
                                                onChange={(e) => setFieldStatusData({...fieldStatusData, uploadType: e.target.value})}
                                                className="mr-2"
                                            />
                                            <span className="text-sm">Intermediate upload (sending data for review)</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="uploadType"
                                                value="complete"
                                                checked={fieldStatusData.uploadType === 'complete'}
                                                onChange={(e) => setFieldStatusData({...fieldStatusData, uploadType: e.target.value})}
                                                className="mr-2"
                                            />
                                            <span className="text-sm font-semibold">Complete upload (done for today)</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                name="uploadType"
                                                value="reupload"
                                                checked={fieldStatusData.uploadType === 'reupload'}
                                                onChange={(e) => setFieldStatusData({...fieldStatusData, uploadType: e.target.value})}
                                                className="mr-2"
                                            />
                                            <span className="text-sm">Re-upload (fix previous)</span>
                                        </label>
                                    </div>
                                </div>

                                {/* If re-upload, show dropdown of previous uploads */}
                                {fieldStatusData.uploadType === 'reupload' && fieldStatusData.jobInfo?.fieldDataUploads && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Which upload does this replace? <span className="text-red-500">*</span></label>
                                        <select
                                            value={fieldStatusData.replacesFolder}
                                            onChange={(e) => setFieldStatusData({...fieldStatusData, replacesFolder: e.target.value})}
                                            className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                        >
                                            <option value="">Select previous upload...</option>
                                            {fieldStatusData.jobInfo.fieldDataUploads.map((upload, idx) => (
                                                <option key={idx} value={upload.folder}>{upload.folder} - {new Date(upload.timestamp).toLocaleString()}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Show full form only for complete upload */}
                                {fieldStatusData.uploadType === 'complete' && (
                                    <>
                                        {/* Time on site */}
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Time on site <span className="text-red-500">*</span></label>
                                            <select
                                                value={fieldStatusData.timeOnSite}
                                                onChange={(e) => setFieldStatusData({...fieldStatusData, timeOnSite: e.target.value})}
                                                className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                            >
                                                <option value="">Select time...</option>
                                                <option value="0.5">0.5 hours</option>
                                                <option value="1">1 hour</option>
                                                <option value="1.5">1.5 hours</option>
                                                <option value="2">2 hours</option>
                                                <option value="2.5">2.5 hours</option>
                                                <option value="3">3 hours</option>
                                                <option value="3.5">3.5 hours</option>
                                                <option value="4">4 hours</option>
                                                <option value="4.5">4.5 hours</option>
                                                <option value="5">5 hours</option>
                                                <option value="5.5">5.5 hours</option>
                                                <option value="6">6 hours</option>
                                                <option value="6+">6+ hours</option>
                                            </select>
                                        </div>

                                        {/* Travel time one way */}
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Travel time one way <span className="text-red-500">*</span></label>
                                            <select
                                                value={fieldStatusData.travelTime}
                                                onChange={(e) => setFieldStatusData({...fieldStatusData, travelTime: e.target.value})}
                                                className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                            >
                                                <option value="">Select time...</option>
                                                <option value="0.25">15 min</option>
                                                <option value="0.5">30 min</option>
                                                <option value="0.75">45 min</option>
                                                <option value="1">1 hr</option>
                                                <option value="1.25">1.25 hr</option>
                                                <option value="1.5">1.5 hr</option>
                                                <option value="2">2 hr</option>
                                                <option value="2.5">2.5 hr</option>
                                                <option value="3">3 hr</option>
                                            </select>
                                        </div>

                                        {/* Field work completely done */}
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Field work completely done? <span className="text-red-500">*</span></label>
                                            <div className="flex gap-4">
                                                <label className="flex items-center">
                                                    <input
                                                        type="radio"
                                                        name="fieldWorkDone"
                                                        value="yes"
                                                        checked={fieldStatusData.fieldWorkDone === 'yes'}
                                                        onChange={(e) => setFieldStatusData({...fieldStatusData, fieldWorkDone: e.target.value})}
                                                        className="mr-2"
                                                    />
                                                    Yes
                                                </label>
                                                <label className="flex items-center">
                                                    <input
                                                        type="radio"
                                                        name="fieldWorkDone"
                                                        value="no"
                                                        checked={fieldStatusData.fieldWorkDone === 'no'}
                                                        onChange={(e) => setFieldStatusData({...fieldStatusData, fieldWorkDone: e.target.value})}
                                                        className="mr-2"
                                                    />
                                                    No
                                                </label>
                                            </div>
                                        </div>

                                        {/* If field work not done, show additional fields */}
                                        {fieldStatusData.fieldWorkDone === 'no' && (
                                            <>
                                                <div>
                                                    <label className="block text-sm font-medium mb-1">Estimated time to complete <span className="text-red-500">*</span></label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g., 2 hours"
                                                        value={fieldStatusData.estimatedTimeRemaining}
                                                        onChange={(e) => setFieldStatusData({...fieldStatusData, estimatedTimeRemaining: e.target.value})}
                                                        className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium mb-1">Notes / What's left to do <span className="text-red-500">*</span></label>
                                                    <textarea
                                                        placeholder="Describe what still needs to be completed..."
                                                        value={fieldStatusData.notesWhatLeft}
                                                        onChange={(e) => setFieldStatusData({...fieldStatusData, notesWhatLeft: e.target.value})}
                                                        className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                                        rows="3"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {/* Pins questions - conditional based on job type */}
                                        {(() => {
                                            const currentJobType = fieldStatusData.jobInfo?.jobType || fieldStatusData.jobType;
                                            return currentJobType && JOB_TYPE_CONFIG[currentJobType]?.asks_pins_found && (
                                                <div>
                                                    <label className="block text-sm font-medium mb-1">Pins found?</label>
                                                    <select
                                                        value={fieldStatusData.pinsFound}
                                                        onChange={(e) => setFieldStatusData({...fieldStatusData, pinsFound: e.target.value})}
                                                        className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                                    >
                                                        <option value="">Select...</option>
                                                        <option value="yes">Yes</option>
                                                        <option value="no">No</option>
                                                        <option value="partial">Partial</option>
                                                        <option value="n/a">N/A</option>
                                                    </select>
                                                </div>
                                            );
                                        })()}

                                        {(() => {
                                            const currentJobType = fieldStatusData.jobInfo?.jobType || fieldStatusData.jobType;
                                            return currentJobType && JOB_TYPE_CONFIG[currentJobType]?.asks_pins_placed && (
                                                <div>
                                                    <label className="block text-sm font-medium mb-1">Pins placed?</label>
                                                    <select
                                                        value={fieldStatusData.pinsPlaced}
                                                        onChange={(e) => setFieldStatusData({...fieldStatusData, pinsPlaced: e.target.value})}
                                                        className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                                    >
                                                        <option value="">Select...</option>
                                                        <option value="yes">Yes</option>
                                                        <option value="no">No</option>
                                                        <option value="partial">Partial</option>
                                                        <option value="n/a">N/A</option>
                                                    </select>
                                                </div>
                                            );
                                        })()}

                                        {/* Construction checklist - only for building construction */}
                                        {(fieldStatusData.jobInfo?.jobType === 'building_construction' || fieldStatusData.jobType === 'building_construction') && (
                                            <div>
                                                <label className="block text-sm font-medium mb-2">Tasks completed this visit:</label>
                                                <div className="space-y-2 pl-2">
                                                    {['excavation_layout', 'topographic_survey', 'footing_placement', 'building_placement', 'rpr_foundation', 'rpr_all_features', 'final_grading'].map((task) => (
                                                        <label key={task} className="flex items-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={fieldStatusData.constructionTasks.includes(task)}
                                                                onChange={(e) => {
                                                                    const newTasks = e.target.checked
                                                                        ? [...fieldStatusData.constructionTasks, task]
                                                                        : fieldStatusData.constructionTasks.filter(t => t !== task);
                                                                    setFieldStatusData({...fieldStatusData, constructionTasks: newTasks});
                                                                }}
                                                                className="mr-2"
                                                            />
                                                            <span className="text-sm">{task.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                                                        </label>
                                                    ))}
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1 mt-2">Other tasks:</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g., Septic layout"
                                                            value={fieldStatusData.customTasks}
                                                            onChange={(e) => setFieldStatusData({...fieldStatusData, customTasks: e.target.value})}
                                                            className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Notes field - shown for intermediate and complete uploads */}
                                {(fieldStatusData.uploadType === 'intermediate' || fieldStatusData.uploadType === 'complete') && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Notes {fieldStatusData.uploadType === 'intermediate' ? '(optional)' : ''}</label>
                                        <textarea
                                            placeholder={fieldStatusData.uploadType === 'intermediate' ? "Any notes about this data..." : "Any additional notes about this visit..."}
                                            value={fieldStatusData.notes}
                                            onChange={(e) => setFieldStatusData({...fieldStatusData, notes: e.target.value})}
                                            className="w-full px-3 py-2 border rounded focus:border-blue-500 focus:outline-none"
                                            rows="3"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Fixed footer with buttons */}
                        <div className="p-6 pt-4 border-t bg-gray-50">
                            <div className="flex gap-3">
                                <button
                                    onClick={handleFieldStatusSubmit}
                                    className="flex-1 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                                >
                                    Upload Field Data
                                </button>
                                <button
                                    onClick={() => setShowFieldStatusForm(false)}
                                    className="flex-1 py-2 border border-gray-300 rounded hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Render the app
ReactDOM.render(<TrimbleSyncPortal />, document.getElementById('root'));