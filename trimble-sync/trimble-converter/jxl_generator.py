"""
JXL Generator - Hardcoded Template with Dynamic Content Insertion

This module generates JXL files using a hardcoded template structure that matches
Trimble Access format exactly. It has specific insertion points for:

1. Coordinate system data (extracted from uploaded reference JXL)
2. File references (CSV files → LinkedFiles, DXF/LandXML → ActiveMapFiles)
3. UI field values (Reference, Description, Operator, JobNote, TimeZone)

The template structure is reverse-engineered from Trimble Access output to ensure
consistent byte-perfect formatting regardless of input variations.

SERVER INTEGRATION NOTES:
=======================
File paths are currently hardcoded to: /storage/emulated/0/Trimble Data/Projects/Testing/

When integrating with server:
1. Update PROJECT_FOLDER constant to match server project structure
2. Ensure uploaded files are copied to corresponding device location
3. Path format: /storage/emulated/0/Trimble Data/Projects/{project_name}/filename
"""

import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
import re


class JXLGenerator:
    
    # TODO: SERVER INTEGRATION - Dynamic project folder
    # When integrated into the server:
    # 1. PROJECT_FOLDER should be dynamically set from the selected project
    # 2. The server will pass the project name/path as a parameter
    # 3. Update BASE_PATH to use the dynamic project folder
    # Example: PROJECT_FOLDER = project_name_from_server
    PROJECT_FOLDER = "Testing"  # Default for local testing
    BASE_PATH = f"/storage/emulated/0/Trimble Data/Projects/{PROJECT_FOLDER}"
    
    # Hardcoded constants from Trimble Access
    CONTROLLER_SERIAL = "JAJ215020019"
    PRODUCT_VERSION = "25.10"
    PRODUCT_DB_VERSION = "2510-3"
    ORIGINAL_PRODUCT_VERSION = "2025.11 (25.10.118)"
    
    def __init__(self):
        """Initialize JXL Generator with hardcoded template structure."""
        self.id_counter = 2  # Trimble starts IDs at 00000002
        self.timestamp = self._get_timestamp()
    
    def generate_jxl(self, job_name, reference_jxl_path, reference="", description="", 
                     operator="", job_note="", timezone_name="NDT", hours_to_utc="2.5",
                     csv_files=None, dxf_files=None, landxml_files=None, project_folder=None):
        """
        Generate JXL file with hardcoded structure and dynamic content.
        
        Args:
            job_name: Name for the job
            reference_jxl_path: Path to JXL file for coordinate system data
            reference: Reference field value
            description: Description field value
            operator: Operator field value
            job_note: Job note field value
            timezone_name: Time zone name (e.g., "NDT", "EST")
            hours_to_utc: Hours offset to UTC (e.g., "2.5", "-5.0")
            csv_files: List of CSV file names
            dxf_files: List of DXF file names
            landxml_files: List of LandXML file names
            project_folder: The project folder name (e.g., "25-123-250708")
            
        Returns:
            str: Generated JXL content
        """
        
        # Reset for each generation
        self.id_counter = 2
        self.timestamp = self._get_timestamp()
        
        # Update BASE_PATH if project_folder is provided
        if project_folder:
            self.BASE_PATH = f"/storage/emulated/0/Trimble Data/Projects/{project_folder}"
        else:
            # Keep the default BASE_PATH from class definition
            self.BASE_PATH = f"/storage/emulated/0/Trimble Data/Projects/{self.PROJECT_FOLDER}"
        
        # Process file lists
        csv_files = csv_files or []
        dxf_files = dxf_files or []
        landxml_files = landxml_files or []
        map_files = dxf_files + landxml_files
        
        # Extract coordinate system from reference JXL
        coord_data = self._extract_coordinate_system(reference_jxl_path)
        
        # Build JXL content using hardcoded template
        content = self._build_jxl_structure(
            job_name=job_name,
            coord_data=coord_data,
            reference=reference,
            description=description,
            operator=operator,
            job_note=job_note,
            timezone_name=timezone_name,
            hours_to_utc=hours_to_utc,
            csv_files=csv_files,
            map_files=map_files
        )
        
        return content
    
    def save_jxl(self, content, output_path):
        """
        Save JXL content to file.
        
        TODO: SERVER INTEGRATION
        When integrated into the server, output_path should be:
        - {selected_project_directory}/{job_name}.jxl
        
        The server will provide the full path to the project directory.
        """
        output_path = Path(output_path)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return output_path
    
    def _get_timestamp(self):
        """Get current timestamp in JXL format."""
        return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    
    def _get_next_id(self):
        """Get next sequential hex ID."""
        id_str = f"{self.id_counter:08x}"
        self.id_counter += 1
        return id_str
    
    def _extract_coordinate_system(self, reference_jxl_path):
        """
        Extract coordinate system data from reference JXL file.
        
        Returns dict with coordinate system components that can be inserted
        into the hardcoded template at specific points.
        """
        if not reference_jxl_path:
            return self._get_default_coordinate_system()
        
        # Convert to Path and check if it exists
        jxl_path = Path(reference_jxl_path)
        if not jxl_path.exists():
            # Try looking in the same directory as this script
            script_dir = Path(__file__).parent
            jxl_path = script_dir / Path(reference_jxl_path).name
            if not jxl_path.exists():
                print(f"Warning: Reference JXL not found at {reference_jxl_path} or {jxl_path}")
                return self._get_default_coordinate_system()
        
        try:
            tree = ET.parse(jxl_path)
            root = tree.getroot()
            
            fieldbook = root.find("FieldBook")
            environment = root.find("Environment")
            
            if not fieldbook or not environment:
                return self._get_default_coordinate_system()
            
            # Extract coordinate system records from FieldBook
            coord_data = {
                'units_record': self._extract_record(fieldbook, 'UnitsRecord'),
                'ellipsoid_record': self._extract_record(fieldbook, 'EllipsoidRecord'),
                'projection_record': self._extract_record(fieldbook, 'ProjectionRecord'),
                'datum_record': self._extract_record(fieldbook, 'DatumRecord'),
                'displacement_models_record': self._extract_record(fieldbook, 'DisplacementModelsRecord'),
                'kinematic_transformations_record': self._extract_record(fieldbook, 'KinematicTransformationsRecord'),
                'reference_frame_transformations_record': self._extract_record(fieldbook, 'ReferenceFrameTransformationsRecord'),
                'horizontal_adjustment_record': self._extract_record(fieldbook, 'HorizontalAdjustmentRecord'),
                'vertical_adjustment_record': self._extract_record(fieldbook, 'VerticalAdjustmentRecord'),
                'coordinate_system_record': self._extract_record(fieldbook, 'CoordinateSystemRecord'),
                'feature_coding_records': self._extract_multiple_records(fieldbook, 'FeatureCodingRecord'),
                'corrections_records': self._extract_multiple_records(fieldbook, 'CorrectionsRecord'),
                'note_records': self._extract_multiple_records(fieldbook, 'NoteRecord'),
                
                # Extract ZoneID from CoordinateSystemRecord
                'zone_id': self._extract_zone_id(fieldbook),
                
                # Environment section data
                'env_coordinate_system': self._extract_element_content(environment, 'CoordinateSystem'),
                'env_display_settings': self._extract_element_content(environment, 'DisplaySettings'),
                'env_job_settings': self._extract_element_content(environment, 'JobSettings'),
                'env_job_properties': self._extract_element_content(environment, 'JobProperties'),
                'env_timezone': self._extract_element_content(environment, 'TimeZone')
            }
            
            return coord_data
            
        except Exception as e:
            print(f"Error extracting coordinate system from {jxl_path}: {e}")
            return self._get_default_coordinate_system()
    
    def _extract_record(self, parent, record_type):
        """Extract a single record and return its inner XML content."""
        records = parent.findall(record_type)
        if not records:
            return ""
        
        # Use the most recent record (last one) if multiple exist
        record = records[-1]
        return self._element_to_string_content(record)
    
    def _extract_multiple_records(self, parent, record_type):
        """Extract multiple records of the same type."""
        records = parent.findall(record_type)
        return [self._element_to_string_content(record) for record in records]
    
    def _extract_element_content(self, parent, element_name):
        """Extract element content from parent."""
        element = parent.find(element_name)
        if element is None:
            return ""
        return self._element_to_string_content(element)
    
    def _extract_zone_id(self, fieldbook):
        """Extract ZoneID value from CoordinateSystemRecord."""
        coord_record = fieldbook.find('CoordinateSystemRecord')
        if coord_record is not None:
            zone_id_elem = coord_record.find('ZoneID')
            if zone_id_elem is not None and zone_id_elem.text:
                return zone_id_elem.text.strip()
        return ""
    
    def _element_to_string_content(self, element, indent_level=3):
        """Convert element to properly formatted string content."""
        # Remove ID and TimeStamp attributes - we'll regenerate these
        if 'ID' in element.attrib:
            del element.attrib['ID']
        if 'TimeStamp' in element.attrib:
            del element.attrib['TimeStamp']
        
        # Convert to string and get only inner content (no wrapper tags)
        content = ET.tostring(element, encoding='unicode', method='xml')
        
        # Extract inner content between the element tags to prevent duplicates
        tag_name = element.tag
        start_tag = f"<{tag_name}"
        end_tag = f"</{tag_name}>"
        
        # Find the end of the opening tag
        opening_end = content.find('>')
        if opening_end != -1:
            # Extract content between opening and closing tags
            inner_content = content[opening_end + 1:content.rfind(end_tag)]
            content = inner_content.strip()
        
        # Pretty format with proper Trimble Access indentation
        content = self._format_xml_content(content, indent_level)
        
        return content
    
    def _format_xml_content(self, content, base_indent_level=3):
        """Format XML content with proper Trimble Access indentation."""
        lines = content.split('\n')
        formatted_lines = []
        current_indent = 0
        base_spaces = "    " * base_indent_level  # 4 spaces per level
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Fix empty element formatting - remove space before />
            line = line.replace(' />', '/>')
            
            # Decrease indent for closing tags
            if line.startswith('</'):
                current_indent -= 1
            
            # Add proper indentation
            if current_indent > 0:
                formatted_lines.append("    " * current_indent + line)
            else:
                formatted_lines.append(line)
            
            # Increase indent for opening tags (not self-closing)
            if line.startswith('<') and not line.startswith('</') and not line.endswith('/>'):
                current_indent += 1
        
        return '\n'.join(formatted_lines)
    
    def _format_nested_content(self, content, base_indent=3):
        """Format nested XML content with proper Trimble Access indentation."""
        lines = content.split('\n')
        formatted_lines = []
        indent_level = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Fix empty element formatting
            line = line.replace(' />', '/>')
            
            # Handle closing tags
            if line.startswith('</'):
                indent_level -= 1
            
            # Apply indentation
            formatted_lines.append("    " * indent_level + line)
            
            # Handle opening tags
            if line.startswith('<') and not line.startswith('</') and not line.endswith('/>'):
                indent_level += 1
        
        return '\n'.join(formatted_lines)
    
    def _get_default_coordinate_system(self):
        """Return default coordinate system data if reference JXL unavailable."""
        return {
            'units_record': """<DistanceUnits>Metres</DistanceUnits>
            <HeightUnits>Metres</HeightUnits>
            <AngleUnits>DMSDegrees</AngleUnits>
            <AzimuthFormat>Azimuth</AzimuthFormat>
            <LatitudeLongitudeUnits>DMSDegrees</LatitudeLongitudeUnits>
            <CoordinateOrder>North-East-Elevation</CoordinateOrder>
            <TemperatureUnits>Celsius</TemperatureUnits>
            <PressureUnits>MilliBar</PressureUnits>
            <GradeUnits>Percentage</GradeUnits>
            <AreaUnits>SquareMetres</AreaUnits>
            <VolumeUnits>CubicMetres</VolumeUnits>
            <StationingFormat>1+000.0</StationingFormat>
            <StationIndexIncrement/>
            <PrecisionUnits>1Sigma</PrecisionUnits>
            <DistanceDisplayDPs>3</DistanceDisplayDPs>
            <CoordinateDisplayDPs>3</CoordinateDisplayDPs>
            <AreaDisplayDPs>3</AreaDisplayDPs>
            <VolumeDisplayDPs>3</VolumeDisplayDPs>
            <AngleDisplayDPs>0</AngleDisplayDPs>
            <LaserVADisplay>Inclination</LaserVADisplay>
            <TimeFormat>Local</TimeFormat>
            <MassUnits>Kilograms</MassUnits>
            <MassDisplayDPs>3</MassDisplayDPs>""",
            
            'coordinate_system_record': """<SystemName>Default System</SystemName>
            <ZoneName>Default Zone</ZoneName>
            <DatumName>Default Datum</DatumName>
            <ZoneID/>
            <ProjectedCoordinateReferenceSystemEPSG/>
            <CompoundCoordinateReferenceSystemEPSG/>""",
            
            # Add other default components as needed
            'ellipsoid_record': "",
            'projection_record': "",
            'datum_record': "",
            'displacement_models_record': "",
            'kinematic_transformations_record': "",
            'reference_frame_transformations_record': "",
            'horizontal_adjustment_record': "",
            'vertical_adjustment_record': "",
            'feature_coding_records': [],
            'corrections_records': [],
            'env_coordinate_system': "",
            'env_display_settings': "",
            'env_job_settings': ""
        }
    
    def _build_jxl_structure(self, job_name, coord_data, reference, description, 
                           operator, job_note, timezone_name, hours_to_utc, 
                           csv_files, map_files):
        """
        Build the complete JXL structure using hardcoded template with dynamic insertions.
        """
        
        # Start building the JXL content with exact formatting
        lines = []
        
        # XML Declaration and root element (exact format from Trimble Access)
        lines.extend([
            '<?xml version="1.0" encoding="utf-8"?>',
            f'<JOBFile xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" jobName="{job_name}" version="6.32" product="Trimble Access" productVersion="{self.PRODUCT_VERSION}" productDBVersion="{self.PRODUCT_DB_VERSION}" controllerSerialNumber="{self.CONTROLLER_SERIAL}" originalProductVersion="{self.ORIGINAL_PRODUCT_VERSION}" linkedProjectId="" TimeStamp="{self.timestamp}" xsi:schemaLocation="http://www.trimble.com/schema/JobXML/6_3 http://www.trimble.com/schema/JobXML/6_3/JobXMLSchema-6.32.xsd">',
            '    <FieldBook>'
        ])
        
        # Insert coordinate system records with proper formatting and IDs
        self._add_coordinate_records(lines, coord_data)
        
        # Add file reference records
        self._add_file_records(lines, csv_files, map_files)
        
        # Add job properties and other required records
        self._add_job_properties_record(lines, reference, description, operator, job_note)
        self._add_timezone_record(lines, timezone_name, hours_to_utc)
        
        # Add DUPLICATE coordinate system records (as Trimble Access does after conversions)
        # This is critical for the converter to recognize the coordinate system
        self._add_duplicate_coordinate_records(lines, coord_data)
        
        # Close FieldBook
        lines.extend([
            '    </FieldBook>',
            '',
            '    <Reductions/>',
            '',
            '    <Environment>'
        ])
        
        # Add Environment section
        self._add_environment_section(lines, coord_data, reference, description, 
                                    operator, job_note, timezone_name, hours_to_utc, 
                                    csv_files, map_files)
        
        # Close JOBFile
        lines.extend([
            '    </Environment>',
            '</JOBFile>'
        ])
        
        return '\n'.join(lines) + '\n'
    
    def _add_coordinate_records(self, lines, coord_data):
        """Add coordinate system records to FieldBook section."""
        
        # Add blank line before first record
        lines.append('')
        
        # UnitsRecord
        if coord_data.get('units_record'):
            lines.append(f'        <UnitsRecord ID="{self._get_next_id()}" TimeStamp="{self.timestamp}">')
            # Insert coordinate system content with proper indentation
            content_lines = coord_data['units_record'].split('\n')
            for content_line in content_lines:
                if content_line.strip():
                    lines.append(f'            {content_line.strip()}')
            lines.append('        </UnitsRecord>')
            lines.append('')
        
        # Add other coordinate records similarly
        record_types = [
            ('ellipsoid_record', 'EllipsoidRecord'),
            ('projection_record', 'ProjectionRecord'), 
            ('datum_record', 'DatumRecord'),
            ('displacement_models_record', 'DisplacementModelsRecord'),
            ('kinematic_transformations_record', 'KinematicTransformationsRecord'),
            ('reference_frame_transformations_record', 'ReferenceFrameTransformationsRecord'),
            ('horizontal_adjustment_record', 'HorizontalAdjustmentRecord'),
            ('vertical_adjustment_record', 'VerticalAdjustmentRecord'),
            ('coordinate_system_record', 'CoordinateSystemRecord')
        ]
        
        for data_key, record_name in record_types:
            content = coord_data.get(data_key, '')
            if content:
                lines.append(f'        <{record_name} ID="{self._get_next_id()}" TimeStamp="{self.timestamp}">')
                content_lines = content.split('\n')
                for content_line in content_lines:
                    if content_line.strip():
                        # Special handling for CoordinateSystemRecord to inject ZoneID
                        if record_name == 'CoordinateSystemRecord' and '<ZoneID/>' in content_line:
                            zone_id = coord_data.get('zone_id', '')
                            if zone_id:
                                lines.append(f'            <ZoneID>{zone_id}</ZoneID>')
                            else:
                                lines.append(f'            {content_line.strip()}')
                        # Skip ReferenceGlobalFrameID - it should NOT be in the output
                        elif 'ReferenceGlobalFrameID' in content_line:
                            continue  # Skip this element entirely
                        # Preserve original coordinate system data from reference JXL
                        else:
                            lines.append(f'            {content_line.strip()}')
                lines.append(f'        </{record_name}>')
                lines.append('')
        
        # Add feature coding records (multiple)
        for feature_record in coord_data.get('feature_coding_records', []):
            if feature_record:
                lines.append(f'        <FeatureCodingRecord ID="{self._get_next_id()}" TimeStamp="{self.timestamp}">')
                content_lines = feature_record.split('\n')
                for content_line in content_lines:
                    if content_line.strip():
                        lines.append(f'            {content_line.strip()}')
                lines.append('        </FeatureCodingRecord>')
                lines.append('')
        
        # Add corrections records (multiple)
        for corrections_record in coord_data.get('corrections_records', []):
            if corrections_record:
                lines.append(f'        <CorrectionsRecord ID="{self._get_next_id()}" TimeStamp="{self.timestamp}">')
                content_lines = corrections_record.split('\n')
                for content_line in content_lines:
                    if content_line.strip():
                        lines.append(f'            {content_line.strip()}')
                lines.append('        </CorrectionsRecord>')
                lines.append('')
        
        # Add note records (multiple) - preserve from reference JXL
        for note_record in coord_data.get('note_records', []):
            if note_record:
                lines.append(f'        <NoteRecord ID="{self._get_next_id()}" TimeStamp="{self.timestamp}">')
                content_lines = note_record.split('\n')
                for content_line in content_lines:
                    if content_line.strip():
                        lines.append(f'            {content_line.strip()}')
                lines.append('        </NoteRecord>')
                lines.append('')
    
    def _add_file_records(self, lines, csv_files, map_files):
        """Add file reference records."""
        
        # LinkedFilesRecord for CSV files
        if csv_files:
            lines.append(f'        <LinkedFilesRecord ID="{self._get_next_id()}" TimeStamp="{self.timestamp}">')
            for csv_file in csv_files:
                # Use full path format matching Trimble Access
                filename = Path(csv_file).name
                full_path = f"{self.BASE_PATH}/{filename}"
                lines.append(f'            <File>{full_path}</File>')
            lines.append('        </LinkedFilesRecord>')
        else:
            lines.append(f'        <LinkedFilesRecord ID="{self._get_next_id()}" TimeStamp="{self.timestamp}"/>')
        lines.append('')
        
        # ActiveMapFilesRecord for DXF/LandXML files
        if map_files:
            lines.append(f'        <ActiveMapFilesRecord ID="{self._get_next_id()}" TimeStamp="{self.timestamp}">')
            for map_file in map_files:
                # Use full path format matching Trimble Access
                filename = Path(map_file).name
                full_path = f"{self.BASE_PATH}/{filename}"
                lines.append(f'            <File Selectable="true">{full_path}</File>')
            lines.append('        </ActiveMapFilesRecord>')
        else:
            lines.append(f'        <ActiveMapFilesRecord ID="{self._get_next_id()}" TimeStamp="{self.timestamp}"/>')
        lines.append('')
    
    def _add_job_properties_record(self, lines, reference, description, operator, job_note):
        """Add JobPropertiesRecord."""
        
        lines.extend([
            f'        <JobPropertiesRecord ID="{self._get_next_id()}" TimeStamp="{self.timestamp}">',
            f'            <Reference>{reference}</Reference>',
            f'            <Description>{description}</Description>',
            f'            <Operator>{operator}</Operator>',
            f'            <JobNote>{job_note}</JobNote>',
            '            <TectonicPlate>Unknown</TectonicPlate>',
            '            <ApplyJobPointNameRange>false</ApplyJobPointNameRange>',
            '            <MinimumJobPointName/>',
            '            <MaximumJobPointName/>',
            '        </JobPropertiesRecord>',
            ''
        ])
    
    def _add_timezone_record(self, lines, timezone_name, hours_to_utc):
        """Add TimeZoneRecord."""
        
        lines.extend([
            f'        <TimeZoneRecord ID="{self._get_next_id()}" TimeStamp="{self.timestamp}">',
            f'            <ZoneName>{timezone_name}</ZoneName>',
            f'            <HoursToUTC>{hours_to_utc}</HoursToUTC>',
            '        </TimeZoneRecord>'
        ])
    
    def _add_duplicate_coordinate_records(self, lines, coord_data):
        """Add duplicate coordinate system records as Trimble Access does after conversions."""
        # Add duplicate EllipsoidRecord
        if coord_data.get('ellipsoid_record'):
            lines.append(f'        <EllipsoidRecord ID="{self._get_next_id()}" TimeStamp="{self.timestamp}">')
            content_lines = coord_data['ellipsoid_record'].split('\n')
            for content_line in content_lines:
                if content_line.strip():
                    lines.append(f'            {content_line.strip()}')
            lines.append('        </EllipsoidRecord>')
            lines.append('')
        
        # Add duplicate critical records
        duplicate_records = [
            ('datum_record', 'DatumRecord'),
            ('displacement_models_record', 'DisplacementModelsRecord'),
            ('kinematic_transformations_record', 'KinematicTransformationsRecord'),
            ('reference_frame_transformations_record', 'ReferenceFrameTransformationsRecord')
        ]
        
        for data_key, record_name in duplicate_records:
            content = coord_data.get(data_key, '')
            if content:
                lines.append(f'        <{record_name} ID="{self._get_next_id()}" TimeStamp="{self.timestamp}">')
                content_lines = content.split('\n')
                for content_line in content_lines:
                    if content_line.strip():
                        # Skip ReferenceGlobalFrameID in duplicates too
                        if 'ReferenceGlobalFrameID' in content_line:
                            continue
                        lines.append(f'            {content_line.strip()}')
                lines.append(f'        </{record_name}>')
                lines.append('')
    
    def _add_environment_section(self, lines, coord_data, reference, description, 
                               operator, job_note, timezone_name, hours_to_utc, 
                               csv_files, map_files):
        """Add Environment section with proper structure matching Trimble Access."""
        
        lines.append('')
        
        # DisplaySettings (copy of UnitsRecord) - FIRST
        lines.append('        <DisplaySettings>')
        if coord_data.get('units_record'):
            content_lines = coord_data['units_record'].split('\n')
            for content_line in content_lines:
                if content_line.strip():
                    lines.append(f'            {content_line.strip()}')
        lines.append('        </DisplaySettings>')
        lines.append('')
        
        # CoordinateSystem (expanded coordinate data) - SECOND
        if coord_data.get('env_coordinate_system'):
            lines.append('        <CoordinateSystem>')
            content_lines = coord_data['env_coordinate_system'].split('\n')
            for content_line in content_lines:
                if content_line.strip():
                    # Skip ReferenceGlobalFrameID in Environment too
                    if 'ReferenceGlobalFrameID' in content_line:
                        continue
                    # Preserve original Environment CoordinateSystem data from reference JXL
                    lines.append(f'            {content_line.strip()}')
            lines.append('        </CoordinateSystem>')
        lines.append('')
        
        # JobProperties - THIRD
        lines.extend([
            '        <JobProperties>',
            f'            <Reference>{reference}</Reference>',
            f'            <Description>{description}</Description>',
            f'            <Operator>{operator}</Operator>',
            f'            <JobNote>{job_note}</JobNote>',
            '            <TectonicPlate>Unknown</TectonicPlate>',
            '            <ApplyJobPointNameRange>false</ApplyJobPointNameRange>',
            '            <MinimumJobPointName/>',
            '            <MaximumJobPointName/>',
            '        </JobProperties>',
            ''
        ])
        
        # JobSettings - FOURTH
        lines.extend([
            '        <JobSettings>',
            '            <NeighbourhoodAdjustment>',
            '                <Applied>false</Applied>',
            '                <WeightExponent>0.5</WeightExponent>',
            '            </NeighbourhoodAdjustment>',
            '            <Averaging>Weighted</Averaging>',
            '            <UseAttributesOfBaseCode>false</UseAttributesOfBaseCode>',
            '        </JobSettings>',
            ''
        ])
        
        # AssociatedFiles - FIFTH
        lines.append('        <AssociatedFiles>')
        
        # LinkedFiles
        if csv_files:
            lines.append('            <LinkedFiles>')
            for csv_file in csv_files:
                # Use full path format matching Trimble Access
                filename = Path(csv_file).name
                full_path = f"{self.BASE_PATH}/{filename}"
                lines.append(f'                <File>{full_path}</File>')
            lines.append('            </LinkedFiles>')
        else:
            lines.append('            <LinkedFiles/>')
        
        # ActiveMapFiles  
        if map_files:
            lines.append('            <ActiveMapFiles>')
            for map_file in map_files:
                # Use full path format matching Trimble Access
                filename = Path(map_file).name
                full_path = f"{self.BASE_PATH}/{filename}"
                lines.append(f'                <File Selectable="true">{full_path}</File>')
            lines.append('            </ActiveMapFiles>')
        else:
            lines.append('            <ActiveMapFiles/>')
        
        lines.append('        </AssociatedFiles>')
        lines.append('')
        
        # TimeZone - SIXTH
        lines.extend([
            '        <TimeZone>',
            f'            <ZoneName>{timezone_name}</ZoneName>',
            f'            <HoursToUTC>{hours_to_utc}</HoursToUTC>',
            '        </TimeZone>'
        ])


def main():
    """Command-line interface for JXL Generator."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate JXL files for Trimble Access')
    parser.add_argument('--job-name', required=True, help='Job name')
    parser.add_argument('--reference-jxl', required=True, help='Path to reference JXL file for coordinate system')
    parser.add_argument('--reference', default='', help='Reference number')
    parser.add_argument('--description', default='', help='Job description')
    parser.add_argument('--operator', default='', help='Operator name')
    parser.add_argument('--job-note', default='', help='Job note/address')
    parser.add_argument('--timezone-name', default='NDT', help='Timezone name')
    parser.add_argument('--hours-to-utc', default='2.5', help='Hours offset to UTC')
    parser.add_argument('--csv-files', nargs='*', default=[], help='CSV files to link')
    parser.add_argument('--dxf-files', nargs='*', default=[], help='DXF files to link')
    parser.add_argument('--landxml-files', nargs='*', default=[], help='LandXML files to link')
    parser.add_argument('--project-folder', help='Project folder name (e.g., 25-123-250708)')
    parser.add_argument('--output', required=True, help='Output JXL file path')
    
    args = parser.parse_args()
    
    try:
        generator = JXLGenerator()
        
        # Generate JXL
        jxl_content = generator.generate_jxl(
            job_name=args.job_name,
            reference_jxl_path=args.reference_jxl,
            reference=args.reference,
            description=args.description,
            operator=args.operator,
            job_note=args.job_note,
            timezone_name=args.timezone_name,
            hours_to_utc=args.hours_to_utc,
            csv_files=args.csv_files,
            dxf_files=args.dxf_files,
            landxml_files=args.landxml_files,
            project_folder=args.project_folder
        )
        
        # Save to file
        generator.save_jxl(jxl_content, args.output)
        
        print(f"JXL file generated successfully: {args.output}")
        
    except Exception as e:
        print(f"Error generating JXL: {e}")
        import sys
        sys.exit(1)


if __name__ == "__main__":
    main()