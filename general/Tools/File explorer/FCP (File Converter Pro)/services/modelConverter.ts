import { Mesh, Object3D, SkinnedMesh } from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { buildScene as buildSkpScene, toGLB as skpToGLB, toOBJ as skpToOBJ, toSTLBinary as skpToSTLBinary } from 'openskp';

export type ModelFormat = 'STL' | 'OBJ' | 'FBX' | 'GLTF' | 'GLB' | 'SKP';

const modelExtensions = /\.(stl|obj|fbx|gltf|glb|skp)$/i;

export const is3DModel = (file: File): boolean => modelExtensions.test(file.name);

export const getModelFormat = (fileName: string): ModelFormat | null => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'stl') return 'STL';
  if (extension === 'obj') return 'OBJ';
  if (extension === 'fbx') return 'FBX';
  if (extension === 'gltf') return 'GLTF';
  if (extension === 'glb') return 'GLB';
  if (extension === 'skp') return 'SKP';
  return null;
};

const getModelMimeType = (format: ModelFormat): string => {
  if (format === 'OBJ') return 'text/plain';
  if (format === 'GLTF') return 'model/gltf+json';
  if (format === 'GLB') return 'model/gltf-binary';
  return 'application/octet-stream';
};

const prepareGeometry = (geometry: { computeVertexNormals: () => void; computeTangents?: () => void; getAttribute: (name: string) => unknown }) => {
  geometry.computeVertexNormals();
  if (geometry.computeTangents && geometry.getAttribute('uv')) {
    try {
      geometry.computeTangents();
    } catch {
      // Tangents are optional when the source has incomplete UV data.
    }
  }
};

const prepareScene = (root: Object3D, scale: number): Object3D => {
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);
  root.traverse(child => {
    if (child instanceof Mesh || child instanceof SkinnedMesh) {
      prepareGeometry(child.geometry);
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return root;
};

const parseModel = async (file: File): Promise<Object3D> => {
  const format = getModelFormat(file.name);
  if (!format) throw new Error(`Unsupported 3D source format: ${file.name}`);

  if (format === 'OBJ') {
    return new OBJLoader().parse(await file.text());
  }

  const buffer = await file.arrayBuffer();
  if (format === 'STL') {
    const geometry = new STLLoader().parse(buffer);
    const mesh = new Mesh(geometry);
    mesh.name = file.name.replace(/\.stl$/i, '');
    return mesh;
  }
  if (format === 'FBX') {
    return new FBXLoader().parse(buffer, '');
  }
  return new Promise<Object3D>((resolve, reject) => {
    new GLTFLoader().parse(buffer, '', gltf => resolve(gltf.scene), reject);
  });
};

const exportModel = (root: Object3D, targetFormat: ModelFormat): Promise<Blob> => {
  if (targetFormat === 'OBJ') {
    return Promise.resolve(new Blob([new OBJExporter().parse(root)], { type: getModelMimeType(targetFormat) }));
  }
  if (targetFormat === 'STL') {
    const stl = new STLExporter().parse(root, { binary: true });
    return Promise.resolve(new Blob([stl], { type: getModelMimeType(targetFormat) }));
  }

  return new Promise<Blob>((resolve, reject) => {
    new GLTFExporter().parse(root, (result: ArrayBuffer | object) => {
      if (targetFormat === 'GLB') {
        resolve(new Blob([result as ArrayBuffer], { type: getModelMimeType(targetFormat) }));
      } else {
        resolve(new Blob([JSON.stringify(result)], { type: getModelMimeType(targetFormat) }));
      }
    }, reject, { binary: targetFormat === 'GLB', includeCustomExtensions: true });
  });
};

export const convertModel = async (
  file: File,
  targetFormat: ModelFormat,
  onProgress: (progress: number) => void,
  unitScale = 1
): Promise<Blob> => {
  onProgress(5);
  if (getModelFormat(file.name) === 'SKP') {
    if (targetFormat !== 'GLB' && targetFormat !== 'OBJ' && targetFormat !== 'STL') {
      throw new Error('SKP can currently be converted to GLB, OBJ or STL.');
    }
    const scene = buildSkpScene(await file.arrayBuffer(), {
      onProgress: info => onProgress(Math.min(70, 10 + Math.round((info.current / Math.max(1, info.total)) * 60))),
    });
    onProgress(75);
    if (targetFormat === 'GLB') return new Blob([skpToGLB(scene)], { type: 'model/gltf-binary' });
    if (targetFormat === 'OBJ') return new Blob([skpToOBJ(scene)], { type: 'text/plain' });
    return new Blob([skpToSTLBinary(scene, unitScale)], { type: 'application/octet-stream' });
  }
  const source = await parseModel(file);
  onProgress(45);
  const root = prepareScene(source, unitScale);
  onProgress(70);
  const result = await exportModel(root, targetFormat);
  onProgress(100);
  return result;
};

