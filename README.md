# Glass Brain
View brain like glass and biopsy samples
## How to Use the Tool
Website: http://10.72.22.9:3000/

### 1.Pre-process Image or Label File
Run the following command to pre-process your image or label (in NIfTI format):
```
/data/lupo2/bol/GlassBrain/visual_preprocess.x image_path -i|-l
```
Use -i for image or -l for label.
This will generate a file named image_normalized.nii.gz next to the original file.

### 2.Pre-process Biopsy ROIs
Use this command to process biopsy ROI data:
```
/data/lupo2/bol/GlassBrain/biopsy_process.x "image_folder"
```
Ensure the folder contains a subfolder named rois.
This will produce a file called biopsy_lists.json inside the rois folder.

### 3.Prepare Files for Upload
Copy the following files to a folder (recommended: download them to your local machine, e.g., your Mac):
Normalized image (image_normalized.nii.gz)
T1 label file
T2 lesion label file
biopsy_lists.json
### 4.Load Files into Web App
Open the website and upload all four files into the app.
Resetting
### 5.Refreshing the browser will clear all uploaded data. You can re-upload the files afterward.