// Authoritative renderer-neutral state shared by the preserved mechanics and presentation.
// This module intentionally contains no DOM, Canvas, Pixi, audio, clock, or raw-input access.
const hashSeed=(input:unknown)=>{let h=2166136261>>>0;for(const ch of String(input)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0||0x12345678;};

export const RNG={
  state:0x12345678,
  seed(value:unknown){this.state=hashSeed(value);},
  next(){let x=this.state;x^=x<<13;x^=x>>>17;x^=x<<5;this.state=x>>>0;return this.state/4294967296;},
  range(a:number,b:number){return a+(b-a)*this.next();},
  int(a:number,b:number){return Math.floor(this.range(a,b+1));},
  pick<T>(values:T[]){return values[Math.floor(this.next()*values.length)];}
};

export function newStats(){return{kills:0,pathogenDamage:0,directCollateral:0,inflammatoryInjury:0,necroticChain:0,repaired:0,peakInflammation:.18,stormSeconds:0,criticalLost:0};}

// The preserved imported mechanics are JavaScript-shaped and incrementally typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Game:any={
  scene:'title',seed:'',time:0,ticks:0,stage:0,mode:'engage',debug:false,pausedByVisibility:false,
  player:null,tissues:[],bacteria:[],pickups:[],neutrophils:[],antibodies:[],boss:null,
  inflammation:.18,pathogenLoad:0,safeLow:.08,safeHigh:.22,tissueIntegrity:1,resolveHold:0,stormTime:0,infectionMaxTime:0,
  xp:0,level:0,nextXp:22,upgradeChoices:[],upgrades:{},particles:[],camera:{x:300,y:600,shake:0},resolvePulse:0,
  spawnTimer:2,complementTimer:1.5,antibodyTimer:1,hudTimer:0,runEnded:false,
  stats:newStats(),result:null
};

function clone<T>(value:T):T{return structuredClone(value);}
function freeze(value:unknown):void{if(!value||typeof value!=='object'||Object.isFrozen(value))return;Object.freeze(value);for(const child of Object.values(value))freeze(child);}

export function readSimulationSnapshot(){
  const snapshot=clone({
    seed:Game.seed,scene:Game.scene,time:Game.time,ticks:Game.ticks,stage:Game.stage,mode:Game.mode,debug:Game.debug,
    player:Game.player,tissues:Game.tissues,bacteria:Game.bacteria,pickups:Game.pickups,particles:Game.particles,
    neutrophils:Game.neutrophils,antibodies:Game.antibodies,boss:Game.boss,
    inflammation:Game.inflammation,pathogenLoad:Game.pathogenLoad,safeLow:Game.safeLow,safeHigh:Game.safeHigh,
    tissueIntegrity:Game.tissueIntegrity,resolveHold:Game.resolveHold,stormTime:Game.stormTime,infectionMaxTime:Game.infectionMaxTime,
    xp:Game.xp,level:Game.level,nextXp:Game.nextXp,upgradeChoices:Game.upgradeChoices,upgrades:Game.upgrades,
    camera:Game.camera,cameraTrauma:Game.camera.shake,resolvePulse:Game.resolvePulse,result:Game.result,stats:Game.stats,rngState:RNG.state
  });
  freeze(snapshot);
  return snapshot;
}
