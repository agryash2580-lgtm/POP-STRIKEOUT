import express from 'express';
import {createServer as createViteServer} from 'vite';
try{process.loadEnvFile('.env.local')}catch{}
const {default:app}=await import('./api/index.mjs');
if(process.env.NODE_ENV==='production'){app.use(express.static('dist'));app.get('/{*path}',(req,res)=>res.sendFile(process.cwd()+'/dist/index.html'));}
else{const vite=await createViteServer({server:{middlewareMode:true,hmr:{port:Number(process.env.PORT||3002)+21000}},appType:'spa'});app.use(vite.middlewares);}
app.listen(Number(process.env.PORT||3002),'127.0.0.1',()=>console.log('Strikeout: http://localhost:'+(process.env.PORT||3002)));
