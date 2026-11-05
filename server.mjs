import express from 'express';
import {createServer as createViteServer} from 'vite';
try{process.loadEnvFile('.env.local')}catch{}
if (process.env.NODE_ENV === 'production' &&
    Buffer.from(process.env.MFA_ENCRYPTION_KEY || '', 'base64').length !== 32)
  throw Error('Production requires a stable 32-byte MFA_ENCRYPTION_KEY (base64).');
const {default:app}=await import('./api/index.mjs');
if(process.env.NODE_ENV==='production'){app.use(express.static('dist'));app.get('/{*path}',(req,res)=>res.sendFile(process.cwd()+'/dist/index.html'));}
else{const vite=await createViteServer({server:{middlewareMode:true,hmr:{port:Number(process.env.PORT||3002)+21000}},appType:'spa'});app.use(vite.middlewares);}
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3002);
app.listen(port, host, () => console.log('Strikeout listening on ' + host + ':' + port));
