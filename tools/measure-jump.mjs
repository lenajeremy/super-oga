#!/usr/bin/env node
/*
 * Measures the real jump arcs by running the game headlessly, so the platform-reach
 * numbers in tools/check-levels.mjs are derived from the physics rather than guessed.
 * Re-run this after changing the jump in src/entities.js.
 *
 *   node tools/measure-jump.mjs
 */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
const root = '/Users/mac/Desktop/mario';
const ctxStub = () => new Proxy({ canvas:{width:400,height:224}, getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(60),width:w,height:h}),
  createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}), createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}), measureText:()=>({width:10}) },
  { get:(t,k)=>(k in t?t[k]:()=>{}), set:(t,k,v)=>((t[k]=v),true) });
const canvasStub=(w=400,h=224)=>{const c={width:w,height:h,style:{},classList:{add(){},remove(){},toggle(){},contains:()=>false}};
  c.getContext=()=>(c._c||=ctxStub()); c.getBoundingClientRect=()=>({left:0,top:0,width:w,height:h}); c.addEventListener=()=>{}; return c;};
const scope={console,setInterval:()=>0,clearInterval:()=>{},setTimeout:(f)=>{f();return 0;},requestAnimationFrame:()=>0,queueMicrotask,
  innerWidth:1200,innerHeight:672,devicePixelRatio:1,location:{protocol:'http:',search:''},navigator:{getGamepads:()=>[]},
  localStorage:{store:{},getItem(k){return this.store[k]??null;},setItem(k,v){this.store[k]=v;}},addEventListener:()=>{},
  document:{hidden:false,getElementById:()=>canvasStub(),createElement:()=>canvasStub(),querySelectorAll:()=>[],addEventListener:()=>{},
    body:{classList:{add(){},remove(){},toggle(){},contains:()=>false}}}};
scope.window=scope; scope.self=scope;
scope.Audio=class{constructor(){this.volume=1;this.readyState=4;}addEventListener(t,f){if(t==='canplaythrough')queueMicrotask(f);}cloneNode(){return new scope.Audio();}play(){return Promise.resolve();}set src(v){this._s=v;}get src(){return this._s;}};
scope.Image=class{constructor(){this.width=512;this.height=512;} set src(v){this._s=v; queueMicrotask(()=>this.onload&&this.onload());} get src(){return this._s;}};
const ap=()=>new Proxy({value:0},{get:(t,k)=>(k in t?t[k]:()=>{}),set:(t,k,v)=>((t[k]=v),true)});
const an=()=>new Proxy({gain:ap(),frequency:ap(),detune:ap(),Q:ap(),threshold:ap(),ratio:ap(),attack:ap(),release:ap(),buffer:null,type:'sine',loop:false},{get:(t,k)=>(k in t?t[k]:k==='connect'?(x)=>x:()=>{}),set:(t,k,v)=>((t[k]=v),true)});
scope.AudioContext=class{constructor(){this.sampleRate=44100;this.currentTime=0;this.state='running';this.destination=an();}
  createGain(){return an();}createOscillator(){return an();}createBiquadFilter(){return an();}createBufferSource(){return an();}
  createConvolver(){return an();}createDynamicsCompressor(){return an();}createBuffer(c,l){return{getChannelData:()=>new Float32Array(l)};}resume(){}suspend(){}};
vm.createContext(scope);
for (const src of fs.readFileSync(root+'/index.html','utf8').match(/<script src="([^"]+)"><\/script>/g).map(t=>t.match(/src="([^"]+)"/)[1]))
  vm.runInContext(fs.readFileSync(path.join(root,src),'utf8'),scope,{filename:src});
vm.runInContext('this.api={Game,Input,LEVELS};',scope);
const {Game,Input}=scope.api;
await new Promise(r=>setTimeout(r,250));
const press=(...c)=>{Input.keys.clear();c.forEach(k=>Input.keys.add(k));};
const tick=(n=1)=>{for(let i=0;i<n;i++)Game.update();};
const confirm=()=>{press('Enter');tick(1);press();tick(1);};
tick(30); confirm();
for(let i=0;i<80&&Game.state==='story';i++)confirm();
while(Game.state==='intro')tick(1);
tick(10);
if (!Game.world) { console.error('never reached play; state =', Game.state, Game.error ? Game.error.message : ''); process.exit(1); }
const p=Game.world.player;

const w=Game.world;
// Clear the sky over the test strip so nothing is measured against a ceiling.
for(let tx=0;tx<60;tx++) for(let ty=0;ty<12;ty++) w.setTile(tx,ty,'.');
w.entities=w.entities.filter(e=>e===w.goal);

function arc({run=false, big=false, hold=999}={}) {
  Object.assign(p,{state:'play',vy:0,invuln:0,jumpBuffer:0,coyote:0});
  p.setForm(big?'big':'small');
  p.x=160; p.y=11*16-p.h+16; p.onGround=true;
  p.vx = run ? (big?2.7:2.7) : 0;
  press(); tick(1);
  p.vx = run ? 2.7 : 0; p.onGround=true;
  const startBottom=p.bottom, startX=p.x;
  const keys=run?['ArrowRight','KeyX']:[];
  let peak=startBottom, frames=0, airborne=0;
  for(let f=0;f<140;f++){
    const held = f<hold;
    press(...keys, ...(held?['Space']:[]));
    tick(1);
    peak=Math.min(peak,p.bottom);
    if(!p.onGround) airborne++;
    if(f>3&&p.onGround) { frames=f; break; }
  }
  press();
  return { rise:+(startBottom-peak).toFixed(1), tiles:+((startBottom-peak)/16).toFixed(2), airFrames:airborne, dx:Math.round(p.x-startX) };
}
const rows=[
  ['small, standing, held', arc()],
  ['small, running, held',  arc({run:true})],
  ['small, standing, tap',  arc({hold:4})],
  ['big,   standing, held', arc({big:true})],
  ['big,   running, held',  arc({big:true,run:true})],
];
console.log('jump arcs (rise in px / tiles, airborne frames, horizontal travel)');
for(const [label,r] of rows)
  console.log('  '+label.padEnd(24), String(r.rise).padStart(5)+'px', String(r.tiles).padStart(5)+' tiles', String(r.airFrames).padStart(4)+'f', (r.dx?r.dx+'px across':''));
