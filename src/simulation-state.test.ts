import { beforeEach, describe, expect, it } from 'vitest';
import { Game, RNG, newStats, readSimulationSnapshot } from './simulation-state';

describe('authoritative HOMEOSTASIS simulation state boundary',()=>{
  beforeEach(()=>{RNG.state=0x12345678;Game.seed='STATE-TEST';Game.scene='play';Game.time=0;Game.ticks=0;Game.player={x:310,y:600,hp:100};Game.tissues=[];Game.bacteria=[];Game.pickups=[];Game.neutrophils=[];Game.antibodies=[];Game.boss=null;Game.stats=newStats();Game.result=null;});
  it('preserves the imported seeded RNG sequence',()=>{RNG.seed('REFERENCE');const first=[RNG.next(),RNG.next(),RNG.next()];RNG.seed('REFERENCE');expect([RNG.next(),RNG.next(),RNG.next()]).toEqual(first);expect(first).toEqual([0.846187248127535,0.8314471209887415,0.6517826695926487]);});
  it('returns a detached deeply frozen renderer-neutral snapshot',()=>{Game.tissues.push({id:1,hp:73});const snapshot=readSimulationSnapshot();expect(Object.isFrozen(snapshot)).toBe(true);expect(Object.isFrozen(snapshot.tissues)).toBe(true);expect(Object.isFrozen(snapshot.tissues[0])).toBe(true);Game.tissues[0].hp=20;expect(snapshot.tissues[0].hp).toBe(73);});
  it('contains no browser or renderer objects',()=>{const snapshot=readSimulationSnapshot();expect(JSON.stringify(snapshot)).not.toMatch(/Canvas|HTML|AudioContext|PIXI/);expect(snapshot.rngState).toBe(RNG.state);});
});
