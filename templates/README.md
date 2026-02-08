# Template Folder Structure

Each template should be a folder containing the files you want to copy to new jobs.

## Example Structure:

```
templates/
├── standard/
│   ├── TMNT Z1.jxl
│   └── Control Avalon.csv
├── asbuilt/
│   ├── TMNT Z1.jxl
│   ├── Control Avalon.csv
│   └── codes.fxl
├── topo/
│   ├── TMNT Z1.jxl
│   ├── Control Avalon.csv
│   └── topo_codes.fxl
└── stakeout/
    ├── TMNT Z1.jxl
    ├── Control Avalon.csv
    ├── stakes.csv
    └── alignment.dxf
```

## How it works:

1. Create a folder for each template type (e.g., "standard", "asbuilt", etc.)
2. Place your template files in each folder
3. When creating a job, select the template you want
4. All files from that template folder will be copied to the new job

## File Handling:

- **JXL files**: Will be renamed to match the job (e.g., 25-123-layout-250708.jxl)
- **Control CSV files**: Will be renamed with the date (e.g., Control Avalon 250708.csv)
- **Other files**: Copied as-is

## To add a new template:

1. Create a new folder in templates/
2. Copy your template files into it
3. The template will automatically appear in the job creation dialog