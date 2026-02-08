"""
Process Pending Jobs - Generates JXL and JOB files for jobs created on the NAS

This script runs on Windows and processes any jobs that have jxl_generation_info.json files,
generating the actual JXL and JOB files using the Trimble converter.
"""

import os
import json
import subprocess
from pathlib import Path
import sys

# Add the trimble-converter directory to the path
sys.path.insert(0, str(Path(__file__).parent / 'trimble-converter'))
from jxl_generator import JXLGenerator

# Configuration
OFFICE_ROOT = Path(r"Z:\Data Sync\office-jobs")
TEMPLATES_ROOT = Path(r"Z:\Data Sync\templates")
CONVERTER_PATH = Path(__file__).parent / "trimble-converter" / "JobConversion" / "TrimbleAccess.JobConverter.ConverterProcess.exe"
CONVERTER_DIR = Path(__file__).parent / "trimble-converter" / "JobConversion"
GEODATA_DIR = Path(__file__).parent / "trimble-converter" / "geodata"

def find_pending_jobs():
    """Find all jobs with pending JXL generation."""
    pending_jobs = []
    
    for root, dirs, files in os.walk(OFFICE_ROOT):
        if 'jxl_generation_info.json' in files:
            info_path = Path(root) / 'jxl_generation_info.json'
            with open(info_path, 'r') as f:
                info = json.load(f)
                info['path'] = root
                info['info_file'] = str(info_path)
                pending_jobs.append(info)
    
    return pending_jobs

def generate_jxl(job_info, job_path):
    """Generate JXL file for a job."""
    generator = JXLGenerator()
    
    # Get reference JXL from template
    reference_jxl_path = ""
    if job_info.get('template'):
        template_path = TEMPLATES_ROOT / job_info['template']
        if template_path.exists():
            for file in template_path.glob('*.jxl'):
                reference_jxl_path = str(file)
                break
    
    if not reference_jxl_path:
        print(f"Warning: No reference JXL found for template {job_info.get('template')}")
        return None
    
    # Generate JXL
    jxl_content = generator.generate_jxl(
        job_name=job_info['jobName'],
        reference_jxl_path=reference_jxl_path,
        reference=job_info.get('referenceNumber', ''),
        description=job_info.get('description', ''),
        operator=job_info.get('operator', ''),
        job_note=job_info.get('address', ''),
        csv_files=[f for f in job_info.get('linkedFiles', []) if f.lower().endswith('.csv')],
        dxf_files=[f for f in job_info.get('linkedFiles', []) if f.lower().endswith('.dxf')],
        landxml_files=[f for f in job_info.get('linkedFiles', []) if f.lower().endswith('.xml') or f.lower().endswith('.landxml')]
    )
    
    # Save JXL
    jxl_path = Path(job_path) / f"{job_info['jobName']}.jxl"
    generator.save_jxl(jxl_content, jxl_path)
    
    return jxl_path

def convert_jxl_to_job(jxl_path, job_name, job_path):
    """Convert JXL to JOB using Trimble converter."""
    job_file_path = Path(job_path) / f"{job_name}.job"
    
    # Create geodata directory
    GEODATA_DIR.mkdir(exist_ok=True)
    
    cmd = [
        str(CONVERTER_PATH),
        "--command=jxl-to-job",
        f"--inPath={jxl_path}",
        f"--outPath={job_file_path}",
        f"--convertersPath={CONVERTER_DIR}",
        f"--geodataPath={GEODATA_DIR}"
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(CONVERTER_DIR))
    
    if result.returncode == 0 and job_file_path.exists():
        return job_file_path
    else:
        print(f"Converter error: {result.stderr}")
        return None

def main():
    print("Trimble Job File Processor")
    print("=" * 60)
    
    # Find pending jobs
    pending_jobs = find_pending_jobs()
    print(f"Found {len(pending_jobs)} pending jobs\n")
    
    if not pending_jobs:
        print("No pending jobs to process.")
        return
    
    success_count = 0
    
    for i, job in enumerate(pending_jobs, 1):
        print(f"[{i}/{len(pending_jobs)}] Processing {job['jobName']}...")
        
        try:
            # Generate JXL
            jxl_path = generate_jxl(job, job['path'])
            if not jxl_path:
                print("  ❌ Failed to generate JXL")
                continue
            
            print(f"  ✓ Generated JXL: {jxl_path.name}")
            
            # Convert to JOB
            job_path = convert_jxl_to_job(jxl_path, job['jobName'], job['path'])
            if job_path:
                print(f"  ✓ Generated JOB: {job_path.name}")
                
                # Update status
                job['status'] = 'completed'
                with open(job['info_file'], 'w') as f:
                    json.dump(job, f, indent=2)
                
                # Optionally delete the info file after successful processing
                # os.remove(job['info_file'])
                
                success_count += 1
            else:
                print("  ❌ Failed to generate JOB")
                
        except Exception as e:
            print(f"  ❌ Error: {str(e)}")
    
    print("\n" + "=" * 60)
    print(f"Processing complete: {success_count}/{len(pending_jobs)} successful")

if __name__ == "__main__":
    main()