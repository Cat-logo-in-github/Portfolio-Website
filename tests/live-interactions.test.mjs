import test from 'node:test';
import assert from 'node:assert/strict';
import { liveNearby, liveObject, liveObjects } from '../src/game/live-interactions.mjs';

const scene = {id:'village',kind:'village',bounds:{width:256,height:256},spawn:{x:80,y:80},paths:[],locations:[],decorations:[],objects:[{id:'sign',x:100,y:100,width:16,height:16,solid:false,range:40,interactAt:{x:110,y:110},actions:[{kind:'inspect'}]}]};
const creature = {id:'mouse',sceneId:'village',areaId:'village',species:'mouse',name:'Margin Mouse',x:88,y:80,sprite:{sheet:'dungeon',index:124}};

test('nearby activation resolves current moving actor metadata and never targets an actor in another scene', () => {
  const simulation = {entities:[creature]};
  assert.equal(liveNearby(scene.spawn,scene,simulation).id,'mouse');
  const moved = {entities:[{...creature,x:120,y:80}]};
  assert.equal(liveObject('mouse',scene,moved).interactAt.x,120);
  assert.equal(liveNearby(scene.spawn,scene,{entities:[{...creature,x:220}]}),null,'moving away invalidates the old HUD target');
  assert.equal(liveNearby(scene.spawn,scene,{entities:[{...creature,sceneId:'another-room'}]}),null);
  assert.equal(liveObjects(scene,{entities:[{...creature,sceneId:'another-room'}]}).length,0);
  assert.equal(scene.objects.length,1,'live entities do not enter static collision data');
});

test('closer static objects retain interaction priority and fresh object state', () => {
  const player = {x:108,y:108};
  assert.equal(liveNearby(player,scene,{entities:[{...creature,x:140,y:108}]}).id,'sign');
  assert.equal(liveObject('sign',{...scene,objects:[{...scene.objects[0],label:'Repaired sign'}]},null).label,'Repaired sign');
});
