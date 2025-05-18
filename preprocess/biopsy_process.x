#!/bin/csh -f

if (${#argv} < 1 || "$1" == "-h" || "$1" == "--help") then
  echo 
  echo "/data/lupo2/bol/GlassBrain/biopsy_process.x root_path"
  echo 
  echo "       biopsy_process"
  echo
  echo "       Required inputs:"
  echo
  echo "           root_path - Path to the directory containing rois folder" 
  echo 
  echo "       Example: /data/lupo2/bol/GlassBrain/biopsy_process.x /data/NEWglioma/b5631/t16633"
  echo
  exit 1
endif

set original_path = `pwd`
echo "Runs the biopsy processing on root_path"
set root_path = $1

if (-d "$root_path") then
    if (-d "$root_path/rois") then
        apptainer exec --bind ${root_path}:/opt/input,/data:/data,/mnt:/mnt /data/lupo2/bol/apptainer_hd_bet/preprocess/neo_pre.sif python /data/lupo2/bol/GlassBrain/Biopsy_process.py --root_path /opt/input --part 1

        set temp_path = "${root_path}/rois/temp"
        cd ${temp_path}
        
        foreach file (`ls ${temp_path}/*.idf`)
            set filename = `basename $file`
            nifti_file_convert --input ${filename} --output_root ${filename:r} --output_type BYTE
        end
        cd ${original_path}

        apptainer exec --bind ${root_path}:/opt/input,/data:/data,/mnt:/mnt /data/lupo2/bol/apptainer_hd_bet/preprocess/neo_pre.sif python /data/lupo2/bol/GlassBrain/Biopsy_process.py --root_path /opt/input --part 2

    else
        echo "Error: rois directory not found in ${root_path}"
        exit 1
    endif
else
    echo "Error: Directory ${root_path} does not exist"
    exit 1
endif
