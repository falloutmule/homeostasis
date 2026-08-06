import { describe, expect, it, vi } from 'vitest';
import { createHomeostasisSimulationEngine } from './simulation-engine';
/* eslint-disable @typescript-eslint/no-explicit-any */

function fixture(){
  const calls:string[]=[];const game:any={scene:'play',time:0,ticks:0,stage:0,mode:'engage',player:{x:10,y:20},camera:{x:0,y:0,shake:4},resolvePulse:0,inflammation:.5,hudTimer:0,runEnded:false,tissueIntegrity:.8,stats:{stormSeconds:2},result:null};
  const names=['updatePlayer','updateBacteria','updateBoss','updateNeutrophils','updateComplement','updateAntibodies','updateAntibodyProjectiles','updatePickups','updateTissue','updateDirector','updateHomeostasis','updateParticles'] as const;
  const mechanics:any={};for(const name of names)mechanics[name]=()=>calls.push(name);
  const ports:any={input:{axis:()=>({x:1,y:0}),clear:()=>calls.push('input.clear')},effects:{particle:()=>calls.push('particle')},audio:{update:()=>calls.push('audio.update'),resolve:()=>calls.push('audio.resolve'),engage:vi.fn(),win:()=>calls.push('audio.win'),lose:()=>calls.push('audio.lose')},scene:{modeChanged:()=>calls.push('modeChanged'),resultChanged:()=>calls.push('resultChanged'),upgradeCheck:()=>calls.push('upgradeCheck')},save:{recordResult:()=>calls.push('save')},hud:{update:()=>calls.push('hud')}};
  return{game,calls,engine:createHomeostasisSimulationEngine(game,mechanics,ports)};
}

describe('authoritative orchestration ports',()=>{
  it('preserves exact mechanic and side-effect call order',()=>{const f=fixture();f.engine.step(1/60);expect(f.calls).toEqual(['updatePlayer','updateBacteria','updateBoss','updateNeutrophils','updateComplement','updateAntibodies','updateAntibodyProjectiles','updatePickups','updateTissue','updateDirector','updateHomeostasis','updateParticles','audio.update','upgradeCheck','hud']);expect(f.game.ticks).toBe(1);});
  it('emits Resolve effects through ports and suppresses trauma',()=>{const f=fixture();f.engine.toggleMode();expect(f.game.mode).toBe('resolve');expect(f.game.inflammation).toBe(.46);expect(f.game.camera.shake).toBe(0);expect(f.calls).toEqual(['particle','audio.resolve','modeChanged','hud']);});
  it('routes result cleanup, save, scene, and audio in order',()=>{const f=fixture();f.engine.finishRun(true,'homeostatic');expect(f.game.result).toEqual({won:true,reason:'homeostatic',index:100});expect(f.calls).toEqual(['input.clear','save','resultChanged','audio.win']);});
});
