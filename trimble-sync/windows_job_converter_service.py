"""
Windows JOB Converter Service
Runs on Windows and provides HTTP API for JOB conversion
"""

import os
import subprocess
import tempfile
import shutil
from flask import Flask, request, jsonify, send_file
from pathlib import Path

app = Flask(__name__)

# Configuration - UPDATE THESE PATHS
CONVERTER_PATH = r"Z:\Data Sync\trimble-sync\trimble-converter\JobConversion\TrimbleAccess.JobConverter.ConverterProcess.exe"
CONVERTER_DIR = r"Z:\Data Sync\trimble-sync\trimble-converter\JobConversion"
GEODATA_DIR = r"Z:\Data Sync\trimble-sync\trimble-converter\geodata"

@app.route('/convert', methods=['POST'])
def convert_jxl_to_job():
    """Convert JXL to JOB file"""
    try:
        # Get JXL content from request
        jxl_content = request.data
        
        # Create temp files
        with tempfile.NamedTemporaryFile(suffix='.jxl', delete=False) as tmp_jxl:
            tmp_jxl.write(jxl_content)
            jxl_path = tmp_jxl.name
        
        job_path = jxl_path.replace('.jxl', '.job')
        
        # Run converter
        cmd = [
            CONVERTER_PATH,
            "--command=jxl-to-job",
            f"--inPath={jxl_path}",
            f"--outPath={job_path}",
            f"--convertersPath={CONVERTER_DIR}",
            f"--geodataPath={GEODATA_DIR}"
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=CONVERTER_DIR
        )
        
        if result.returncode == 0 and os.path.exists(job_path):
            # Read JOB file and return it
            with open(job_path, 'rb') as f:
                job_content = f.read()
            
            # Cleanup
            os.unlink(jxl_path)
            os.unlink(job_path)
            
            return job_content, 200, {'Content-Type': 'application/octet-stream'}
        else:
            # Cleanup
            os.unlink(jxl_path)
            if os.path.exists(job_path):
                os.unlink(job_path)
            
            return jsonify({
                'error': 'Conversion failed',
                'stdout': result.stdout,
                'stderr': result.stderr,
                'returncode': result.returncode
            }), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'converter_exists': os.path.exists(CONVERTER_PATH)})

if __name__ == '__main__':
    # Create geodata directory if it doesn't exist
    os.makedirs(GEODATA_DIR, exist_ok=True)
    
    print(f"Starting Windows JOB Converter Service...")
    print(f"Converter: {CONVERTER_PATH}")
    print(f"Listening on http://localhost:5000")
    
    app.run(host='0.0.0.0', port=5000)