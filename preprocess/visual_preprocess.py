import nibabel as nib
import numpy as np
import os, ants, argparse

def preprocess(image_path, is_image):
    rasampled_image_path = image_path.replace('.nii', '_normalized.nii')
    if '.gz' not in rasampled_image_path:
        rasampled_image_path = rasampled_image_path.replace('.nii', '.nii.gz')
    image = ants.image_read(image_path)
    if is_image:
        resampled_image = ants.resample_image(image, resample_params=(1.0, 1.0, 1.0), use_voxels=False, interp_type=1)
    else:
        resampled_image = ants.resample_image(image, resample_params=(1.0, 1.0, 1.0), use_voxels=False, interp_type=0)
    ants.image_write(resampled_image, rasampled_image_path)
    print('Resampled image saved to:', os.path.basename(rasampled_image_path))

    image_nib = nib.load(rasampled_image_path)
    image_data = image_nib.get_fdata()
    if is_image:
        image_data = (image_data - np.min(image_data)) / (np.max(image_data) - np.min(image_data))
        image_data = (image_data * 255).astype(np.uint8)
    else:
        image_data = image_data.astype(np.uint8)
    new_image_nib = nib.Nifti1Image(image_data.astype(np.float32), image_nib.affine)
    nib.save(new_image_nib, rasampled_image_path)
    print('Image Normalized')

parser = argparse.ArgumentParser()
parser.add_argument('--image_path', type=str, required=True)
parser.add_argument('--image', action='store_true', help="Enable image preprocessing")
parser.add_argument('--label', action='store_true', help="Enable label preprocessing")

if __name__ == '__main__':
    args = parser.parse_args()
    image_path = args.image_path

    if args.image:
        print('Image Preprocessing')
        preprocess(image_path, True)
    if args.label:
        print('Label Preprocessing')
        preprocess(image_path, False)