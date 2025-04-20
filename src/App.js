import React, { useEffect, useRef, useState } from 'react';
import { decompressSync } from 'fflate';
import * as nifti from 'nifti-reader-js';
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/Rendering/Profiles/Glyph';
import '@kitware/vtk.js/Rendering/Profiles/Volume';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/HtmlDataAccessHelper';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/JSZipDataAccessHelper';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
import vtkImageMarchingCubes from '@kitware/vtk.js/Filters/General/ImageMarchingCubes';
import vtkSphereSource from '@kitware/vtk.js/Filters/Sources/SphereSource';
import vtkPicker from '@kitware/vtk.js/Rendering/Core/Picker';
import vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper';
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice';
import index from '@kitware/vtk.js/Rendering/OpenGL/CubeAxesActor';
import { set } from '@kitware/vtk.js/macros';


function App() {
  const [header, setHeader] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [axialSlice, setAxialSlice] = useState(0);
  const [coronalSlice, setCoronalSlice] = useState(0);
  const [sagittalSlice, setSagittalSlice] = useState(0);
  const [threshold, setThreshold] = useState(50);
  const [labels, setLabels] = useState([]);
  const [labelText, setLabelText] = useState('Label');
  const [labelColor, setLabelColor] = useState([]);
  const [infoText, setInfoText] = useState('');
  const [xCoord, setXCoord] = useState(0);
  const [yCoord, setYCoord] = useState(0);
  const [zCoord, setZCoord] = useState(0);
  const [selectedLabelIndex, setSelectedLabelIndex] = useState(-1);
  const [labelSize, setLabelSize] = useState(2);
  const [isNiftiLoaded, setIsNiftiLoaded] = useState(false);
  const [isJsonLoaded, setIsJsonLoaded] = useState(false);
  const [t1ImageData, setT1ImageData] = useState(null);
  const [t2ImageData, setT2ImageData] = useState(null);
  const [isDataReady, setIsDataReady] = useState(false);

  const [multiView, setMultiView] = useState(false);
  const picker = vtkPicker.newInstance();
  const [colorLevel, setColorLevel] = useState(127);
  const [colorWindow, setColorWindow] = useState(255);
  const [dataRange, setDataRange] = useState([0, 0]);
  const [brainOpacity, setBrainOpacity] = useState(0.5);
  const [t1Opacity, setT1Opacity] = useState(0.5);
  const [t2Opacity, setT2Opacity] = useState(0.5);

  const axialCanvasRef = useRef(null);
  const coronalCanvasRef = useRef(null);
  const sagittalCanvasRef = useRef(null);
  const vtkContainerRef = useRef(null);
  const genericRenderWindow = useRef(null);
  const marchingCube = useRef(null);
  const t1MarchingCube = useRef(null);
  const t2MarchingCube = useRef(null);
  const renderer = useRef(null);
  const labelActors = useRef([]);
  const [biopsyPosition, setBiopsyPosition] = useState('');
  const [biopsyTag, setBiopsyTag] = useState('');
  const [biopsyInfo, setBiopsyInfo] = useState('');
  const prevSelectedRef = useRef(null);
  const actorsRef = useRef({
    axial: null,
    coronal: null,
    sagittal: null,
  });
  const brainActor = useRef(null);
  const T1Actor = useRef(null);
  const T2Actor = useRef(null);

  // 生成随机 RGB 颜色
  const generateRandomRGB = () => {
    const r = Math.random();
    const g = Math.random();
    const b = Math.random();
    return { r, g, b };
  };

  const handleConfirmLoad = () => {
    // 在这里可以添加检查，确保主要文件已加载
    if (isNiftiLoaded) {
      setIsDataReady(true);
    }
  };
  // 处理 NIfTI 文件上传
  const handleNiftiUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      let byteArray;

      if (file.name.endsWith('.nii.gz')) {
        const decompressed = decompressSync(new Uint8Array(arrayBuffer));
        byteArray = decompressed.buffer;
      } else {
        byteArray = arrayBuffer;
      }
      if (nifti.isNIFTI(byteArray)) {
        const headerData = nifti.readHeader(byteArray);
        const imageDataRaw = nifti.readImage(headerData, byteArray);

        const vtkImage = vtkImageData.newInstance();
        const dims = headerData.dims.slice(1, 4);
        vtkImage.setDimensions(dims);
        vtkImage.setSpacing([1, 1, 1]);
        vtkImage.setOrigin([0, 0, 0]);

        if (headerData.datatypeCode === 16) {
          const scalars = vtkDataArray.newInstance({
            name: 'scalars',
            values: new Float32Array(imageDataRaw),
            numberOfComponents: 1,
          });
          vtkImage.getPointData().setScalars(scalars);
          // Set data range for color level/window
          const range = scalars.getRange();
          setDataRange(range);
          setColorLevel((range[0] + range[1]) / 2);
          setColorWindow(range[1]);
        } else {
          const scalars = vtkDataArray.newInstance({
            name: 'scalars',
            values: new Float64Array(imageDataRaw),
            numberOfComponents: 1,
          });
          vtkImage.getPointData().setScalars(scalars);
          // Set data range for color level/window
          const range = scalars.getRange();
          setDataRange(range);
          setColorLevel((range[0] + range[1]) / 2);
          setColorWindow(range[1]);
        }

        setHeader(headerData);
        setImageData(vtkImage);
        setIsNiftiLoaded(true);

        setAxialSlice(Math.floor(dims[2] / 2));
        setCoronalSlice(Math.floor(dims[1] / 2));
        setSagittalSlice(Math.floor(dims[0] / 2));


      } else {
        throw new Error('Invalid NIfTI file');
      }
    } catch (error) {
      console.error('Error reading NIfTI file:', error);
      alert('Error reading NIfTI file: ' + error.message);
    }
  };
  // 处理 ROI NIfTI 文件上传
  const handleT1Upload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      let byteArray;

      if (file.name.endsWith('.nii.gz')) {
        const decompressed = decompressSync(new Uint8Array(arrayBuffer));
        byteArray = decompressed.buffer;
      } else {
        byteArray = arrayBuffer;
      }
      if (nifti.isNIFTI(byteArray)) {
        const headerData = nifti.readHeader(byteArray);
        const imageDataRaw = nifti.readImage(headerData, byteArray);

        const vtkImage = vtkImageData.newInstance();
        const dims = headerData.dims.slice(1, 4);
        vtkImage.setDimensions(dims);
        vtkImage.setSpacing([1, 1, 1]);
        vtkImage.setOrigin([0, 0, 0]);

        if (headerData.datatypeCode === 16) {
          const scalars = vtkDataArray.newInstance({
            name: 'scalars',
            values: new Float32Array(imageDataRaw),
            numberOfComponents: 1,
          });
          vtkImage.getPointData().setScalars(scalars);
        } else {
          const scalars = vtkDataArray.newInstance({
            name: 'scalars',
            values: new Float64Array(imageDataRaw),
            numberOfComponents: 1,
          });
          vtkImage.getPointData().setScalars(scalars);
        }
        setT1ImageData(vtkImage);
      } else {
        throw new Error('Invalid NIfTI file');
      }
    } catch (error) {
      console.error('Error reading ROI NIfTI file:', error);
      alert('Error reading ROI NIfTI file: ' + error.message);
    }
  };

  const handleT2Upload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      let byteArray;

      if (file.name.endsWith('.nii.gz')) {
        const decompressed = decompressSync(new Uint8Array(arrayBuffer));
        byteArray = decompressed.buffer;
      } else {
        byteArray = arrayBuffer;
      }
      if (nifti.isNIFTI(byteArray)) {
        const headerData = nifti.readHeader(byteArray);
        const imageDataRaw = nifti.readImage(headerData, byteArray);

        const vtkImage = vtkImageData.newInstance();
        const dims = headerData.dims.slice(1, 4);
        vtkImage.setDimensions(dims);
        vtkImage.setSpacing([1, 1, 1]);
        vtkImage.setOrigin([0, 0, 0]);

        if (headerData.datatypeCode === 16) {
          const scalars = vtkDataArray.newInstance({
            name: 'scalars',
            values: new Float32Array(imageDataRaw),
            numberOfComponents: 1,
          });
          vtkImage.getPointData().setScalars(scalars);
        } else {
          const scalars = vtkDataArray.newInstance({
            name: 'scalars',
            values: new Float64Array(imageDataRaw),
            numberOfComponents: 1,
          });
          vtkImage.getPointData().setScalars(scalars);
        }
        setT2ImageData(vtkImage);
      } else {
        throw new Error('Invalid NIfTI file');
      }
    } catch (error) {
      console.error('Error reading ROI NIfTI file:', error);
      alert('Error reading ROI NIfTI file: ' + error.message);
    }
  };

  // 处理 JSON 文件上传
  const handleJsonUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      if (Array.isArray(jsonData)) {
        const loadedLabels = jsonData.map((label, index) => ({
          position: [label.x, label.y, label.z],
          text: label.name || `Label ${label.x}_${label.y}_${label.z}`,
          rgb: generateRandomRGB(),
          size: label.size || 2,
          info: label.info || '',
          index: index
        }));
        setLabels(loadedLabels);
        setIsJsonLoaded(true);
      } else {
        throw new Error('JSON file must contain an array of labels');
      }
    } catch (error) {
      console.error('Error reading JSON file:', error);
      alert('Error reading JSON file: ' + error.message);
    }
  };

  // 绘制 2D 切片
// Assume imageData, t1ImageData, t2ImageData, header, labels are in scope

const drawSlice = (canvasRef, slice, plane, flipVertical = false) => {
  // Initial checks
  if (!imageData || !canvasRef.current || !header) {
      return;
  }

  const dims = header.dims.slice(1, 4);
  const ctx = canvasRef.current.getContext('2d');

  const dataWidth = plane === 'sagittal' ? dims[1] : dims[0];
  const dataHeight = plane === 'axial' ? dims[1] : dims[2];

  // Note: aspectRatio is calculated but not currently used for drawing/scaling within the function
  // const aspectRatio = dataWidth / dataHeight;

  const canvasWidth = dataWidth;
  const canvasHeight = dataHeight;
  // Set the canvas element's intrinsic resolution to the data dimensions
  canvasRef.current.width = canvasWidth;
  canvasRef.current.height = canvasHeight;

  // --- Draw Main Image (Grayscale) ---

  // Get scalar data from the main image
  const scalars = imageData.getPointData().getScalars().getData();

  // Create a temporary ImageData object for the main slice
  const imageData2D = ctx.createImageData(canvasWidth, canvasHeight);
  const data = imageData2D.data; // The pixel data array

  // Populate main image data (grayscale, opaque)
  for (let y = 0; y < canvasHeight; y++) {
      let dataY = y;
      // Apply vertical flip to the source data Y coordinate if needed
      if (flipVertical) {
          dataY = canvasHeight - 1 - y;
      }
      for (let x = 0; x < canvasWidth; x++) {
          let value;
          // Calculate 1D index into scalars based on x, dataY, slice, plane, dims
          if (plane === 'axial') {
              value = scalars[x + dataY * dims[0] + slice * dims[0] * dims[1]];
          } else if (plane === 'coronal') {
              value = scalars[x + slice * dims[0] + dataY * dims[0] * dims[1]];
          } else { // sagittal
              value = scalars[slice + x * dims[0] + dataY * dims[0] * dims[1]];
          }

          const intensity = Math.min(255, Math.max(0, value));
          const index = (y * canvasWidth + x) * 4; // Index in the imageData2D.data array (display Y)
          data[index] = intensity;     // Red channel
          data[index + 1] = intensity; // Green channel
          data[index + 2] = intensity; // Blue channel
          data[index + 3] = 255;       // Alpha channel (fully opaque)
      }
  }

  // Put the main image data onto the canvas context
  ctx.putImageData(imageData2D, 0, 0);


  // --- Draw Masks (T1 and T2) as Semi-Transparent Overlay ---

  if (t1ImageData || t2ImageData) {
      const t1Scalars = t1ImageData ? t1ImageData.getPointData().getScalars().getData() : null;
      const t2Scalars = t2ImageData ? t2ImageData.getPointData().getScalars().getData() : null;

      // Loop through each pixel on the canvas
      for (let y = 0; y < canvasHeight; y++) {
          let dataY = y;
           // Apply vertical flip to the source data Y coordinate if needed
          if (flipVertical) {
              dataY = canvasHeight - 1 - y;
          }
          for (let x = 0; x < canvasWidth; x++) {
              let t1Value = 0;
              let t2Value = 0;

              // Calculate 1D index into scalar data based on x, dataY, slice, plane, dims
               let scalarIndex;
               if (plane === 'axial') {
                  scalarIndex = x + dataY * dims[0] + slice * dims[0] * dims[1];
               } else if (plane === 'coronal') {
                  scalarIndex = x + slice * dims[0] + dataY * dims[0] * dims[1];
               } else { // sagittal
                  scalarIndex = slice + x * dims[0] + dataY * dims[0] * dims[1];
               }

              // Read T1 scalar value if T1 data exists and index is valid
              if (t1Scalars && scalarIndex >= 0 && scalarIndex < t1Scalars.length) {
                  t1Value = t1Scalars[scalarIndex];
              }
              // Read T2 scalar value if T2 data exists and index is valid
              if (t2Scalars && scalarIndex >= 0 && scalarIndex < t2Scalars.length) {
                  t2Value = t2Scalars[scalarIndex];
              }

              let r = 0, g = 0, b = 0;
              let alpha = 0;

              // Determine color and alpha based on mask values
              if (t1Value > 0 && t2Value > 0) {
                   // Both T1 and T2 have non-zero values (overlap) -> White
                   r = 255; g = 255; b = 0;
                   alpha = t1Opacity; // Slightly higher alpha for overlap
              } else if (t1Value > 0) {
                   // Only T1 has non-zero value -> Red
                   r = 255; g = 255; b = 0;
                   alpha = t1Opacity; // Semi-transparent
              } else if (t2Value > 0) {
                   // Only T2 has non-zero value -> Blue
                   r = 0; g = 255; b = 0;
                   alpha = t2Opacity; // Semi-transparent
              }

              // If there is a mask pixel (alpha > 0), draw a semi-transparent rectangle
              if (alpha > 0) {
                  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                  ctx.globalAlpha = alpha; // Set transparency for this drawing operation
                  // Draw a 1x1 rectangle at the current canvas pixel (x, y)
                  // This pixel will blend with what's already there based on globalAlpha
                  ctx.fillRect(x, y, 1, 1);
              }
          }
      }
      // Reset globalAlpha to 1.0 after drawing all mask pixels
      ctx.globalAlpha = 1.0;
  }
  // --- End Draw Masks ---


  // --- Draw Labels (Circles) --- (unchanged logic)
  const planeIndex = plane === 'axial' ? 2 : plane === 'coronal' ? 1 : 0;

  if (labels) {
     labels.forEach(label => {
       if (!Array.isArray(label.position) || label.position.length < 3) {
           console.warn("Label position is not a valid array:", label);
           return;
       }

       let position = [...label.position];
       let rgb = [];
       if (!label.rgb || typeof label.rgb.r !== 'number' || typeof label.rgb.g !== 'number' || typeof label.rgb.b !== 'number') {
            console.warn("Label rgb is not valid:", label);
           rgb = [255, 255, 255]; // Default to white
       } else {
           rgb = [
               Math.round(label.rgb.r * 255),
               Math.round(label.rgb.g * 255),
               Math.round(label.rgb.b * 255)
           ];
       }

       position[0] = Math.round(position[0]);
       position[1] = Math.round(position[1]);
       position[2] = Math.round(position[2]);

       const distance = Math.abs(position[planeIndex] - slice);
       const proximityThreshold = 3;
       if (distance >= proximityThreshold) return;

       const maxDistanceForAlpha = 5;
       const alpha = 1.0 - distance / maxDistanceForAlpha;

       let dx, dy;

       if (plane === 'axial') {
         dx = position[0];
         dy = position[1];
       } else if (plane === 'coronal') {
         dx = position[0];
         dy = position[2];
       } else if (plane === 'sagittal') {
         dx = position[1];
         dy = position[2];
       } else {
          console.error("Unknown plane:", plane);
          return;
       }

       // Apply vertical flip to the drawing Y coordinate
       if (flipVertical) {
         dy = canvasHeight - dy;
       }

       // Draw the circle (label)
       ctx.beginPath();
       ctx.arc(dx, dy, 4, 0, 2 * Math.PI);
       // Use a fixed alpha for the label circle itself, not affected by distance
       // The calculated 'alpha' based on distance could be used here if desired
       // e.g., ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
       // Let's keep it opaque for simplicity based on original code
       ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`; // Opaque color
       ctx.fill();
       ctx.strokeStyle = '#000'; // Optional: black outline
       ctx.stroke();
     });
  } // End if labels
};

  // 创建标签演员
  const createLabelActor = (position, text, rgb, size, info, index) => {
    const sphereSource = vtkSphereSource.newInstance();
    sphereSource.setCenter(position);
    sphereSource.setRadius(size);
    sphereSource.setPhiResolution(12);
    sphereSource.setThetaResolution(12);

    const mapper = vtkMapper.newInstance();
    mapper.setInputConnection(sphereSource.getOutputPort());

    const actor = vtkActor.newInstance();
    actor.setMapper(mapper);

    actor.getProperty().setColor(rgb.r, rgb.g, rgb.b);

    actor.set({ customData: { position, text, rgb, size, info, index } });

    return actor;
  };

  // 添加标签
  const addLabel = () => {
    if (!renderer.current) return;

    const rgb = generateRandomRGB();

    const newLabel = {
      position: [xCoord, yCoord, zCoord],
      text: labelText,
      rgb,
      size: labelSize,
      info: infoText,
      index: labels.length
    };

    const actor = createLabelActor(
      newLabel.position,
      newLabel.text,
      newLabel.rgb,
      newLabel.size,
      newLabel.info,
      newLabel.index
    );

    renderer.current.addActor(actor);

    const newLabels = [...labels, newLabel].map((label, index) => ({
      ...label,
      index, // 重新设置 index，从 0 开始递增
    }));
    setLabels(newLabels);
    labelActors.current.push(actor);

    setSelectedLabelIndex(newLabels.length - 1);

    genericRenderWindow.current.getRenderWindow().render();
  };

  // 更新标签
  const updateLabel = () => {
    if (selectedLabelIndex === -1 || !renderer.current) return;

    const updatedLabels = [...labels];
    updatedLabels[selectedLabelIndex] = {
      position: [xCoord, yCoord, zCoord],
      text: labelText,
      rgb: labelColor,
      size: labelSize,
      info: infoText,
      index: selectedLabelIndex
    };

    renderer.current.removeActor(labelActors.current[selectedLabelIndex]);

    const actor = createLabelActor(
      [xCoord, yCoord, zCoord],
      labelText,
      labelColor,
      labelSize,
      infoText,
      selectedLabelIndex
    );

    renderer.current.addActor(actor);

    labelActors.current[selectedLabelIndex] = actor;

    setLabels(updatedLabels);

    genericRenderWindow.current.getRenderWindow().render();
  };

  // 删除标签
  const deleteLabel = () => {
    // Check if a label is selected and renderer exists
    if (selectedLabelIndex === -1 || !renderer.current || !labelActors.current[selectedLabelIndex]) {
      return;
    }

    // 1. Remove the specific actor from the VTK renderer
    const actorToRemove = labelActors.current[selectedLabelIndex];
    renderer.current.removeActor(actorToRemove);

    // 2. Update the labels state
    const newLabels = labels.filter((_, index) => index !== selectedLabelIndex);

    // Optional: If the 'index' property within label objects is crucial and needs to match array index
    // This map is correct for re-indexing based on the new array position
    const reIndexedLabels = newLabels.map((label, index) => ({
      ...label, // Keep existing label properties
      index: index // Update the index property
    }));

    setLabels(reIndexedLabels); // Update the state with the filtered and re-indexed array

    // 3. Clear the selection state and input fields
    setSelectedLabelIndex(-1);
    setLabelText(''); // Assuming empty string is the default/clear state
    setInfoText('');
    // Reset other relevant input states (e.g., coordinates, size)
    setXCoord(0);
    setYCoord(0);
    setZCoord(0);
    setLabelSize(1);

    // 4. Trigger a VTK render (this will render the scene *after* the actor is removed)
    // Note: Recreating/adding actors for the new labels will be handled by the useEffect watching 'labels'
    genericRenderWindow.current.getRenderWindow().render();
  };

  useEffect(() => {
    // Ensure renderer and VTK window exist
    if (!renderer.current || !genericRenderWindow.current) return;

    console.log("Labels state updated, syncing VTK actors.");

    // Clear all existing actors from the renderer and ref array
    labelActors.current.forEach(actor => {
      renderer.current.removeActor(actor);
    });
    labelActors.current = [];

    // Add actors for the current (updated) set of labels
    labels.forEach((label, index) => { 
      const actor = createLabelActor(
        label.position,
        label.text,
        label.rgb,
        label.size,
        label.info,
        index // Pass the current array index, which should match label.index from reIndexedLabels
      );

      // Check if the actor was successfully created and add it
      if (actor) { // Add check if createLabelActor might return null/undefined
        renderer.current.addActor(actor);
        labelActors.current.push(actor);
      } else {
        console.warn("Failed to create actor for label:", label);
      }
    });

    // Render the scene after adding the new actors
    genericRenderWindow.current.getRenderWindow().render();

  }, [labels, renderer, genericRenderWindow]);

  // 选择标签
  const selectLabel = (index) => {
    if (index >= 0 && index < labels.length) {
      setSelectedLabelIndex(index);
      console.log("Selected label index:", index);
      const label = labels[index];
      setLabelText(label.text);
      console.log("Label text:", label.text);
      setLabelColor(label.rgb);
      setInfoText(label.info || '');
      setXCoord(label.position[0]);
      setYCoord(label.position[1]);
      setZCoord(label.position[2]);
      setAxialSlice(Math.floor(label.position[2]));
      setCoronalSlice(Math.floor(label.position[1]));
      setSagittalSlice(Math.floor(label.position[0]));
      setLabelSize(label.size);
      labelActors.current[index].getProperty().setColor(1.0, 0, 0);
      if (prevSelectedRef.current && prevSelectedRef.current !== labelActors.current[index]) {
        const rgb = prevSelectedRef.current.get().customData.rgb;
        prevSelectedRef.current.getProperty().setColor(rgb.r, rgb.g, rgb.b);
      }
      prevSelectedRef.current = labelActors.current[index];

      setBiopsyPosition(`X:${Math.round(label.position[0])},Y:${Math.round(label.position[1])},Z:${Math.round(label.position[2])}`);
      setBiopsyTag(label.text);
      setBiopsyInfo(label.info || '');
      genericRenderWindow.current.getRenderWindow().render();
    }
  };

  // 初始化 3D 渲染并加载标签
  useEffect(() => {
    if (!vtkContainerRef.current || !imageData) return;

    if (!genericRenderWindow.current) {
      genericRenderWindow.current = vtkGenericRenderWindow.newInstance();
      genericRenderWindow.current.setContainer(vtkContainerRef.current);
      genericRenderWindow.current.resize();

      renderer.current = genericRenderWindow.current.getRenderer();
      const renderWindow = genericRenderWindow.current.getRenderWindow();

      const mapper = vtkMapper.newInstance();
      brainActor.current = vtkActor.newInstance();

      marchingCube.current = vtkImageMarchingCubes.newInstance({
        contourValue: threshold,
        computeNormals: true,
        mergePoints: true,
      });

      marchingCube.current.setInputData(imageData);
      mapper.setInputConnection(marchingCube.current.getOutputPort());
      brainActor.current.setMapper(mapper);
      brainActor.current.getProperty().setOpacity(brainOpacity);

      // Make the marching cube actor not pickable
      brainActor.current.setPickable(false);

      renderer.current.addActor(brainActor.current);

      t1MarchingCube.current = vtkImageMarchingCubes.newInstance({
        contourValue: 1,
        computeNormals: true,
        mergePoints: true,
      });
      t1MarchingCube.current.setInputData(t1ImageData);
      const mapper_t1 = vtkMapper.newInstance();
      T1Actor.current = vtkActor.newInstance();

      mapper_t1.setInputConnection(t1MarchingCube.current.getOutputPort());
      T1Actor.current.setMapper(mapper_t1);
      T1Actor.current.getProperty().setColor(1.0, 1.0, 0.0); // Red color for ROI
      T1Actor.current.getProperty().setOpacity(t1Opacity);
      T1Actor.current.setPickable(false);
      if (t1ImageData) {
        renderer.current.addActor(T1Actor.current);
      }

      t2MarchingCube.current = vtkImageMarchingCubes.newInstance({
        contourValue: 1,
        computeNormals: true,
        mergePoints: true,
      });
      t2MarchingCube.current.setInputData(t2ImageData);
      const mapper_t2 = vtkMapper.newInstance();
      T2Actor.current = vtkActor.newInstance();

      mapper_t2.setInputConnection(t2MarchingCube.current.getOutputPort());
      T2Actor.current.setMapper(mapper_t2);
      T2Actor.current.getProperty().setColor(0.0, 1.0, 0.0); // Red color for ROI
      T2Actor.current.getProperty().setOpacity(t2Opacity);
      T2Actor.current.setPickable(false);
      if (t2ImageData) {
        renderer.current.addActor(T2Actor.current);
      }

      actorsRef.current.axial = vtkImageSlice.newInstance();
      actorsRef.current.coronal = vtkImageSlice.newInstance();
      actorsRef.current.sagittal = vtkImageSlice.newInstance();
      actorsRef.current.axial.setPickable(false);
      actorsRef.current.coronal.setPickable(false);
      actorsRef.current.sagittal.setPickable(false);

      renderer.current.addActor(actorsRef.current.axial);
      renderer.current.addActor(actorsRef.current.coronal);
      renderer.current.addActor(actorsRef.current.sagittal);

      renderer.current.resetCamera();
      renderWindow.render();

      // 添加从 JSON 加载的标签
      labelActors.current = [];
      labels.forEach(label => {
        const actor = createLabelActor(
          label.position,
          label.text,
          label.rgb,
          label.size,
          label.info,
          label.index
        );
        if (isJsonLoaded) {
          renderer.current.addActor(actor);
          labelActors.current.push(actor);
        }
      });

      renderer.current.resetCamera();
      renderWindow.render();

      const interactor = renderWindow.getInteractor();
      interactor.onLeftButtonPress((callData) => {
        const pos = callData.position;
        const [x, y] = [pos.x, pos.y];

        const picked = picker.pick([x, y, 0], renderer.current);
        const actor = picker.getActors()[0];

        if (actor) {
          const customData = actor.get().customData;
          const position = customData?.position;
          const index = customData?.index;
          const info = actor.get().customData?.info;
          const tag = actor.get().customData?.text;
          const size = actor.get().customData?.size;
          const rgb = actor.get().customData?.rgb;
          setLabelColor(rgb);
          setSelectedLabelIndex(index);
          setLabelText(tag);
          setInfoText(info);
          setXCoord(position[0]);
          setYCoord(position[1]);
          setZCoord(position[2]);
          setLabelSize(size);
          setAxialSlice(Math.floor(position[2]));
          setCoronalSlice(Math.floor(position[1]));
          setSagittalSlice(Math.floor(position[0]));
          console.log("Selected label index:", index);
          const formattedPosition = position ?
            `X:${Math.round(position[0])},Y:${Math.round(position[1])},Z:${Math.round(position[2])}` :
            '';


          if (prevSelectedRef.current && prevSelectedRef.current !== actor) {
            const rgb = prevSelectedRef.current.get().customData.rgb;
            prevSelectedRef.current.getProperty().setColor(rgb.r, rgb.g, rgb.b);
          }

          actor.getProperty().setColor(1.0, 0, 0);
          prevSelectedRef.current = actor;
          setBiopsyPosition(formattedPosition);
          setBiopsyTag(tag);
          setBiopsyInfo(info);
          renderWindow.render();
        }
      });

      const bounds = marchingCube.current.getOutputData().getBounds();
      setXCoord(Math.round((bounds[0] + bounds[1]) / 2));
      setYCoord(Math.round((bounds[2] + bounds[3]) / 2));
      setZCoord(Math.round((bounds[4] + bounds[5]) / 2));
    } else if (marchingCube.current && imageData) {
      // Update marchingCube if a new image is loaded
      marchingCube.current.setInputData(imageData);
      marchingCube.current.setContourValue(threshold);
      genericRenderWindow.current.getRenderWindow().render();

      // Update position for adding labels
      const bounds = marchingCube.current.getOutputData().getBounds();
      setXCoord(Math.round((bounds[0] + bounds[1]) / 2));
      setYCoord(Math.round((bounds[2] + bounds[3]) / 2));
      setZCoord(Math.round((bounds[4] + bounds[5]) / 2));
    }
  }, [imageData, isNiftiLoaded, isJsonLoaded, labels, isDataReady]);

  useEffect(() => {
    if (!imageData || !genericRenderWindow.current || !multiView) return;

    // Axial (K-slice)
    const axialMapper = vtkImageMapper.newInstance();
    axialMapper.setInputData(imageData);
    axialMapper.setKSlice(axialSlice);
    actorsRef.current.axial.setMapper(axialMapper);
    actorsRef.current.axial.getProperty().setColorLevel(colorLevel);
    actorsRef.current.axial.getProperty().setColorWindow(colorWindow);

    // Coronal (J-slice)
    const coronalMapper = vtkImageMapper.newInstance();
    coronalMapper.setInputData(imageData);
    coronalMapper.setJSlice(coronalSlice);
    actorsRef.current.coronal.setMapper(coronalMapper);
    actorsRef.current.coronal.getProperty().setColorLevel(colorLevel);
    actorsRef.current.coronal.getProperty().setColorWindow(colorWindow);

    // Sagittal (I-slice)
    const sagittalMapper = vtkImageMapper.newInstance();
    sagittalMapper.setInputData(imageData);
    sagittalMapper.setISlice(sagittalSlice);
    actorsRef.current.sagittal.setMapper(sagittalMapper);
    actorsRef.current.sagittal.getProperty().setColorLevel(colorLevel);
    actorsRef.current.sagittal.getProperty().setColorWindow(colorWindow);

    actorsRef.current.axial.getProperty().setOpacity(1.0);
    actorsRef.current.coronal.getProperty().setOpacity(1.0);
    actorsRef.current.sagittal.getProperty().setOpacity(1.0);

    // renderer.current.resetCamera();
    genericRenderWindow.current.getRenderWindow().render();
  }, [imageData, axialSlice, coronalSlice, sagittalSlice, colorLevel, colorWindow, multiView]);

  useEffect(() => {
    if (!imageData || !genericRenderWindow.current || multiView) return;

    if (!multiView) {
      actorsRef.current.axial.getProperty().setOpacity(0.0);
      actorsRef.current.coronal.getProperty().setOpacity(0.0);
      actorsRef.current.sagittal.getProperty().setOpacity(0.0);
      // renderer.current.resetCamera();
      genericRenderWindow.current.getRenderWindow().render();
      return;
    }
  }, [multiView]);

  // 更新 3D 渲染阈值
  useEffect(() => {
    if (marchingCube.current && genericRenderWindow.current) {
      marchingCube.current.setContourValue(threshold);
      genericRenderWindow.current.getRenderWindow().render();
    }
  }, [threshold]);

  useEffect(() => {
    if (marchingCube.current && genericRenderWindow.current) {
      brainActor.current.getProperty().setOpacity(brainOpacity);
      T1Actor.current.getProperty().setOpacity(t1Opacity);
      T2Actor.current.getProperty().setOpacity(t2Opacity);
      genericRenderWindow.current.getRenderWindow().render();
    }
  }, [brainOpacity, t1Opacity, t2Opacity]);

  // 更新 2D 切片
  useEffect(() => {
    drawSlice(axialCanvasRef, axialSlice, 'axial');
    drawSlice(coronalCanvasRef, coronalSlice, 'coronal', true);
    drawSlice(sagittalCanvasRef, sagittalSlice, 'sagittal', true);
  }, [axialSlice, coronalSlice, sagittalSlice, imageData, isNiftiLoaded, isDataReady, t1Opacity, t2Opacity]);

  return (
    <div className="nifti-viewer-container"> {/* Outer container */}
      {/* File Upload and Confirmation Area */}
      {(!isNiftiLoaded || !isDataReady) && (
        <div className="upload-section"> {/* Upload area panel */}
          <h2 className="upload-section-title">Display MRI Glass Brain<br /> with Biopsy Samples</h2> {/* Title */}

          <div className="upload-inputs-grid"> {/* Grid/Flex layout for inputs */}
            {/* NIfTI Upload Group */}
            <div className="upload-group">
              <label htmlFor="nifti-file" className="upload-label">Main NIfTI File:</label>
              <input id="nifti-file" type="file" accept=".nii,.gz" onChange={handleNiftiUpload} className="upload-input" />
              {isNiftiLoaded && <span className="status-indicator loaded">✓ Loaded</span>}
            </div>

            {/* T1 Lesion Upload Group */}
            <div className="upload-group">
              <label htmlFor="t1-file" className="upload-label">T1 Lesion NIfTI File (Optional):</label>
              <input id="t1-file" type="file" accept=".nii,.gz" onChange={handleT1Upload} className="upload-input" />
              {t1ImageData && <span className="status-indicator loaded">✓ Loaded</span>}
            </div>

            {/* T2 Lesion Upload Group */}
            <div className="upload-group">
              <label htmlFor="t2-file" className="upload-label">T2 Lesion NIfTI File (Optional):</label>
              <input id="t2-file" type="file" accept=".nii,.gz" onChange={handleT2Upload} className="upload-input" />
              {t2ImageData && <span className="status-indicator loaded">✓ Loaded</span>}
            </div>

            {/* JSON Labels Upload Group */}
            <div className="upload-group">
              <label htmlFor="json-file" className="upload-label">Labels JSON File (Optional):</label>
              <input id="json-file" type="file" accept=".json" onChange={handleJsonUpload} className="upload-input" />
              {isJsonLoaded && <span className="status-indicator loaded">✓ Loaded</span>}
            </div>
          </div> {/* End upload-inputs-grid */}

          {/* Confirm button container */}
          <div className="confirm-button-container">
            <button
              onClick={handleConfirmLoad}
              // Button enabled when main NIfTI and JSON are loaded
              disabled={!isNiftiLoaded}
              className="confirm-button" // Class for styling
            >
              Display 3D View
            </button>
          </div>
        </div> // End upload-section
      )}

      {/* Warning Message */}
      {isNiftiLoaded && !isDataReady && !isJsonLoaded && ( // Show only when NIfTI loaded, JSON not, and data not ready
        <div className="warning-message">
          <p>NIfTI file loaded. Please upload the Labels JSON file to proceed.</p>
        </div>
      )}

      {/* Data Display Area - visible when data is ready */}
      {isNiftiLoaded && isDataReady && (
        <div className="viewer-area"> {/* Main viewer layout container */}
          <div className="left-views-panel"> {/* Left column panel */}
            <div className="view-panel"> {/* Axial View Panel */}
              <h3>Axial</h3>
              {/* 在这里添加类名 'axial' */}
              <div className="view-content-2d axial"> {/* 2D view content (canvas + slider) */}
                <canvas ref={axialCanvasRef} className="view-canvas"></canvas>
                <input
                  type="range"
                  min="0"
                  max={header.dims[3] - 1}
                  value={axialSlice}
                  onChange={(e) => setAxialSlice(parseInt(e.target.value))}
                  className="slice-slider axial" // Add class for styling
                />
              </div>
            </div>

            <div className="view-panel"> {/* Coronal View Panel */}
              <h3>Coronal</h3>
              {/* 在这里添加类名 'coronal' */}
              <div className="view-content-2d coronal"> {/* 2D view content */}
                <canvas ref={coronalCanvasRef} className="view-canvas"></canvas>
                <input
                  type="range"
                  min="0"
                  max={header.dims[2] - 1}
                  value={coronalSlice}
                  onChange={(e) => setCoronalSlice(parseInt(e.target.value))}
                  className="slice-slider coronal"
                />
              </div>
            </div>

            <div className="view-panel"> {/* Sagittal View Panel */}
              <h3>Sagittal</h3>
              {/* 在这里添加类名 'sagittal' */}
              <div className="view-content-2d sagittal"> {/* 2D view content */}
                <canvas ref={sagittalCanvasRef} className="view-canvas"></canvas>
                <input
                  type="range"
                  min="0"
                  max={header.dims[1] - 1}
                  value={sagittalSlice}
                  onChange={(e) => setSagittalSlice(parseInt(e.target.value))}
                  className="slice-slider sagittal"
                />
              </div>
            </div>
          </div> {/* End left-views-panel */}

          <div className="center-3dview-panel"> {/* Center column panel (3D view + controls) */}
            <div className="view-panel"> {/* 3D View Panel */}
              <h3>3D View</h3>
              <div className="view-content-3d-container"> {/* Container for 3D view and overlays */}
                {/* Added checkbox in the top-right corner */}
                <div className="labels-toggle-control"> {/* Class for checkbox container */}
                  <label className="control-label">
                    <input
                      type="checkbox"
                      onChange={(e) => setMultiView(e.target.checked)}
                      className="control-checkbox"
                    />
                    {' '}Toggle 2D View
                  </label>
                </div>

                {/* Biopsy Info Table */}
                <table className="biopsy-info-table"><tbody>
                  <tr>
                    <td>Position:</td>
                    <td>{biopsyPosition}</td>
                  </tr>
                  <tr>
                    <td>Tag:</td>
                    <td>{biopsyTag}</td>
                  </tr>
                  <tr>
                    <td>Info:</td>
                    <td>{biopsyInfo}</td>
                  </tr>
                </tbody></table>

                {/* VTK Render Area */}
                <div
                  ref={vtkContainerRef}
                  className="vtk-render-area" // Class for VTK container
                ></div>
              </div> {/* End view-content-3d-container */}

              {/* 3D View Controls */}
              <div className="viewer-controls"> {/* Main container for control groups */}

                {/* Left Group: Image Adjustment */}
                <div className="image-adjustment-controls">
                  <h4>Image Adjustment</h4> {/* Title for the group */}
                  <div className="controls-group-content"> {/* Inner container for sliders */}
                    {/* Threshold */}
                    <div className="control-group">
                      <label className="control-label">Threshold: {threshold}</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={threshold}
                        onChange={(e) => setThreshold(parseInt(e.target.value))}
                        className="control-slider"
                      />
                    </div>
                    {/* Color Level */}
                    <div className="control-group">
                      <label className="control-label">Color Level: {colorLevel}</label>
                      <input
                        type="range"
                        min={dataRange[0]}
                        max={dataRange[1]}
                        value={colorLevel}
                        onChange={(e) => setColorLevel(parseInt(e.target.value))}
                        className="control-slider"
                      />
                    </div>
                    {/* Color Window */}
                    <div className="control-group">
                      <label className="control-label">Color Window: {colorWindow}</label>
                      <input
                        type="range"
                        min={0}
                        max={dataRange[1]}
                        value={colorWindow}
                        onChange={(e) => setColorWindow(parseInt(e.target.value))}
                        className="control-slider"
                      />
                    </div>
                  </div> {/* End controls-group-content */}
                </div> {/* End image-adjustment-controls */}

                {/* Right Group: Opacity Change */}
                <div className="opacity-controls">
                  <h4>Opacity Change</h4> {/* Title for the group */}
                  <div className="controls-group-content"> {/* Inner container for sliders */}
                    {/* Glass Brain Opacity */}
                    <div className="control-group">
                      <label className="control-label">Glass Brain Opacity: {brainOpacity.toFixed(2)}</label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step='0.01'
                        value={brainOpacity}
                        onChange={(e) => setBrainOpacity(parseFloat(e.target.value))}
                        className="control-slider"
                      />
                    </div>
                    {/* T1 Opacity */}
                    <div className="control-group">
                      <label className="control-label">T1 Opacity: {t1Opacity.toFixed(2)}</label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step='0.01'
                        value={t1Opacity}
                        onChange={(e) => setT1Opacity(parseFloat(e.target.value))}
                        className="control-slider"
                      />
                    </div>
                    {/* T2 Opacity */}
                    <div className="control-group">
                      <label className="control-label">T2 Opacity: {t2Opacity.toFixed(2)}</label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step='0.01'
                        value={t2Opacity}
                        onChange={(e) => setT2Opacity(parseFloat(e.target.value))}
                        className="control-slider"
                      />
                    </div>
                  </div> {/* End controls-group-content */}
                </div> {/* End opacity-controls */}

              </div> {/* End viewer-controls */}
            </div> {/* End 3D View Panel */}
          </div> {/* End center-3dview-panel */}

          <div className="right-label-controls-panel"> {/* Right column panel (Label controls) */}
            <div className="view-panel"> {/* Label Controls Panel */}
              <h3>Label Controls</h3>
              <div className="label-controls"> {/* Main label controls area */}
                <div className="coords-input-group"> {/* Coordinate inputs */}
                  <div className="coord-input"> {/* Single coord input */}
                    <label className="control-label">X:</label>
                    <input
                      type="number"
                      value={xCoord}
                      step="1"
                      onChange={(e) => setXCoord(parseFloat(e.target.value))}
                      className="coord-input-field" // Class for coord input
                    />
                  </div>
                  <div className="coord-input"> {/* Single coord input */}
                    <label className="control-label">Y:</label>
                    <input
                      type="number"
                      value={yCoord}
                      step="1"
                      onChange={(e) => setYCoord(parseFloat(e.target.value))}
                      className="coord-input-field"
                    />
                  </div>
                  <div className="coord-input"> {/* Single coord input */}
                    <label className="control-label">Z:</label>
                    <input
                      type="number"
                      value={zCoord}
                      step="1"
                      onChange={(e) => setZCoord(parseFloat(e.target.value))}
                      className="coord-input-field"
                    />
                  </div>
                </div> {/* End coords-input-group */}

                <div className="label-action-buttons"> {/* Action buttons */}
                  <button onClick={addLabel} className="control-button">Add</button>
                  <button onClick={updateLabel} disabled={selectedLabelIndex === -1} className="control-button">Update</button>
                  <button onClick={deleteLabel} disabled={selectedLabelIndex === -1} className="control-button danger-button">Delete</button> {/* Added danger class */}
                </div>

                <div className="tag-info-input-group"> {/* Tag/Info inputs */}
                  <div className="control-group">
                    <label className="control-label">Biopsy Tag:</label>
                    <input
                      type="text"
                      value={labelText}
                      onChange={(e) => setLabelText(e.target.value)}
                      className="control-text-input" // Class for text input
                    />
                  </div>
                  <div className="control-group">
                    <label className="control-label">Biopsy Info:</label>
                    <input
                      type="text"
                      value={infoText}
                      onChange={(e) => setInfoText(e.target.value)}
                      className="control-text-input"
                    />
                  </div>
                </div> {/* End tag-info-input-group */}

                <div className="control-group"> {/* Label size slider */}
                  <label className="control-label">Tag size: {labelSize}</label>
                  <input
                    type="range"
                    min="0.5"
                    max="5"
                    step="0.1"
                    value={labelSize}
                    onChange={(e) => setLabelSize(parseFloat(e.target.value))}
                    className="control-slider"
                  />
                </div>

                {labels.length > 0 && (
                  <div className="label-list-container"> {/* Container for label list */}
                    <h4>Biopsy List</h4>
                    <div className="label-list"> {/* Actual scrollable list */}
                      {labels.map((label, index) => (
                        <div
                          key={index}
                          className={`label-item ${selectedLabelIndex === index ? 'selected' : ''}`} // Add selected class
                          onClick={() => selectLabel(index)}
                        >
                          <span
                            className="label-color-swatch" // Class for color swatch
                            style={{ backgroundColor: `rgb(${label.rgb.r * 255}, ${label.rgb.g * 255}, ${label.rgb.b * 255})` }} // Keep inline style for dynamic color
                          ></span>
                          <div className="label-item-text"> {/* Container for text */}
                            <div className="label-tag-text"><strong>{label.text || `Sample ${index + 1}`}</strong></div>
                            <div className="label-info-text">{label.info || ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div> {/* End label-controls */}
            </div> {/* End Label Controls Panel */}
          </div> {/* End right-label-controls-panel */}
        </div> // End viewer-area
      )}

    </div> // End nifti-viewer-container
  );
}

export default App;