#!/usr/bin/env node
/*
 * Exercises each game mechanic directly, one at a time, rather than hoping a scripted
 * playthrough happens to touch them: springboard, manhole warp, kickable shell,
 * climbable scaffolding, swimming, the boss fight, and the hundred-coin life.
 *
 *   node tools/check-mechanics.mjs
 */
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const noop=()=>{};
const ctxStub=()=>new Proxy({canvas:{width:400,height:224},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4).fill(60),width:w,height:h}),
 createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),measureText:()=>({width:10})},
 {get:(t,k)=>(k in t?t[k]:noop),set:(t,k,v)=>((t[k]=v),true)});
const cs=(w=400,h=224)=>{const c={width:w,height:h,style:{},classList:{add:noop,remove:noop,toggle:noop,contains:()=>false}};
 c.getContext=()=>(c._c||=ctxStub());c.getBoundingClientRect=()=>({left:0,top:0,width:w,height:h});c.addEventListener=noop;return c;};
const sc={console,setInterval:()=>0,clearInterval:noop,setTimeout:(f)=>{f();return 0;},requestAnimationFrame:()=>0,queueMicrotask,
 innerWidth:1200,innerHeight:672,devicePixelRatio:1,location:{protocol:'http:',search:''},navigator:{getGamepads:()=>[]},
 localStorage:{store:{},getItem(k){return this.store[k]??null;},setItem(k,v){this.store[k]=v;}},addEventListener:noop,
 document:{hidden:false,getElementById:()=>cs(),createElement:()=>cs(),querySelectorAll:()=>[],addEventListener:noop,
  body:{classList:{add:noop,remove:noop,toggle:noop,contains:()=>false}}}};
sc.window=sc;sc.self=sc;
sc.Audio=class{constructor(){this.volume=1;this.readyState=4;}addEventListener(t,f){if(t==='canplaythrough')queueMicrotask(f);}cloneNode(){return new sc.Audio();}play(){return Promise.resolve();}set src(v){this._s=v;}get src(){return this._s;}};
sc.Image=class{constructor(){this.width=512;this.height=512;}set src(v){this._s=v;queueMicrotask(()=>this.onload&&this.onload());}get src(){return this._s;}};
const ap=()=>new Proxy({value:0},{get:(t,k)=>(k in t?t[k]:noop),set:(t,k,v)=>((t[k]=v),true)});
const an=()=>new Proxy({gain:ap(),frequency:ap(),detune:ap(),Q:ap(),threshold:ap(),ratio:ap(),attack:ap(),release:ap(),buffer:null,type:'sine',loop:false},{get:(t,k)=>(k in t?t[k]:k==='connect'?(x)=>x:noop),set:(t,k,v)=>((t[k]=v),true)});
sc.AudioContext=class{constructor(){this.sampleRate=44100;this.currentTime=0;this.state='running';this.destination=an();}
 createGain(){return an();}createOscillator(){return an();}createBiquadFilter(){return an();}createBufferSource(){return an();}
 createConvolver(){return an();}createDynamicsCompressor(){return an();}createBuffer(c,l){return{getChannelData:()=>new Float32Array(l)};}resume(){}suspend(){}};
vm.createContext(sc);
for(const src of fs.readFileSync(root+'/index.html','utf8').match(/<script src="([^"]+)"><\/script>/g).map(t=>t.match(/src="([^"]+)"/)[1]))
 vm.runInContext(fs.readFileSync(path.join(root,src),'utf8'),sc,{filename:src});
vm.runInContext('this.api={Game,Input,LEVELS,Spring,Boss,SecretExit,Rat,FASHE_THREATS,Sound};',sc);
const {Game,Input,LEVELS,FASHE_THREATS,Sound}=sc.api;
await new Promise(r=>setTimeout(r,250));
const press=(...c)=>{Input.keys.clear();c.forEach(k=>Input.keys.add(k));};
const tick=(n=1)=>{for(let i=0;i<n;i++)Game.update();};
const confirm=()=>{press('Enter');tick(1);press();tick(1);};
tick(30);confirm();
for(let i=0;i<80&&Game.state==='story';i++)confirm();
while(Game.state==='intro')tick(1);
tick(10);
Game.cheat=true;
let failures=0;
const ok=(label,pass,extra='')=>{ if(!pass)failures++; console.log('  '+(pass?'ok  ':'FAIL')+'  '+label+(extra?'  ('+extra+')':'')); };

// 1. springboard
{
  const w=Game.world,p=w.player;
  const sp=w.entities.find(e=>e.constructor.name==='Spring');
  Object.assign(p,{state:'play',vx:0,vy:2,invuln:0,jumpBuffer:0,coyote:0,ride:null,vehicle:null,climbing:false});
  p.setForm('small'); p.x=sp.cx-p.w/2; p.y=sp.y-p.h-10; p.prevBottom=p.bottom; p.onGround=false;
  let apex=p.bottom; for(let f=0;f<80;f++){press();tick(1);apex=Math.min(apex,p.bottom);}
  press();
  ok('springboard launches you', sp.y-apex>110, 'rose '+Math.round(sp.y-apex)+'px vs a 83px normal jump');
}
// 2. manhole warp
{
  const w=Game.world,p=w.player;
  const [from,to]=LEVELS[0].warps[0];
  Object.assign(p,{state:'play',vx:0,vy:0,invuln:0,freeze:0,ride:null,vehicle:null,climbing:false});
  p.setForm('small'); p.x=from*16+2; p.y=w.groundTop(from)-p.h; p.onGround=true; tick(2);
  press('ArrowDown'); tick(1); press(); tick(2);
  ok('manhole warps you to the stash', Math.abs(Math.floor(p.x/16)-to)<=2, 'landed at col '+Math.floor(p.x/16)+', wanted '+to);
  tick(20);   // the warp freezes you briefly on arrival
  press('ArrowDown'); tick(1); press(); tick(2);
  ok('and the stash manhole brings you back', Math.abs(Math.floor(p.x/16)-from)<=2, 'col '+Math.floor(p.x/16));
}
// 3. kickable shell
{
  const w=Game.world,p=w.player;
  const rat=w.entities.find(e=>e.constructor.name==='Rat'&&e.alive);
  Object.assign(p,{state:'play',vx:0,vy:3,invuln:0,ride:null,vehicle:null,climbing:false});
  p.setForm('small'); p.x=rat.cx-p.w/2; p.y=rat.y-p.h-8; p.prevBottom=p.bottom; p.onGround=false;
  for(let f=0;f<30&&rat.state!=='flat';f++){press();tick(1);}
  ok('stomping leaves a shell', rat.state==='flat');
  p.x=rat.x-14; p.y=rat.y; p.vy=0; tick(2);
  for(let f=0;f<20&&!rat.sliding;f++){press('ArrowRight');tick(1);}
  press();
  ok('and it can be kicked', rat.sliding, 'vx='+rat.vx.toFixed(1));
}
// 4. climbing
{
  Game.levelIndex=1; Game.beginPlay(); tick(3);
  const w=Game.world,p=w.player;
  let col=-1,row=-1;
  for(let y=0;y<w.rows&&col<0;y++) for(let x=0;x<w.cols;x++) if(w.tileAt(x,y)==='v'){col=x;row=y;break;}
  Object.assign(p,{state:'play',vx:0,vy:0,invuln:0,ride:null,vehicle:null,climbing:false});
  p.setForm('small'); p.x=col*16+2; p.y=(row+5)*16; p.onGround=true; tick(2);
  const y0=p.y;
  press('ArrowUp'); for(let f=0;f<60;f++)tick(1); press();
  ok('scaffolding can be climbed', y0-p.y>30, 'climbed '+Math.round(y0-p.y)+'px, climbing='+p.climbing);
}
// 5. swimming - cheat OFF, in the deep stretch, or the test proves nothing
{
  Game.cheat=false;
  Game.levelIndex=4; Game.beginPlay(); tick(3);
  const w=Game.world,p=w.player;
  let col=-1; for(let x=0;x<w.cols;x++) if(w.tileAt(x,10)==='~'){col=x+2;break;}
  Object.assign(p,{state:'play',vx:0,vy:0,invuln:0,ride:null,vehicle:null,climbing:false});
  p.setForm('small'); p.x=col*16; p.y=10*16; p.prevBottom=p.bottom; p.onGround=false;
  let alive=0,swam=0;
  for(let f=0;f<120;f++){ press(f%20<2?'Space':'ArrowRight'); tick(1); if(p.state==='play')alive++; if(p.swimming)swam++; }
  press();
  ok('you swim instead of drowning', p.state==='play'&&alive===120&&swam>90,
     'swimming '+swam+'/120 frames, survived '+alive+'/120, cheat='+Game.cheat);
  ok('and strokes carry you up', p.bottom < 11*16, 'ended at y='+Math.round(p.bottom));
  Game.cheat=true;
}
// 6. the boss: a real fight, not three taps
{
  const w=Game.world,p=w.player;
  const boss=w.boss;
  if(!boss){ ok('Fashe is waiting in 2-2',false); }
  else {
    ok('Fashe is waiting in 2-2', true, boss.maxHp+' hits, '+Math.round(boss.w)+'x'+Math.round(boss.h)+'px');
    ok('he is bigger than an ordinary person', boss.h >= 40, boss.h+'px tall vs a 21px hawker');

    // the exit will not open while he stands
    const goal=w.goal;
    Object.assign(p,{state:'play',vx:0,vy:0,invuln:0,ride:null,vehicle:null,climbing:false,swimming:false});
    p.setForm('small'); p.x=goal.x+goal.w/2; p.y=goal.bottom-p.h; p.onGround=true;
    Game.aso=false;
    for(let f=0;f<10;f++){press();tick(1);}
    ok('the stage exit is barred until he falls', Game.state==='play'&&!goal.reached, 'state='+Game.state);

    // he jumps
    boss.jumpTimer=1; boss.stunned=0;
    let airborne=0;
    for(let f=0;f<120;f++){ tick(1); if(!boss.onGround) airborne++; }
    ok('he leaps', airborne>10, airborne+' frames off the ground');

    // he speaks
    const said=w.texts.length; boss.talkTimer=1;
    for(let f=0;f<10;f++) tick(1);
    ok('he threatens you', w.texts.length>said, 'said: "'+(w.texts[w.texts.length-1]||{}).text+'"');

    // punching wears him down; stomping hurts more
    const full=boss.hp;
    boss.stunned=0; boss.punched(); const afterPunch=boss.hp;
    boss.stunned=0;
    Object.assign(p,{state:'play',vx:0,vy:3,invuln:0,ride:null,vehicle:null});
    p.x=boss.cx-p.w/2; p.y=boss.y-p.h-8; p.prevBottom=p.bottom; p.onGround=false;
    for(let f=0;f<30&&boss.hp===afterPunch;f++){press();tick(1);}
    ok('a punch takes one, a stomp takes two', full-afterPunch===1 && afterPunch-boss.hp===2,
       'punch -'+(full-afterPunch)+', stomp -'+(afterPunch-boss.hp));

    // and he does not fall in three
    ok('he survives three hits', boss.hp>0, boss.hp+'/'+boss.maxHp+' left');

    // finish him
    let guard=0;
    while(boss.alive && guard++<40){ boss.stunned=0; boss.punched(); }
    ok('but he does go down', !boss.alive, 'took '+(boss.maxHp)+' hits worth');
    ok('and hands back the aso-ebi', Game.aso&&Game.asoPieces===25, 'pieces='+Game.asoPieces);

    // now the exit opens
    Object.assign(p,{state:'play',vx:0,vy:0,invuln:0,ride:null,vehicle:null});
    p.x=goal.x+goal.w/2; p.y=goal.bottom-p.h; p.onGround=true;
    for(let f=0;f<10;f++){press();tick(1);}
    ok('the exit opens once he is down', goal.reached||Game.state==='clear', 'state='+Game.state);
  }
}

// 6b. what Fashe says out loud must be the line on screen - he used to shout the
// robbery line from 1-3 on every single taunt, in a stage where it makes no sense.
{
  Game.levelIndex=4; Game.beginPlay(); tick(3);
  Game.cheat=true;
  const w=Game.world, boss=w.boss;
  const spoken=[];
  const realSpeak=Sound.speak;
  Sound.speak=(id)=>spoken.push(id);
  let matched=0, wrongStage=0;
  for(let n=0;n<6;n++){
    boss.talkTimer=1; spoken.length=0;
    tick(3);
    const shown=w.texts[w.texts.length-1];
    const id=spoken[0]||'';
    if(id==='fashe') wrongStage++;
    const idx=id.startsWith('fashe_t')?Number(id.slice(7)):-1;
    if(idx>=0 && shown && FASHE_THREATS[idx]===shown.text) matched++;
    tick(30);
  }
  Sound.speak=realSpeak;
  ok('every threat he speaks is the one drawn on screen', matched===6, matched+'/6 matched');
  ok('and the 1-3 robbery line never plays in 2-2', wrongStage===0, wrongStage+' wrong clips');
}

// 7. punching
{
  Game.levelIndex=0; Game.beginPlay(); tick(3);
  const w=Game.world,p=w.player;
  const foe=w.entities.find(e=>e.constructor.name==='Rat'&&e.alive);
  Object.assign(p,{state:'play',vx:0,vy:0,invuln:0,ride:null,vehicle:null,climbing:false,punchCooldown:0});
  p.setForm('small');
  p.x=foe.x-16; p.y=foe.bottom-p.h; p.onGround=true; p.facing=1; tick(2);
  press('KeyX'); tick(1); press(); tick(3);
  ok('you can punch what is in front of you', p.punchTimer>0||!foe.alive||foe.state!=='alive',
     'punchTimer='+p.punchTimer+' foe='+foe.state);
}

// 8. hundred-coin life
{
  Game.coinsFound=99; const lives=Game.lives; Game.addCoin();
  ok('a hundred coins is a life', Game.lives===lives+1);
}

console.log(failures ? `\n${failures} mechanic(s) broken` : '\nEvery mechanic works');
process.exit(failures ? 1 : 0);
