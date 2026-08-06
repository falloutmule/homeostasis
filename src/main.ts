/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-unused-expressions, @typescript-eslint/no-unused-vars, prefer-const */
// @ts-nocheck -- behavior-preserving import of the verified VS-004 prototype.
import { bootHomeostasisPresenter } from './renderer';
import { Game, RNG, newStats, readSimulationSnapshot } from './simulation-state';
import { createHomeostasisSimulationEngine } from './simulation-engine';
import { createHomeostasisMechanics } from './simulation-mechanics';
import { bossFraction as readBossFraction } from './simulation-rules';

/*
===============================================================================
AI-SAFE SINGLE-FILE CONSTITUTION
===============================================================================
1) Keep edits inside the named sections below.
2) INPUT emits semantic actions; DOM events never move entities directly.
3) SIMULATION owns gameplay state; RENDER reads but never mutates it.
4) All randomness passes through RNG.
5) All tissue damage passes through damageTissueAt() and records attribution.
6) No required external assets, fonts, libraries, or network requests.
7) Fixed-step simulation is authoritative; requestAnimationFrame presents it.
8) Test hooks expose a stable façade without bypassing normal core rules.
===============================================================================
*/

/* ============================== CONFIG ==================================== */
const CFG = Object.freeze({
  BUILD_ID: 'HOMEOSTASIS-VS-006-RESPONSIVE-FULLSCREEN',
  FIXED_DT: 1 / 60,
  MAX_FRAME_DT: 0.25,
  DPR_CAP: 2,
  WORLD_W: 1800,
  WORLD_H: 1200,
  MAX_BACTERIA: 240,
  MAX_PICKUPS: 120,
  MAX_PARTICLES: 420,
  PLAYER_SPEED: 225,
  SAVE_KEY: 'homeostasis.settings.v1',
  VERSION: 1
});

/* ============================== DOM / VIEWPORT ============================ */
const $ = id => document.getElementById(id);
const shell = $('fixture-shell');
const gameHost = $('game');
let presenter = null;
const DOM = {
  tissueFill:$('tissueFill'), tissueText:$('tissueText'), pathogenFill:$('pathogenFill'), pathogenText:$('pathogenText'),
  responseNeedle:$('responseNeedle'), safeBand:$('safeBand'), responseText:$('responseText'), responseStatus:$('responseStatus'), stanceBtn:$('stanceBtn'),
  title:$('titleOverlay'), upgrade:$('upgradeOverlay'), pause:$('pauseOverlay'), result:$('resultOverlay'), cards:$('upgradeCards'),
  joystick:$('joystick'), debug:$('debugText'), pauseMuteBtn:$('pauseMuteBtn'), capabilityStatus:$('capabilityStatus'),
  fullscreenButtons:[$('titleFullscreenBtn'),$('pauseFullscreenBtn')]
};
const View = { width:innerWidth, height:innerHeight, dpr:1, revision:0, cameraX:CFG.WORLD_W/2, cameraY:CFG.WORLD_H/2 };
function resizeCanvas(){
  const vv = window.visualViewport;
  const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
  const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
  const dpr = Math.max(1, Math.min(devicePixelRatio || 1, CFG.DPR_CAP));
  View.width=w; View.height=h; View.dpr=dpr; View.revision++;
  shell.dataset.layout=w<h?'portrait':'wide';
  shell.style.setProperty('--viewport-width',w+'px');
  shell.style.setProperty('--viewport-height',h+'px');
  presenter?.resize(w,h,dpr);
}
(window.visualViewport || window).addEventListener('resize', resizeCanvas, {passive:true});
window.addEventListener('resize', resizeCanvas, {passive:true});
window.addEventListener('orientationchange', resizeCanvas, {passive:true});
resizeCanvas();
function syncFullscreenUi(){const active=!!document.fullscreenElement;for(const button of DOM.fullscreenButtons){button.hidden=!document.fullscreenEnabled;button.textContent=active?'Exit Fullscreen':'Enter Fullscreen';button.setAttribute('aria-pressed',String(active));}}
function refreshViewportAfterFullscreen(){resizeCanvas();requestAnimationFrame(()=>{resizeCanvas();requestAnimationFrame(resizeCanvas);});}
async function toggleFullscreen(){if(!document.fullscreenEnabled)return;try{if(document.fullscreenElement)await document.exitFullscreen();else await shell.requestFullscreen();}catch{syncFullscreenUi();}}
document.addEventListener('fullscreenchange',()=>{syncFullscreenUi();refreshViewportAfterFullscreen();});
syncFullscreenUi();

/* ============================== UTIL / RNG ================================ */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const dist2=(a,b,c,d)=>{const x=a-c,y=b-d;return x*x+y*y;};
const fmtTime=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const pct=v=>Math.round(clamp(v,0,1)*100)+'%';

/* ============================== SAVE ====================================== */
const Save={
  data:{version:1,muted:false,bestIndex:0},
  load(){try{const raw=localStorage.getItem(CFG.SAVE_KEY);if(raw){const x=JSON.parse(raw);if(x.version===1)this.data={...this.data,...x};}}catch(err){console.warn('Storage unavailable',err);}},
  commit(){try{localStorage.setItem(CFG.SAVE_KEY,JSON.stringify(this.data));}catch(err){console.warn('Save failed',err);}},
  exportString(){return btoa(unescape(encodeURIComponent(JSON.stringify(this.data))));},
  importString(s){const x=JSON.parse(decodeURIComponent(escape(atob(s))));if(x.version!==1)throw new Error('Unsupported save');this.data={...this.data,...x};this.commit();}
};
Save.load();

/* ============================== AUDIO ===================================== */
const AudioSys={
  context:null, master:null, muted:!!Save.data.muted, heartbeat:0,
  unlock(){
    if(!this.context){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;this.context=new AC();this.master=this.context.createGain();this.master.gain.value=this.muted?0:0.32;this.master.connect(this.context.destination);}
    if(this.context.state==='suspended')this.context.resume();
  },
  setMuted(v){this.muted=!!v;Save.data.muted=this.muted;Save.commit();if(this.master)this.master.gain.setTargetAtTime(this.muted?0:0.32,this.context.currentTime,.02);if(DOM.pauseMuteBtn)DOM.pauseMuteBtn.textContent=this.muted?'Unmute audio':'Mute audio';},
  tone(freq=440,dur=.06,type='sine',gain=.08,endFreq=null){if(!this.context||this.muted)return;const t=this.context.currentTime,o=this.context.createOscillator(),g=this.context.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(30,endFreq),t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(this.master);o.start(t);o.stop(t+dur+.02);},
  click(){this.tone(720,.045,'triangle',.07,930);},
  kill(){this.tone(260,.055,'square',.05,110);},
  level(){this.tone(420,.12,'triangle',.08,760);setTimeout(()=>this.tone(620,.12,'triangle',.06,980),70);},
  hurt(){this.tone(145,.08,'sawtooth',.07,70);},
  resolve(){this.tone(520,.14,'sine',.06,290);},
  engage(){this.tone(220,.12,'sawtooth',.07,510);},
  win(){[330,440,550,660].forEach((f,i)=>setTimeout(()=>this.tone(f,.18,'triangle',.07,f*1.15),i*90));},
  lose(){[260,190,130].forEach((f,i)=>setTimeout(()=>this.tone(f,.25,'sawtooth',.06,f*.7),i*120));},
  update(dt){if(Game.scene!=='play'||this.muted||!this.context)return;this.heartbeat-=dt;if(Game.inflammation>.82&&this.heartbeat<=0){this.heartbeat=.62-Game.inflammation*.22;this.tone(72,.12,'sine',.055,58);setTimeout(()=>this.tone(64,.1,'sine',.04,50),130);}}
};
AudioSys.setMuted(AudioSys.muted);

/* ============================== INPUT ===================================== */
const Input={
  keys:new Set(), joystickPointer:null, joyX:0, joyY:0, joyStartX:0, joyStartY:0, joyXpx:0, joyYpx:0,
  axis(){let x=0,y=0;if(this.keys.has('KeyA')||this.keys.has('ArrowLeft'))x--;if(this.keys.has('KeyD')||this.keys.has('ArrowRight'))x++;if(this.keys.has('KeyW')||this.keys.has('ArrowUp'))y--;if(this.keys.has('KeyS')||this.keys.has('ArrowDown'))y++;x+=this.joyX;y+=this.joyY;const m=Math.hypot(x,y);return m>1?{x:x/m,y:y/m}:{x,y};},
  clearJoystick(){this.joystickPointer=null;this.joyX=this.joyY=this.joyXpx=this.joyYpx=0;DOM.joystick.style.display='none';DOM.joystick.style.setProperty('--jx','0px');DOM.joystick.style.setProperty('--jy','0px');},
  clearAll(){this.keys.clear();this.clearJoystick();}
};
addEventListener('keydown',e=>{
  const allowed=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Escape','F3'];
  if(!allowed.includes(e.code))return;e.preventDefault();
  if(e.code==='Space'&&!e.repeat&&Game.scene==='play')toggleMode();
  else if(e.code==='Escape'&&!e.repeat&&(Game.scene==='play'||Game.scene==='pause'))togglePause();
  else if(e.code==='F3'&&!e.repeat){Game.debug=!Game.debug;DOM.debug.style.display=Game.debug?'block':'none';}
  else Input.keys.add(e.code);
},{passive:false});
addEventListener('keyup',e=>Input.keys.delete(e.code));
gameHost.addEventListener('pointerdown',e=>{
  if(Game.scene!=='play'||Input.joystickPointer!==null||e.clientX>View.width*.67)return;
  Input.joystickPointer=e.pointerId;Input.joyStartX=e.clientX;Input.joyStartY=e.clientY;gameHost.setPointerCapture?.(e.pointerId);
  DOM.joystick.style.display='block';DOM.joystick.style.left=e.clientX+'px';DOM.joystick.style.top=e.clientY+'px';
  e.preventDefault();
},{passive:false});
gameHost.addEventListener('pointermove',e=>{
  if(e.pointerId!==Input.joystickPointer)return;const dx=e.clientX-Input.joyStartX,dy=e.clientY-Input.joyStartY,r=46,m=Math.hypot(dx,dy)||1,k=Math.min(1,r/m);Input.joyX=dx/m*Math.min(1,m/r);Input.joyY=dy/m*Math.min(1,m/r);Input.joyXpx=dx*k;Input.joyYpx=dy*k;DOM.joystick.style.setProperty('--jx',Input.joyXpx+'px');DOM.joystick.style.setProperty('--jy',Input.joyYpx+'px');e.preventDefault();
},{passive:false});
function endPointer(e){if(e.pointerId===Input.joystickPointer)Input.clearJoystick();}
gameHost.addEventListener('pointerup',endPointer);gameHost.addEventListener('pointercancel',endPointer);gameHost.addEventListener('lostpointercapture',endPointer);
window.addEventListener('blur',()=>Input.clearAll());

/* ============================== ASSET GENERATION ========================== */
const Assets={tissue:[],bacteria:[],player:null,resolve:null,build(){
  const states=['healthy','stressed','damaged','necrotic','scar'];
  states.forEach((state,si)=>{this.tissue[si]=[];for(let v=0;v<4;v++)this.tissue[si].push(makeTissueSprite(state,v));});
  for(let v=0;v<5;v++)this.bacteria.push(makeBacteriaSprite(v));
  this.player=makePlayerSprite();this.resolve=makeResolveSprite();
}};
function offscreen(size){const c=document.createElement('canvas');c.width=c.height=size;return c;}
function makeTissueSprite(state,variant){
  const c=offscreen(96),g=c.getContext('2d'),r=32,phase=variant*.9;g.translate(48,48);
  const palettes={healthy:['#5cc7a4','#b5f1bf','#d5ffd0'],stressed:['#b2b65b','#e5dc82','#fff0a4'],damaged:['#a85b5f','#d3786e','#ffa08e'],necrotic:['#3a383b','#66545a','#8a6b6c'],scar:['#344d4a','#54736b','#729287']};
  const p=palettes[state];g.beginPath();for(let i=0;i<18;i++){const a=i/18*Math.PI*2,rr=r*(1+.07*Math.sin(i*2.2+phase)+.035*Math.sin(i*5.3+phase));const x=Math.cos(a)*rr,y=Math.sin(a)*rr;i?g.lineTo(x,y):g.moveTo(x,y);}g.closePath();
  const grad=g.createRadialGradient(-10,-12,4,0,0,39);grad.addColorStop(0,p[2]);grad.addColorStop(.55,p[0]);grad.addColorStop(1,p[1]);g.fillStyle=grad;g.fill();g.strokeStyle=state==='scar'?'#8ab2a8':'rgba(232,255,243,.54)';g.lineWidth=2;g.stroke();
  if(state!=='scar'){
    g.beginPath();g.ellipse(variant%2?7:-6,variant>1?5:-4,10,8,phase*.25,0,Math.PI*2);g.fillStyle=state==='necrotic'?'rgba(35,20,28,.8)':'rgba(29,73,71,.58)';g.fill();
    for(let i=0;i<5;i++){const a=i*1.9+phase;g.beginPath();g.arc(Math.cos(a)*18,Math.sin(a)*16,1.5+(i%2),0,Math.PI*2);g.fillStyle='rgba(235,255,230,.28)';g.fill();}
  }else{g.strokeStyle='rgba(180,225,210,.32)';g.lineWidth=3;for(let i=-2;i<=2;i++){g.beginPath();g.moveTo(-28,i*8+Math.sin(i)*3);g.quadraticCurveTo(0,i*8-5,28,i*8+2);g.stroke();}}
  if(state==='damaged'||state==='necrotic'){g.strokeStyle='rgba(52,25,31,.65)';g.lineWidth=2;for(let i=0;i<3;i++){g.beginPath();g.moveTo(-6+i*7,-30+i*3);g.lineTo(-2+i*5,-10);g.lineTo(-14+i*8,6);g.stroke();}}
  return c;
}
function makeBacteriaSprite(variant){
  const c=offscreen(48),g=c.getContext('2d');g.translate(24,24);g.rotate(variant*.4);g.strokeStyle='rgba(255,232,132,.66)';g.lineWidth=1.2;
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2;g.beginPath();g.moveTo(Math.cos(a)*12,Math.sin(a)*7);g.quadraticCurveTo(Math.cos(a)*18,Math.sin(a)*14,Math.cos(a+.3)*20,Math.sin(a+.3)*16);g.stroke();}
  const gr=g.createLinearGradient(-14,-8,14,8);gr.addColorStop(0,'#ffb64b');gr.addColorStop(.5,'#f36961');gr.addColorStop(1,'#a73668');g.fillStyle=gr;g.beginPath();g.ellipse(0,0,15,8,0,0,Math.PI*2);g.fill();g.strokeStyle='rgba(255,245,196,.8)';g.stroke();g.fillStyle='rgba(255,245,183,.38)';for(let i=0;i<4;i++){g.beginPath();g.arc(-7+i*5,Math.sin(i)*2,1.3,0,Math.PI*2);g.fill();}return c;
}
function makePlayerSprite(){
  const c=offscreen(96),g=c.getContext('2d'),r=30;g.translate(48,48);g.beginPath();for(let i=0;i<22;i++){const a=i/22*Math.PI*2,rr=r*(1+.11*Math.sin(i*2.7));const x=Math.cos(a)*rr,y=Math.sin(a)*rr;i?g.lineTo(x,y):g.moveTo(x,y);}g.closePath();const gr=g.createRadialGradient(-9,-10,2,0,0,34);gr.addColorStop(0,'#e7ffd6');gr.addColorStop(.55,'#66cf9d');gr.addColorStop(1,'#225f51');g.fillStyle=gr;g.fill();g.strokeStyle='rgba(228,255,241,.85)';g.lineWidth=3;g.stroke();g.fillStyle='rgba(20,65,70,.65)';g.beginPath();g.ellipse(-3,1,10,7,-.5,0,Math.PI*2);g.fill();return c;
}
function makeResolveSprite(){
  const c=offscreen(400),g=c.getContext('2d'),r=188;g.translate(200,200);const gr=g.createRadialGradient(0,0,26,0,0,r);gr.addColorStop(0,'rgba(102,225,239,.24)');gr.addColorStop(.55,'rgba(102,225,239,.10)');gr.addColorStop(1,'rgba(102,225,239,0)');g.fillStyle=gr;g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fill();g.strokeStyle='rgba(117,239,255,.52)';g.lineWidth=3;g.beginPath();g.arc(0,0,r-8,0,Math.PI*2);g.stroke();return c;
}
Assets.build();

/* ============================== DATA / UPGRADES =========================== */
const UPGRADE_DEFS=[
  {id:'phagocyticReach',icon:'◔',name:'Phagocytic Reach',text:'Stretch the macrophage membrane farther and engulf pathogens harder.',good:'Range + damage',bad:'More inflammation',metrics:['Effectiveness ↑','Specificity ↔','Inflammation ↑','Tissue risk Low']},
  {id:'efferocytosis',icon:'◌',name:'Efferocytosis',text:'In Resolve mode, consume necrotic debris, lower danger signals, and leave stable scar.',good:'Cleanup + resolution',bad:'No direct burst',metrics:['Resolution ↑↑','Repair ↑','Inflammation ↓','Damage —']},
  {id:'neutrophils',icon:'✦',name:'Neutrophil Recruitment',text:'Recruit short-lived hunters that burst into pathogen clusters.',good:'Emergency damage',bad:'High collateral',metrics:['Effectiveness ↑↑','Specificity ↓','Inflammation ↑↑','Tissue risk ↑']},
  {id:'chemotaxis',icon:'⌁',name:'Guided Chemotaxis',text:'Guide neutrophils toward dense pathogen signals and away from host membranes.',good:'Specificity + control',bad:'Lower peak burst',metrics:['Specificity ↑↑','Collateral ↓','Damage ↔','Requires recruits']},
  {id:'complement',icon:'⊚',name:'Complement Tag',text:'Mark pathogen membranes for amplification and phagocytic damage.',good:'Chain marking',bad:'Spillover in storms',metrics:['Synergy ↑','Effectiveness ↑','Inflammation ↑','Storm risk ↑']},
  {id:'antibody',icon:'Y',name:'Antibody Opsonization',text:'Release homing Y-markers that slow bacteria and make them easier to engulf.',good:'High specificity',bad:'Slow startup',metrics:['Specificity ↑↑','Control ↑','Inflammation Low','Damage Low']},
  {id:'treg',icon:'◎',name:'Regulatory Suppression',text:'Reduce inflammatory gain and strengthen shutdown, at the cost of attack cadence.',good:'Safer response',bad:'Slower attacks',metrics:['Resolution ↑↑','Inflammation ↓↓','Attack speed ↓','Tissue safety ↑']},
  {id:'platelet',icon:'⬡',name:'Platelet Patch',text:'Stabilize nearby damaged tissue. Necrotic tissue still requires cleanup.',good:'Active repair',bad:'Uses support capacity',metrics:['Repair ↑↑','Tissue safety ↑','Damage —','Range Low']}
];

/* ============================== RUNTIME STATE ============================= */

/* ============================== PARTICLE POOL ============================= */
function initParticles(){Game.particles.length=0;for(let i=0;i<CFG.MAX_PARTICLES;i++)Game.particles.push({active:false,x:0,y:0,vx:0,vy:0,ttl:0,max:1,r:2,color:'#fff',kind:'dot'});}
function particle(x,y,color='#fff',count=1,speed=70,kind='dot'){
  for(let n=0;n<count;n++){const p=Game.particles.find(q=>!q.active);if(!p)return;const a=RNG.range(0,Math.PI*2),s=RNG.range(speed*.25,speed);Object.assign(p,{active:true,x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,ttl:RNG.range(.25,.7),max:.7,r:RNG.range(1.5,4),color,kind});}
}

/* ============================== WORLD GENERATION ========================== */
function resetGame(seed=String(Date.now())){
  RNG.seed(seed);Game.seed=String(seed);Game.scene='play';Game.time=0;Game.ticks=0;Game.stage=0;Game.mode='engage';Game.runEnded=false;Game.result=null;
  Game.inflammation=.18;Game.pathogenLoad=.45;Game.safeLow=.22;Game.safeHigh=.48;Game.tissueIntegrity=1;Game.resolveHold=0;Game.stormTime=0;Game.infectionMaxTime=0;Game.resolvePulse=0;
  Game.xp=0;Game.level=0;Game.nextXp=22;Game.upgrades={};Game.spawnTimer=1.5;Game.complementTimer=1.2;Game.antibodyTimer=.7;Game.stats=newStats();
  Game.player={x:310,y:CFG.WORLD_H/2,vx:0,vy:0,r:19,hp:100,maxHp:100,attackCd:0,attackFx:0,attackTarget:null,hitFx:0};
  Game.tissues=[];Game.bacteria=[];Game.pickups=[];Game.neutrophils=[];Game.antibodies=[];initParticles();generateTissue();
  Game.boss={x:1450,y:CFG.WORLD_H/2,r:72,matrixHp:1150,matrixMax:1150,coreHp:900,coreMax:900,spawnCd:3,toxinCd:7,dead:false,hitFx:0};
  const colonyPts=[[650,260],[720,930],[1080,340],[1120,860]];for(const [x,y] of colonyPts)for(let i=0;i<7;i++)Mechanics.spawnBacterium(x+RNG.range(-80,80),y+RNG.range(-70,70),1);for(let i=0;i<6;i++)Mechanics.spawnBacterium(455+RNG.range(-35,55),Game.player.y+RNG.range(-120,120),1);
  Game.camera.x=Game.player.x;Game.camera.y=Game.player.y;Input.clearAll();
  DOM.title.hidden=true;DOM.upgrade.hidden=true;DOM.pause.hidden=true;DOM.result.hidden=true;updateModeUI();updateHud(true);AudioSys.click();
}
function generateTissue(){
  let id=0;for(let y=72;y<CFG.WORLD_H-60;y+=70){for(let x=64;x<CFG.WORLD_W-55;x+=70){
    const bx=x+RNG.range(-10,10),by=y+RNG.range(-10,10);const bossGap=dist2(bx,by,1450,CFG.WORLD_H/2)<105*105;if(bossGap)continue;
    Game.tissues.push({id:id++,x:bx,y:by,r:RNG.range(25,31),rot:RNG.range(0,Math.PI*2),variant:RNG.int(0,3),hp:100,maxHp:100,state:0,debris:0,importance:(x>1360&&Math.abs(y-CFG.WORLD_H/2)<180)?1.5:1,lastSource:null,repairFx:0});
  }}
}
function bossFraction(){return readBossFraction(Game.boss);}
function maybeLevelUp(){if(Game.scene!=='play'||Game.xp<Game.nextXp)return;Game.xp-=Game.nextXp;Game.level++;Game.nextXp=Math.round(Game.nextXp*1.34+7);openUpgrade();}

/* ============================== UPGRADES ================================== */
function openUpgrade(){Input.clearAll();Game.scene='upgrade';Game.upgradeChoices=drawUpgradeChoices();DOM.cards.innerHTML='';for(const def of Game.upgradeChoices){const tier=Game.upgrades[def.id]||0,btn=document.createElement('button');btn.className='upgradeCard';btn.innerHTML=`<div class="cardIcon">${def.icon}</div><div class="cardTier">Tier ${tier+1} of 3</div><div class="cardTitle">${def.name}</div><p class="cardText">${def.text}</p><p><span class="good">+ ${def.good}</span><br><span class="danger">− ${def.bad}</span></p><div class="metrics">${def.metrics.map(m=>`<div class="metric">${m}</div>`).join('')}</div>`;btn.addEventListener('click',()=>chooseUpgrade(def.id));DOM.cards.appendChild(btn);}DOM.upgrade.hidden=false;AudioSys.level();}
function drawUpgradeChoices(){const available=UPGRADE_DEFS.filter(d=>(Game.upgrades[d.id]||0)<3);const pool=[...available],out=[];while(pool.length&&out.length<3){out.push(pool.splice(RNG.int(0,pool.length-1),1)[0]);}return out;}
function chooseUpgrade(id){Game.upgrades[id]=(Game.upgrades[id]||0)+1;DOM.upgrade.hidden=true;Game.scene='play';AudioSys.click();}
function declineUpgrade(){Game.inflammation=Math.max(0,Game.inflammation-.09);Mechanics.repairTissueAt(Game.player.x,Game.player.y,160,5);DOM.upgrade.hidden=true;Game.scene='play';AudioSys.resolve();}

/* ============================== MODE / SCENES ============================= */
function toggleMode(){Simulation.toggleMode();}
function updateModeUI(){const resolve=Game.mode==='resolve';DOM.stanceBtn.innerHTML=resolve?'<span class="stanceState">RESOLVING</span><small>Tap to Engage</small>':'<span class="stanceState">ENGAGED</span><small>Tap to Resolve</small>';DOM.stanceBtn.setAttribute('aria-label',resolve?'Current mode resolving. Attacks paused. Tap to engage.':'Current mode engaged. Attacks active. Tap to resolve.');}
function togglePause(){if(Game.scene==='play'){Input.clearAll();Game.scene='pause';DOM.pause.hidden=false;}else if(Game.scene==='pause'){Game.scene='play';DOM.pause.hidden=true;}}
function finishRun(won,reason){Simulation.finishRun(won,reason);}
function showResults(){const r=Game.result,s=Game.stats;let title,summary,kicker=r.won?'Clearance achieved':'Host lost';if(r.won){if(Game.tissueIntegrity>.78&&s.stormSeconds<4)title='Homeostatic Clearance';else if(Game.tissueIntegrity>.5)title='Controlled Clearance';else title='Scarred Victory';summary='The infection source was eliminated and the response successfully shut itself down.';}else{const map={response_core:['Response Core Lost','The coordinating macrophage was overwhelmed.'],tissue_collapse:['Tissue Collapse','The infection and immune collateral destroyed too much of the host.'],cytokine_storm:['Cytokine Storm','The response remained beyond recovery range for too long.'],infection_runaway:['Infection Runaway','Pathogens reproduced faster than the response could contain them.']};[title,summary]=map[r.reason]||['Response Failed','The host could not be stabilized.'];}
  $('resultKicker').textContent=kicker;$('resultTitle').textContent=title;$('resultSummary').textContent=summary;const rows=[['Homeostasis index',r.index],['Tissue preserved',pct(Game.tissueIntegrity)],['Peak inflammation',pct(s.peakInflammation)],['Time in storm',s.stormSeconds.toFixed(1)+' s'],['Pathogen damage',Math.round(s.pathogenDamage)],['Direct immune collateral',Math.round(s.directCollateral)],['Inflammatory injury',Math.round(s.inflammatoryInjury)],['Tissue repaired',Math.round(s.repaired)],['Pathogens cleared',s.kills],['Run seed',Game.seed]];$('resultGrid').innerHTML=rows.map(([a,b])=>`<div class="resultItem"><span>${a}</span><b>${b}</b></div>`).join('');DOM.result.hidden=false;}

/* ============================== SIMULATION ================================ */
const Mechanics=createHomeostasisMechanics(Game,RNG,CFG,{particle,audio:{kill:()=>AudioSys.kill(),level:()=>AudioSys.level()},finish:(won,reason)=>finishRun(won,reason)});
const Simulation=createHomeostasisSimulationEngine(Game,{updatePlayer:Mechanics.updatePlayer,updateBacteria:Mechanics.updateBacteria,updateBoss:Mechanics.updateBoss,updateNeutrophils:Mechanics.updateNeutrophils,updateComplement:Mechanics.updateComplement,updateAntibodies:Mechanics.updateAntibodies,updateAntibodyProjectiles:Mechanics.updateAntibodyProjectiles,updatePickups:Mechanics.updatePickups,updateTissue:Mechanics.updateTissue,updateDirector:Mechanics.updateDirector,updateHomeostasis:Mechanics.updateHomeostasis,updateParticles:Mechanics.updateParticles},{
  input:{axis:()=>Input.axis(),clear:()=>Input.clearAll()},effects:{particle},
  audio:{update:dt=>AudioSys.update(dt),resolve:()=>AudioSys.resolve(),engage:()=>AudioSys.engage(),win:()=>AudioSys.win(),lose:()=>AudioSys.lose()},
  scene:{modeChanged:updateModeUI,resultChanged:showResults,upgradeCheck:maybeLevelUp},
  save:{recordResult:index=>{Save.data.bestIndex=Math.max(Save.data.bestIndex,index);Save.commit();}},hud:{update:updateHud}
});
function update(dt){Simulation.step(dt);}

/* ============================== RENDER ==================================== */
function render(){
  presenter?.present(readSimulationSnapshot(),View);
}

/* ============================== HUD / DEBUG =============================== */
function updateHud(force=false){if(!Game.player)return;DOM.tissueFill.style.width=pct(Game.tissueIntegrity);DOM.tissueText.textContent=pct(Game.tissueIntegrity);DOM.pathogenFill.style.width=pct(Game.pathogenLoad);DOM.pathogenText.textContent=pct(Game.pathogenLoad);DOM.safeBand.style.left=pct(Game.safeLow);DOM.safeBand.style.width=pct(Game.safeHigh-Game.safeLow);DOM.responseNeedle.style.left=pct(Game.inflammation);const resolving=Game.mode==='resolve',state=Game.inflammation<Game.safeLow?'SUPPRESSED':Game.inflammation>Game.safeHigh?'STORM RISK':'EFFECTIVE';DOM.responseText.textContent=pct(Game.inflammation)+(resolving?' ↓':'')+` · ${state}`;DOM.responseStatus.textContent=resolving?'RESOLVING · ATTACKS PAUSED · INFLAMMATION FALLING ↓':'ENGAGED · ATTACKS ACTIVE';DOM.responseStatus.style.background=resolving?'rgba(21,77,84,.9)':'rgba(92,35,43,.84)';DOM.responseStatus.style.borderColor=resolving?'rgba(117,239,255,.75)':'rgba(255,184,155,.5)';DOM.responseGauge?.classList.toggle('resolving',resolving);DOM.stanceBtn.style.boxShadow=resolving?'0 0 34px rgba(95,225,255,.5), inset 0 0 28px rgba(95,225,255,.18)':'0 0 30px rgba(255,110,90,.24), inset 0 0 22px rgba(255,110,90,.1)';if(Game.debug){DOM.debug.textContent=`${CFG.BUILD_ID}\nscene ${Game.scene}  seed ${Game.seed}\ntime ${fmtTime(Game.time)}  stage ${Game.stage}\nFPS ${Perf.fps}  frame ${Perf.ms.toFixed(1)} ms\ncanvas ${View.width}×${View.height} @${View.dpr.toFixed(2)}\nplayer ${Game.player.x.toFixed(1)}, ${Game.player.y.toFixed(1)} hp ${Game.player.hp.toFixed(1)}\nbacteria ${Game.bacteria.length}  boss ${(bossFraction()*100).toFixed(1)}%\ninflammation ${Game.inflammation.toFixed(3)} safe ${Game.safeLow.toFixed(3)}-${Game.safeHigh.toFixed(3)}\ntissue ${Game.tissueIntegrity.toFixed(3)} xp ${Game.xp}/${Game.nextXp}\npointers ${Input.joystickPointer===null?0:1} particles ${Game.particles.filter(p=>p.active).length}`;}}

/* ============================== BOOT / LOOP =============================== */
const Perf={fps:0,frames:0,t0:performance.now(),ms:0};let last=performance.now(),acc=0,frameHandle=null;
function frame(now){let dt=Math.min(CFG.MAX_FRAME_DT,(now-last)/1000);last=now;Perf.ms=dt*1000;Perf.frames++;if(now-Perf.t0>=1000){Perf.fps=Perf.frames;Perf.frames=0;Perf.t0=now;}if(Game.scene==='play'){acc+=dt;while(acc>=CFG.FIXED_DT){update(CFG.FIXED_DT);acc-=CFG.FIXED_DT;}}else acc=0;render();frameHandle=requestAnimationFrame(frame);}
async function bootPresentation(){
  try{presenter=await bootHomeostasisPresenter(gameHost,Assets,View.width,View.height,CFG.DPR_CAP);render();frameHandle=requestAnimationFrame(frame);}
  catch{shell.dataset.phase='unsupported';DOM.capabilityStatus.hidden=false;DOM.capabilityStatus.textContent='WebGL is required for this SFHS import. No fallback renderer is used.';$('fixture-start').disabled=true;}
}
const presentationReady=bootPresentation();
document.addEventListener('visibilitychange',()=>{if(document.hidden&&Game.scene==='play'){Input.clearAll();Game.pausedByVisibility=true;Game.scene='pause';DOM.pause.hidden=false;}last=performance.now();acc=0;});
window.addEventListener('pagehide',()=>{Input.clearAll();if(frameHandle!==null)cancelAnimationFrame(frameHandle);presenter?.destroy();});

/* ============================== UI EVENTS ================================= */
$('fixture-start').addEventListener('click',async()=>{await presentationReady;if(!presenter)return;AudioSys.unlock();resetGame('HOST-'+Date.now().toString(36).toUpperCase());shell.dataset.phase='running';});
$('stanceBtn').addEventListener('pointerdown',e=>{e.preventDefault();AudioSys.unlock();toggleMode();},{passive:false});
$('pauseBtn').addEventListener('click',()=>togglePause());
$('titleFullscreenBtn').addEventListener('click',toggleFullscreen);
$('pauseFullscreenBtn').addEventListener('click',toggleFullscreen);
$('pauseMuteBtn').addEventListener('click',()=>{AudioSys.unlock();AudioSys.setMuted(!AudioSys.muted);DOM.pauseMuteBtn.textContent=AudioSys.muted?'Unmute audio':'Mute audio';});
$('resumeBtn').addEventListener('click',()=>{Game.scene='play';DOM.pause.hidden=true;Game.pausedByVisibility=false;});
$('restartFromPauseBtn').addEventListener('click',()=>resetGame('HOST-'+Date.now().toString(36).toUpperCase()));
$('restartBtn').addEventListener('click',()=>{DOM.result.hidden=true;resetGame('HOST-'+Date.now().toString(36).toUpperCase());});
$('declineBtn').addEventListener('click',declineUpgrade);

/* ============================== TEST HOOKS ================================ */
window.__HOMEOSTASIS_TEST__=Object.freeze({
  buildId:CFG.BUILD_ID,
  start(seed='TEST-SEED'){AudioSys.unlock();resetGame(seed);shell.dataset.phase='running';},
  stepFrames(n=1){for(let i=0;i<n;i++)update(CFG.FIXED_DT);updateHud(true);},
  readState(){const surface=presenter?.getPrimarySurface();return{buildId:CFG.BUILD_ID,scene:Game.scene,seed:Game.seed,time:Game.time,ticks:Game.ticks,mode:Game.mode,player:{x:Game.player?.x,y:Game.player?.y,hp:Game.player?.hp},bacteria:Game.bacteria.length,bossFraction:bossFraction(),bossDead:!!Game.boss?.dead,inflammation:Game.inflammation,safeLow:Game.safeLow,safeHigh:Game.safeHigh,tissueIntegrity:Game.tissueIntegrity,xp:Game.xp,level:Game.level,upgrades:{...Game.upgrades},result:Game.result,cameraShake:Game.camera.shake,resolvePulse:Game.resolvePulse,responseStatus:DOM.responseStatus.textContent,stanceText:DOM.stanceBtn.textContent.replace(/\s+/g,' ').trim(),repairingTissues:Game.tissues.filter(t=>t.repairFx>0).length,fullscreen:!!document.fullscreenElement,layout:shell.dataset.layout,viewportRevision:View.revision,canvas:{cssW:View.width,cssH:View.height,backingW:surface?.width||0,backingH:surface?.height||0,dpr:View.dpr}};},
  readSimulationState(){return readSimulationSnapshot();},
  toggleMode(){toggleMode();},
  grantUpgrade(id){if(!UPGRADE_DEFS.some(d=>d.id===id))throw new Error('Unknown upgrade '+id);Game.upgrades[id]=Math.min(3,(Game.upgrades[id]||0)+1);},
  grantXp(amount=999){Game.xp+=amount;maybeLevelUp();},
  damageTissue(x=Game.player.x,y=Game.player.y,r=120,amount=10,source='test'){return Mechanics.damageTissueAt(x,y,r,amount,source);},
  spawnBacteria(n=1){for(let i=0;i<n;i++)Mechanics.spawnBacterium(Game.player.x+160+RNG.range(-20,20),Game.player.y+RNG.range(-50,50),1);},
  setInflammation(v){Game.inflammation=clamp(v,0,1);},
  defeatBoss(){Game.boss.matrixHp=0;Game.boss.coreHp=0;Game.boss.dead=true;},
  clearBacteria(){Game.bacteria.length=0;},
  forceVictoryWindow(){Game.scene='play';DOM.upgrade.hidden=true;Game.boss.dead=true;Game.bacteria.length=0;Game.spawnTimer=999;Game.xp=0;Game.inflammation=.15;Game.resolveHold=7.9;Game.safeLow=.08;Game.safeHigh=.22;},
  forceFailure(reason='cytokine_storm'){Game.scene='play';Game.runEnded=false;DOM.upgrade.hidden=true;finishRun(false,reason);},
  focusBoss(){Game.player.x=Game.boss.x-150;Game.player.y=Game.boss.y;Game.camera.x=Game.player.x;Game.camera.y=Game.player.y;},
  saveExport(){return Save.exportString();},
  clearInput(){Input.clearAll();},
  readRenderProbe(){const surface=presenter?.getPrimarySurface(),diagnostics=presenter?.getDiagnostics(),style=surface?getComputedStyle(surface):null;return{visibleCanvas:surface?{width:surface.width,height:surface.height,rect:{width:surface.getBoundingClientRect().width,height:surface.getBoundingClientRect().height},opacity:style.opacity,visibility:style.visibility}:null,webglSurface:surface instanceof HTMLCanvasElement,visibleCanvasCount:diagnostics?.visibleCanvasCount||0,meaningfulObjectCount:diagnostics?.meaningfulObjectCount||0,destroyed:diagnostics?.destroyed||false,webgl:diagnostics?.webgl};}
});

function crSnapshot(){return Object.freeze({...window.__HOMEOSTASIS_TEST__.readState(),phase:shell.dataset.phase||'missing'});}
async function runFullSelfCheck(){
  const timeBeforeRender=Game.time;render();
  const checks=Object.freeze({
    buildId:CFG.BUILD_ID==='HOMEOSTASIS-VS-006-RESPONSIVE-FULLSCREEN',
    running:Game.scene==='play'&&shell.dataset.phase==='running',
    fixedStep:Game.ticks>=1&&CFG.FIXED_DT===1/60,
    renderPure:Game.time===timeBeforeRender,
    webglSurface:gameHost.querySelector('.sfhs-webgl-surface') instanceof HTMLCanvasElement,
    oneVisiblePixiCanvas:presenter?.getDiagnostics().visibleCanvasCount===1,
    legacyHook:window.__HOMEOSTASIS_TEST__.buildId===CFG.BUILD_ID,
    storageVersion:Save.data.version===CFG.VERSION
  });
  return Object.freeze({pass:Object.values(checks).every(Boolean),checks,snapshot:crSnapshot()});
}
window.CR=Object.freeze({getSnapshot:crSnapshot,runFullSelfCheck});
