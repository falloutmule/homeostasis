// Renderer-neutral orchestration for the authoritative imported mechanics.
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface HomeostasisSimulationPorts {
  input: { axis(): Readonly<{x:number;y:number}>; clear():void };
  effects: { particle(...args:any[]):void };
  audio: { update(dt:number):void; resolve():void; engage():void; win():void; lose():void };
  scene: { modeChanged():void; resultChanged():void; upgradeCheck():void };
  save: { recordResult(index:number):void };
  hud: { update(force?:boolean):void };
}

export interface HomeostasisMechanics {
  updatePlayer(dt:number,axis:Readonly<{x:number;y:number}>):void;
  updateBacteria(dt:number):void; updateBoss(dt:number):void; updateNeutrophils(dt:number):void;
  updateComplement(dt:number):void; updateAntibodies(dt:number):void; updateAntibodyProjectiles(dt:number):void;
  updatePickups(dt:number):void; updateTissue(dt:number):void; updateDirector(dt:number):void;
  updateHomeostasis(dt:number):void; updateParticles(dt:number):void;
}

export function createHomeostasisSimulationEngine(game:any,mechanics:HomeostasisMechanics,ports:HomeostasisSimulationPorts){
  const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
  return Object.freeze({
    step(dt:number){
      if(game.scene!=='play')return;
      game.time+=dt;game.ticks++;game.stage=Math.min(5,Math.floor(game.time/60));
      mechanics.updatePlayer(dt,ports.input.axis());
      mechanics.updateBacteria(dt);mechanics.updateBoss(dt);mechanics.updateNeutrophils(dt);
      mechanics.updateComplement(dt);mechanics.updateAntibodies(dt);mechanics.updateAntibodyProjectiles(dt);
      mechanics.updatePickups(dt);mechanics.updateTissue(dt);mechanics.updateDirector(dt);
      mechanics.updateHomeostasis(dt);mechanics.updateParticles(dt);ports.audio.update(dt);ports.scene.upgradeCheck();
      game.camera.x=game.camera.x+(game.player.x-game.camera.x)*(1-Math.pow(.001,dt));
      game.camera.y=game.camera.y+(game.player.y-game.camera.y)*(1-Math.pow(.001,dt));
      game.resolvePulse=Math.max(0,game.resolvePulse-dt*1.25);
      game.camera.shake=game.mode==='resolve'?0:Math.max(0,game.camera.shake-dt*16);
      game.hudTimer-=dt;if(game.hudTimer<=0){game.hudTimer=.08;ports.hud.update();}
    },
    toggleMode(){
      if(game.scene!=='play')return;
      game.mode=game.mode==='engage'?'resolve':'engage';
      if(game.mode==='resolve'){game.camera.shake=0;game.resolvePulse=1;game.inflammation=Math.max(0,game.inflammation-.04);ports.effects.particle(game.player.x,game.player.y,'#75efff',18,85,'ring');ports.audio.resolve();}
      else ports.audio.engage();
      ports.scene.modeChanged();ports.hud.update(true);
    },
    finishRun(won:boolean,reason:string){
      if(game.runEnded)return;
      ports.input.clear();game.runEnded=true;game.scene='result';
      const idx=Math.round(game.tissueIntegrity*100-game.stats.stormSeconds*.8+(won?30:0));
      game.result={won,reason,index:clamp(idx,0,100)};ports.save.recordResult(game.result.index);
      ports.scene.resultChanged();if(won)ports.audio.win();else ports.audio.lose();
    }
  });
}
