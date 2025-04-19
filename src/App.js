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


function App() {
  const [header, setHeader] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [axialSlice, setAxialSlice] = useState(0);
  const [coronalSlice, setCoronalSlice] = useState(0);
  const [sagittalSlice, setSagittalSlice] = useState(0);
  const [threshold, setThreshold] = useState(50);
  const [labels, setLabels] = useState([]);
  const [labelText, setLabelText] = useState('Label');
  const [infoText, setInfoText] = useState('');
  const [xCoord, setXCoord] = useState(0);
  const [yCoord, setYCoord] = useState(0);
  const [zCoord, setZCoord] = useState(0);
  const [selectedLabelIndex, setSelectedLabelIndex] = useState(-1);
  const [labelSize, setLabelSize] = useState(2);
  const [isNiftiLoaded, setIsNiftiLoaded] = useState(false);
  const [isJsonLoaded, setIsJsonLoaded] = useState(false);
  const [multiView, setMultiView] = useState(false);
  const [t1ImageData, setT1ImageData] = useState(null);
  const [t2ImageData, setT2ImageData] = useState(null);
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
        const loadedLabels = jsonData.map(label => ({
          position: [label.x, label.y, label.z],
          text: label.name || `Label ${label.x}_${label.y}_${label.z}`,
          rgb: generateRandomRGB(),
          size: label.size || 2,
          info: label.info || '',
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
  const drawSlice = (canvasRef, slice, plane, flipVertical = false) => {
    if (!imageData || !canvasRef.current || !header) return;

    const dims = header.dims.slice(1, 4);
    const ctx = canvasRef.current.getContext('2d');

    const dataWidth = plane === 'sagittal' ? dims[1] : dims[0];
    const dataHeight = plane === 'axial' ? dims[1] : dims[2];

    const aspectRatio = dataWidth / dataHeight;

    const canvasWidth = dataWidth;
    const canvasHeight = dataHeight;
    canvasRef.current.width = canvasWidth;
    canvasRef.current.height = canvasHeight;

    const maxDisplayWidth = 500;
    let displayWidth = Math.min(maxDisplayWidth, canvasWidth);
    let displayHeight = displayWidth / aspectRatio;

    canvasRef.current.style.width = `${displayWidth}px`;
    canvasRef.current.style.height = `${displayHeight}px`;

    const imageData2D = ctx.createImageData(canvasWidth, canvasHeight);
    const data = imageData2D.data;
    const scalars = imageData.getPointData().getScalars().getData();

    let pixelValues = new Array(canvasHeight).fill().map(() => new Array(canvasWidth));

    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        let value;
        if (plane === 'axial') {
          value = scalars[x + y * dims[0] + slice * dims[0] * dims[1]];
        } else if (plane === 'coronal') {
          value = scalars[x + slice * dims[0] + y * dims[0] * dims[1]];
        } else {
          value = scalars[slice + x * dims[0] + y * dims[0] * dims[1]];
        }
        pixelValues[y][x] = Math.min(255, Math.max(0, value));
      }
    }

    if (flipVertical) {
      pixelValues = pixelValues.reverse();
    }

    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const intensity = pixelValues[y][x];
        const index = (y * canvasWidth + x) * 4;
        data[index] = intensity;
        data[index + 1] = intensity;
        data[index + 2] = intensity;
        data[index + 3] = 255;
      }
    }

    ctx.putImageData(imageData2D, 0, 0);

    const planeIndex = plane === 'axial' ? 2 : plane === 'coronal' ? 1 : 0;
    // 🎯 在当前 slice 上绘制 labels（圆圈）
    labels.forEach(label => {
      let position = [...label.position]; // 避免修改原数组
      let rgb = label.rgb;
      let dx, dy;

      rgb[0] = Math.round(rgb.r * 255);
      rgb[1] = Math.round(rgb.g * 255);
      rgb[2] = Math.round(rgb.b * 255);

      position[0] = Math.round(position[0]);
      position[1] = Math.round(position[1]);
      position[2] = Math.round(position[2]);

      if (plane === 'axial' && Math.abs(position[2] - slice) >= 3) return;
      if (plane === 'coronal' && Math.abs(position[1] - slice) >= 3) return;
      if (plane === 'sagittal' && Math.abs(position[0] - slice) >= 3) return;
      const distance = Math.abs(position[planeIndex] - slice);
      if (distance >= 3) return; // 距离太远，不画

      const alpha = 1.0 - distance / 5.0;

      if (plane === 'axial') {
        dx = position[0];
        dy = position[1];
      } else if (plane === 'coronal') {
        dx = position[0];
        dy = position[2];
      } else if (plane === 'sagittal') {
        dx = position[1];
        dy = position[2];
      }

      if (flipVertical) {
        dy = canvasHeight - dy;
      }

      ctx.beginPath();
      ctx.arc(dx, dy, 4, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
      ctx.fill();
      ctx.strokeStyle = '#000'; // Optional: black outline
      ctx.stroke();
    });
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
      info: infoText
    };

    const actor = createLabelActor(
      newLabel.position,
      newLabel.text,
      newLabel.rgb,
      newLabel.size,
      newLabel.info
    );

    renderer.current.addActor(actor);

    const newLabels = [...labels, newLabel];
    setLabels(newLabels);
    labelActors.current.push(actor);

    setSelectedLabelIndex(newLabels.length - 1);

    genericRenderWindow.current.getRenderWindow().render();
  };

  // 更新标签
  const updateLabel = () => {
    if (selectedLabelIndex === -1 || !renderer.current) return;

    const rgb = generateRandomRGB();

    const updatedLabels = [...labels];
    updatedLabels[selectedLabelIndex] = {
      position: [xCoord, yCoord, zCoord],
      text: labelText,
      rgb,
      size: labelSize,
      info: infoText
    };

    renderer.current.removeActor(labelActors.current[selectedLabelIndex]);

    const actor = createLabelActor(
      [xCoord, yCoord, zCoord],
      labelText,
      rgb,
      labelSize,
      infoText
    );

    renderer.current.addActor(actor);

    labelActors.current[selectedLabelIndex] = actor;

    setLabels(updatedLabels);

    genericRenderWindow.current.getRenderWindow().render();
  };

  // 删除标签
  const deleteLabel = () => {
    if (selectedLabelIndex === -1 || !renderer.current) return;

    renderer.current.removeActor(labelActors.current[selectedLabelIndex]);

    const newLabels = [...labels];
    newLabels.splice(selectedLabelIndex, 1);
    setLabels(newLabels);

    const newActors = [...labelActors.current];
    newActors.splice(selectedLabelIndex, 1);
    labelActors.current = newActors;

    setSelectedLabelIndex(-1);
    setLabelText('Label');
    setInfoText('');

    genericRenderWindow.current.getRenderWindow().render();
  };

  // 选择标签
  const selectLabel = (index) => {
    if (index >= 0 && index < labels.length) {
      setSelectedLabelIndex(index);
      const label = labels[index];
      setLabelText(label.text);
      setInfoText(label.info || '');
      setXCoord(label.position[0]);
      setYCoord(label.position[1]);
      setZCoord(label.position[2]);
      setLabelSize(label.size);
    }
  };

  // 初始化 3D 渲染并加载标签
  useEffect(() => {
    if (!vtkContainerRef.current || !imageData || !t1ImageData || !isNiftiLoaded || !isJsonLoaded) return;

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
      renderer.current.addActor(T1Actor.current);

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
      renderer.current.addActor(T2Actor.current);

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
          label.info
        );
        renderer.current.addActor(actor);
        labelActors.current.push(actor);
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
          const formattedPosition = position ?
            `X:${Math.round(position[0])},Y:${Math.round(position[1])},Z:${Math.round(position[2])}` :
            '';
          const info = actor.get().customData?.info;
          const tag = actor.get().customData?.text;

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
  }, [imageData, isNiftiLoaded, isJsonLoaded, labels]);


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

    renderer.current.resetCamera();
    genericRenderWindow.current.getRenderWindow().render();
  }, [imageData, axialSlice, coronalSlice, sagittalSlice, colorLevel, colorWindow, multiView]);

  useEffect(() => {
    if (!imageData || !genericRenderWindow.current ||multiView ) return;

    if (!multiView) {
      actorsRef.current.axial.getProperty().setOpacity(0.0);
      actorsRef.current.coronal.getProperty().setOpacity(0.0);
      actorsRef.current.sagittal.getProperty().setOpacity(0.0);
      renderer.current.resetCamera();
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
  }, [axialSlice, coronalSlice, sagittalSlice, imageData, isJsonLoaded]);

  return (
    <div className="nifti-viewer">
      {(!isNiftiLoaded || !isJsonLoaded) && (
        <>
          <div>
            <label>Upload NIfTI File: </label>
            <input type="file" accept=".nii,.gz" onChange={handleNiftiUpload} />
            {isNiftiLoaded && <span style={{ color: 'green', marginLeft: '10px' }}>✓ Loaded</span>}
          </div>
          <div>
            <label>Upload T1 Lesion NIfTI File: </label>
            <input type="file" accept=".nii,.gz" onChange={handleT1Upload} />
            {t1ImageData && <span style={{ color: 'green', marginLeft: '10px' }}>✓ Loaded</span>}
          </div>
          <div>
            <label>Upload T2 Lesion NIfTI File: </label>
            <input type="file" accept=".nii,.gz" onChange={handleT2Upload} />
            {t2ImageData && <span style={{ color: 'green', marginLeft: '10px' }}>✓ Loaded</span>}
          </div>
          <div>
            <label>Upload Labels JSON: </label>
            <input type="file" accept=".json" onChange={handleJsonUpload} />
            {isJsonLoaded && <span style={{ color: 'green', marginLeft: '10px' }}>✓ Loaded</span>}
          </div>
          <br />
        </>
      )}

      {header && isNiftiLoaded && isJsonLoaded && (
        <div className="views" style={{ display: 'flex' }}>
          <div className="left-views">
            <div className="view">
              <h3>Axial</h3>
              <div className="view-content" style={{ display: 'flex', aspectRatio: '1 / 1', gap: '10px', maxHeight: '250px' }}>
                <canvas ref={axialCanvasRef} style={{ width: '100%', height: '100%' }}></canvas>
                <input
                  type="range"
                  min="0"
                  max={header.dims[3] - 1}
                  value={axialSlice}
                  onChange={(e) => setAxialSlice(parseInt(e.target.value))}
                  style={{ writingMode: 'vertical-lr' }}
                />
              </div>
            </div>
            <div className="view">
              <h3>Coronal</h3>
              <div className="view-content" style={{ display: 'flex', aspectRatio: '1 / 1', gap: '10px', maxHeight: '200px' }}>
                <canvas ref={coronalCanvasRef} style={{ width: '100%', height: '100%' }}></canvas>
                <input
                  type="range"
                  min="0"
                  max={header.dims[2] - 1}
                  value={coronalSlice}
                  onChange={(e) => setCoronalSlice(parseInt(e.target.value))}
                  style={{ writingMode: 'vertical-lr' }}
                />
              </div>
            </div>
            <div className="view">
              <h3>Sagittal</h3>
              <div className="view-content" style={{ display: 'flex', aspectRatio: '1 / 1', gap: '10px', maxHeight: '200px' }}>
                <canvas ref={sagittalCanvasRef} style={{ width: '100%', height: '100%' }}></canvas>
                <input
                  type="range"
                  min="0"
                  max={header.dims[1] - 1}
                  value={sagittalSlice}
                  onChange={(e) => setSagittalSlice(parseInt(e.target.value))}
                  style={{ writingMode: 'vertical-lr' }}
                />
              </div>
            </div>
          </div>

          <div className="center-3dview" style={{ flex: '2 1 600px', minWidth: '600px', padding: '0 20px' }}>
            <div className="view">
              <h3>3D View</h3>
              <div style={{ position: 'relative', width: '100%' }}>
                {/* Added checkbox in the top-right corner */}
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  height: '20px',
                  width: '120px',
                  background: '#5c89b9',
                  padding: '8px',
                  border: '0px solid #ccc',
                  zIndex: 1,
                  borderRadius: '4px'
                }}>
                  <label>
                    <input
                      type="checkbox"
                      onChange={(e) => setMultiView( e.target.checked)}
                    />
                    {' '}Show Labels
                  </label>
                </div>
                
                <table
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    background: '#5c89b9',
                    padding: '12px',
                    border: '0px solid #ccc',
                    zIndex: 1,
                    borderRadius: '4px'
                  }}
                >
                  <tbody>
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
                  </tbody>
                </table>

                <div
                  ref={vtkContainerRef}
                  style={{ width: '100%', height: '100%' }} // 固定高度，可根据需要调整
                ></div>
              </div>

              <div>
                <label>Threshold: {threshold}</label>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                />
              </div>
              <div>
                <label>Color Level: {colorLevel}</label>
                <input
                  type="range"
                  min={dataRange[0]}
                  max={dataRange[1]}
                  value={colorLevel}
                  onChange={(e) => setColorLevel(parseInt(e.target.value))}
                />
              </div>
              <div>
                <label>Color Window: {colorWindow}</label>
                <input
                  type="range"
                  min={0}
                  max={dataRange[1]}
                  value={colorWindow}
                  onChange={(e) => setColorWindow(parseInt(e.target.value))}
                />
              </div>
              <div>
                <label>Glass Brain Opacity: {brainOpacity}</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step='0.01'
                  value={brainOpacity}
                  onChange={(e) => setBrainOpacity(parseFloat(e.target.value))}
                />
              </div>
              <div>
                <label>T1 Opacity: {t1Opacity}</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step='0.01'
                  value={t1Opacity}
                  onChange={(e) => setT1Opacity(parseFloat(e.target.value))}
                />
              </div>
              <div>
                <label>T2 Opacity: {t2Opacity}</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step='0.01'
                  value={t2Opacity}
                  onChange={(e) => setT2Opacity(parseFloat(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="right-label-controls" style={{ flex: '1 1 300px', minWidth: '300px' }}>
            <div className="view">
              <h3>Label Controls</h3>
              <div className="label-controls" style={{ padding: '10px', border: '1px solid #ddd' }}>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', marginBottom: '10px' }}>
                    <label style={{ width: '20px' }}>X:</label>
                    <input
                      type="number"
                      value={xCoord}
                      step="1"
                      style={{ width: '60px' }}
                      onChange={(e) => setXCoord(parseFloat(e.target.value))}
                    />
                    <label style={{ width: '20px', marginLeft: '10px' }}>Y:</label>
                    <input
                      type="number"
                      value={yCoord}
                      step="1"
                      style={{ width: '60px' }}
                      onChange={(e) => setYCoord(parseFloat(e.target.value))}
                    />
                    <label style={{ width: '20px', marginLeft: '10px' }}>Z:</label>
                    <input
                      type="number"
                      value={zCoord}
                      step="1"
                      style={{ width: '60px' }}
                      onChange={(e) => setZCoord(parseFloat(e.target.value))}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <button onClick={addLabel}>Add</button>
                    <button onClick={updateLabel} disabled={selectedLabelIndex === -1}>Update</button>
                    <button onClick={deleteLabel} disabled={selectedLabelIndex === -1}>Delete</button>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label>Biopsy Tag:</label>
                    <input
                      type="text"
                      value={labelText}
                      style={{ width: '100%' }}
                      onChange={(e) => setLabelText(e.target.value)}
                    />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label>Biopsy Info:</label>
                    <input
                      type="text"
                      value={infoText}
                      style={{ width: '100%' }}
                      onChange={(e) => setInfoText(e.target.value)}
                    />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label>Tag size: {labelSize}</label>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.1"
                      value={labelSize}
                      onChange={(e) => setLabelSize(parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                {labels.length > 0 && (
                  <div>
                    <h4>Biopsy List</h4>
                    <div style={{ maxHeight: '570px', overflowY: 'auto', border: '1px solid #ccc', padding: '5px' }}>
                      {labels.map((label, index) => (
                        <div
                          key={index}
                          style={{
                            padding: '5px',
                            cursor: 'pointer',
                            backgroundColor: selectedLabelIndex === index ? '#e0e0e0' : 'transparent',
                          }}
                          onClick={() => selectLabel(index)}
                        >
                          <span
                            style={{
                              display: 'inline-block',
                              width: '12px',
                              height: '12px',
                              backgroundColor: `rgb(${label.rgb.r * 255}, ${label.rgb.g * 255}, ${label.rgb.b * 255})`,
                              border: '1px solid #999',
                              marginRight: '5px',
                            }}
                          ></span>
                          <div>
                            <div><strong>{label.text || `Sample ${index + 1}`}</strong></div>
                            <div style={{ fontSize: '0.8em', color: '#222222' }}>{label.info || ''}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isNiftiLoaded && !isJsonLoaded && (
        <div style={{ margin: '20px 0', padding: '10px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba' }}>
          <p>NIfTI file loaded. Please upload a JSON file to proceed.</p>
        </div>
      )}
    </div>
  );
}

export default App;