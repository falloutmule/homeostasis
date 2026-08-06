/* eslint-disable @typescript-eslint/no-explicit-any */
export function tissueState(t:any){if(t.debris<0)return 4;if(t.hp<=0)return 3;if(t.hp<45)return 2;if(t.hp<76)return 1;return 0;}
export function tissueIntegrity(tissues:any[]){let sum=0,max=0;for(const t of tissues){max+=100*t.importance;if(t.debris<0)sum+=18*t.importance;else sum+=Math.max(0,t.hp)*t.importance;}return max?sum/max:0;}
export function bossFraction(boss:any){if(!boss||boss.dead)return 0;return(boss.matrixHp+boss.coreHp)/(boss.matrixMax+boss.coreMax);}
export function homeostasisBand(pathogenLoad:number){return{safeLow:.08+pathogenLoad*.32,safeHigh:.22+pathogenLoad*.58};}
export function terminalReason(game:any){if(game.resolveHold>=8)return{won:true,reason:'homeostatic'};if(game.player.hp<=0)return{won:false,reason:'response_core'};if(game.tissueIntegrity<=.035)return{won:false,reason:'tissue_collapse'};if(game.stormTime>=11)return{won:false,reason:'cytokine_storm'};if(game.bacteria.length>=240&&game.infectionMaxTime>3)return{won:false,reason:'infection_runaway'};return null;}
