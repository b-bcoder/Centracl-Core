/// <reference types="vite/client" />

declare module 'imagetracerjs';
declare module 'libheif-js/wasm-bundle.js';

interface Window {
	centralCore?: {
		getLocalUsername: () => Promise<string>;
	};
}
