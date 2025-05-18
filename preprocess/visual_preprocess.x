#!/bin/csh -f

if (${#argv} < 1 || "$1" == "-h" || "$1" == "--help") then
  echo 
  echo "/data/lupo2/bol/GlassBrain/visual_preprocess.x nifit_image -i"
  echo 
  echo "       visual_preprocess"
  echo
  echo "       Required inputs:"
  echo
  echo "           nifit_image-image/label" 
  echo 
  echo "       Example: /data/lupo2/bol/GlassBrain/visual_preprocess.x t1111_fl.nii.gz -i/-l"
  echo
  exit 1
endif

echo "Runs the pre-processing on input_root for visualization"
set filepath = $1
set input_type = $2
set foldername = `dirname $filepath`
set filename = `basename $filepath`

if ("$filename" =~ "*nii*") then
  if ("$input_type" == "-i") then
    apptainer exec --bind ${foldername}:/opt/input,/data:/data /data/lupo2/bol/apptainer_hd_bet/preprocess/neo_pre.sif python /data/lupo2/bol/GlassBrain/visual_preprocess.py --image_path /opt/input/${filename} --image
  else if ("$input_type" == "-l") then
    apptainer exec --bind ${foldername}:/opt/input,/data:/data /data/lupo2/bol/apptainer_hd_bet/preprocess/neo_pre.sif python /data/lupo2/bol/GlassBrain/visual_preprocess.py --image_path /opt/input/${filename} --label
  else
    echo "Error: Input type must be -i or -t"
    exit 1
  endif
else
  echo "Error: Input file must be a .nii or .nii.gz file"
  exit 1
endif
