import subprocess
import os
from pathlib import Path

# TODO: SERVER INTEGRATION
# When integrated into the server:
# 1. JOB_FILES_DIR should be the selected project directory
# 2. OUTPUT_DIR should also be the selected project directory (convert in-place)
# 3. The server will provide these paths dynamically
# 
# Example server integration:
# JOB_FILES_DIR = server_provided_project_path
# OUTPUT_DIR = server_provided_project_path

# Paths
CONVERTER_PATH = r"C:\Users\pardy\Documents\Coding\Trimble_Converter\Trimble_Sync_Manager\JobConversion\TrimbleAccess.JobConverter.ConverterProcess.exe"
CONVERTER_DIR = r"C:\Users\pardy\Documents\Coding\Trimble_Converter\Trimble_Sync_Manager\JobConversion"
JOB_FILES_DIR = r"C:\Users\pardy\Documents\Coding\Trimble_Converter_Rebuild\Job_Files"  # Local testing directory
GEODATA_DIR = r"C:\Users\pardy\Documents\Coding\Trimble_Converter_Rebuild\geodata"
OUTPUT_DIR = r"C:\Users\pardy\Documents\Coding\Trimble_Converter_Rebuild\converted_jobs"  # Local testing directory

# Create directories
os.makedirs(GEODATA_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

def convert_jxl_to_job(jxl_file, output_file):
    """Convert a single JXL file to JOB format"""
    cmd = [
        CONVERTER_PATH,
        "--command=jxl-to-job",
        f"--inPath={jxl_file}",
        f"--outPath={output_file}",
        f"--convertersPath={CONVERTER_DIR}",
        f"--geodataPath={GEODATA_DIR}"
    ]
    
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=os.path.dirname(CONVERTER_PATH)
    )
    
    return result.returncode == 0, result.stdout, result.stderr

def main():
    print("Batch JXL to JOB Converter")
    print("=" * 60)
    
    # Get all JXL files
    jxl_files = list(Path(JOB_FILES_DIR).glob("*.jxl"))
    print(f"Found {len(jxl_files)} JXL files to convert\n")
    
    success_count = 0
    failed_files = []
    
    # Process each file
    for i, jxl_file in enumerate(jxl_files, 1):
        print(f"[{i}/{len(jxl_files)}] Converting {jxl_file.name}...", end=" ")
        
        # Output path - use original name but with .job extension
        # TODO: SERVER INTEGRATION - In production, save to same directory as source file
        # output_file = jxl_file.parent / jxl_file.name.replace('.jxl', '.job')
        output_file = Path(OUTPUT_DIR) / jxl_file.name.replace('.jxl', '.job')
        
        # Convert
        success, stdout, stderr = convert_jxl_to_job(jxl_file, output_file)
        
        if success and output_file.exists():
            file_size = output_file.stat().st_size
            print(f"SUCCESS ({file_size} bytes)")
            success_count += 1
        else:
            print("FAILED")
            if stderr:
                print(f"     Error: {stderr.strip()}")
            failed_files.append(jxl_file.name)
    
    # Summary
    print("\n" + "=" * 60)
    print("CONVERSION COMPLETE")
    print("=" * 60)
    print(f"Total files: {len(jxl_files)}")
    print(f"Successful: {success_count}")
    print(f"Failed: {len(failed_files)}")
    
    if failed_files:
        print("\nFailed files:")
        for f in failed_files:
            print(f"  - {f}")
    
    print(f"\nConverted files saved to: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()