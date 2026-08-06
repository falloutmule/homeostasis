import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Game, RNG, newStats, readSimulationSnapshot } from './simulation-state';
import { createHomeostasisMechanics } from './simulation-mechanics';

const cfg={WORLD_W:1800,WORLD_H:1200,MAX_BACTERIA:240,PLAYER_SPEED:225};
function tissue(x=100,y=100){return{id:1,x,y,r:28,rot:0,variant:0,hp:100,maxHp:100,state:0,debris:0,importance:1,lastSource:null,repairFx:0};}
function boot(seed='phase-1'){
  RNG.seed(seed);Object.assign(Game,{scene:'play',seed,time:0,ticks:0,stage:0,mode:'engage',runEnded:false,result:null,inflammation:.18,pathogenLoad:.45,safeLow:.22,safeHigh:.48,tissueIntegrity:1,resolveHold:0,stormTime:0,infectionMaxTime:0,xp:0,level:0,nextXp:22,upgrades:{},spawnTimer:1.5,complementTimer:1.2,antibodyTimer:.7,stats:newStats(),player:{x:100,y:100,vx:0,vy:0,r:19,hp:100,maxHp:100,attackCd:0,attackFx:0,attackTarget:null,hitFx:0},tissues:[tissue()],bacteria:[],pickups:[],neutrophils:[],antibodies:[],particles:[],boss:{x:1450,y:600,r:72,matrixHp:1150,matrixMax:1150,coreHp:900,coreMax:900,spawnCd:3,toxinCd:7,dead:false,hitFx:0},camera:{x:100,y:100,shake:0}});
  const events:string[]=[];const finish=vi.fn();const m=createHomeostasisMechanics(Game,RNG,cfg,{particle:(_x,_y,_c,_n,_s,k)=>events.push(k||'dot'),audio:{kill:()=>events.push('kill'),level:()=>events.push('level')},finish});return{m,events,finish};
}
describe('authoritative renderer-neutral mechanics',()=>{
  beforeEach(()=>boot());
  it('is deterministic for a fixed seed and semantic movement',()=>{const a=boot('same');a.m.spawnBacterium(130,100);a.m.updatePlayer(1/60,{x:1,y:0});const first=readSimulationSnapshot();const b=boot('same');b.m.spawnBacterium(130,100);b.m.updatePlayer(1/60,{x:1,y:0});expect(readSimulationSnapshot()).toEqual(first);});
  it('preserves Engage attacks and attributed collateral',()=>{const {m}=boot();const b=m.spawnBacterium(112,100)!;m.updatePlayer(1/60,{x:0,y:0});expect(b.hp).toBeLessThan(b.maxHp);expect(Game.stats.directCollateral).toBeGreaterThan(0);});
  it('preserves Resolve decay, protection, repair, and shake suppression',()=>{const {m}=boot();Game.mode='resolve';Game.inflammation=.9;Game.safeHigh=.4;Game.camera.shake=8;Game.tissues[0].hp=50;m.damageTissueAt(100,100,40,10,'pathogen');expect(Game.tissues[0].hp).toBeCloseTo(45.5);Game.tissues[0].hp=50;m.updateTissue(1);m.updateHomeostasis(1/60);expect(Game.tissues[0].hp).toBeGreaterThan(50);expect(Game.inflammation).toBeLessThan(.9);expect(Game.camera.shake).toBe(0);});
  it('preserves bacteria, boss, director, and effector activity',()=>{const {m}=boot('systems');const b=m.spawnBacterium(100,100)!;b.attackCd=0;b.retarget=0;m.updateBacteria(1/60);Game.boss.spawnCd=0;Game.boss.toxinCd=0;const before=Game.bacteria.length;m.updateBoss(1/60);expect(Game.bacteria.length).toBeGreaterThan(before);Game.spawnTimer=0;m.updateDirector(1/60);Game.upgrades.neutrophils=1;m.updateNeutrophils(1/60);expect(Game.neutrophils).toHaveLength(2);});
  it('preserves deterministic upgrades',()=>{const {m}=boot('upgrade');const defs=['a','b','c','d'].map(id=>({id}));const choices=m.drawUpgradeChoices(defs).map(x=>x.id);const again=boot('upgrade').m.drawUpgradeChoices(defs).map(x=>x.id);expect(choices).toEqual(again);m.chooseUpgrade('a');expect(Game.upgrades.a).toBe(1);});
  it.each([['response_core',()=>{Game.player.hp=0;}],['tissue_collapse',()=>{Game.tissues[0].hp=0;}],['cytokine_storm',()=>{Game.stormTime=11;}],['infection_runaway',()=>{Game.bacteria=Array.from({length:240},()=>({}));Game.infectionMaxTime=4;}]])('preserves %s failure',(_reason,arrange)=>{const {m,finish}=boot();arrange();m.updateHomeostasis(0);expect(finish).toHaveBeenCalledWith(false,_reason);});
  it('preserves the homeostatic win condition',()=>{const {m,finish}=boot();Game.boss.dead=true;Game.bacteria=[];Game.inflammation=.3;Game.safeLow=.2;Game.safeHigh=.4;Game.resolveHold=8;m.updateHomeostasis(0);expect(finish).toHaveBeenCalledWith(true,'homeostatic');});
});
