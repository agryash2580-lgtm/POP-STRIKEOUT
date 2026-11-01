import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({root:'frontend',configFile:false,plugins:[tailwindcss()],esbuild:{jsx:'automatic'},build:{outDir:'../dist',emptyOutDir:true,chunkSizeWarningLimit:900},server:{fs:{allow:['..']}}});
