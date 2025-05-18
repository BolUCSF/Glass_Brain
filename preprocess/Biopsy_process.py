import nibabel as nib
import numpy as np
from glob import glob
import os, shutil, json, ants, sys
import argparse
sys.path.append('/mnt/nfs/rad/apps/share/bin/local')

def main_part1(root_path):
    if os.path.basename(root_path) != 'rois':
        rois_path = os.path.join(root_path,'rois')
        temp_path = os.path.join(root_path,'rois','temp')
    else:
        rois_path = root_path
        temp_path = os.path.join(root_path,'temp')
    if not os.path.exists(temp_path):
        os.makedirs(temp_path)

    biopsy_files = glob(f'{rois_path}/*t*_*_*-*.*')
    for file in biopsy_files:
        shutil.copy(file, temp_path)
    
    os.chdir(temp_path)
    idf_list = glob(f'{temp_path}/*.idf')
    print(f"Found {len(idf_list)} biopsy files")

def main_part2(root_path):
    if os.path.basename(root_path) != 'rois':
        rois_path = os.path.join(root_path,'rois')
        temp_path = os.path.join(root_path,'rois','temp')
    else:
        rois_path = root_path
        temp_path = os.path.join(root_path,'temp')
    biopsy_list = []
    index = 0
    for file_name in glob(f'{temp_path}/*.nii.gz'):
        image = ants.image_read(file_name)
        resampled_image = ants.resample_image(image, resample_params=(1.0, 1.0, 1.0), use_voxels=False, interp_type=0)
        ants.image_write(resampled_image, file_name)
        base_name = os.path.basename(file_name).replace('.nii.gz', '')

        nib_label = nib.load(file_name)
        nib_data = nib_label.get_fdata()
        label = np.nonzero(nib_data)
        label = np.mean(label,axis=1)
        label = np.round(label,1)
        biopsy_list.append({
            "x": label[0], 
            "y": label[1], 
            "z": label[2], 
            "name": base_name, 
            "size": 2,
            "info": f"This is a tumor."
        })

    with open(os.path.join(rois_path, 'biopsy_lists.json'), 'w') as f:
        json.dump(biopsy_list, f, indent=4)
    print("Biopsy list JSON file \"biopsy_lists.json\" created successfully.")
    shutil.rmtree(temp_path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Process biopsy images and create JSON list.')
    parser.add_argument('--root_path', type=str, required=True,
                        help='Root path containing the rois directory')
    parser.add_argument('--part', type=int, choices=[1, 2], required=True)
    
    args = parser.parse_args()
    if args.part == 1:
        main_part1(args.root_path)
    else:
        main_part2(args.root_path)