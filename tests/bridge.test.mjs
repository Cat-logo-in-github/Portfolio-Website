import test from 'node:test';
import assert from 'node:assert/strict';
import { bridgeStatus, bridgePositions } from '../src/core/bridge.mjs';

const data = { nodes: [{id:1,x:40,y:60},{id:2,x:100,y:25},{id:3,x:160,y:60},{id:4,x:185,y:145},{id:5,x:120,y:175},{id:6,x:55,y:145}], edges: [{from:1,to:2},{from:2,to:3},{from:4,to:5},{from:5,to:6}], candidates:[{id:'bridge',from:3,to:4},{id:'decoy-a',from:1,to:3},{id:'decoy-b',from:4,to:6}], start:1, goal:6 };
test('bridge components report the actual disconnected and restored network',()=>{assert.equal(bridgeStatus(data,'').components,2);assert.equal(bridgeStatus(data,'decoy-a').components,2);assert.equal(bridgeStatus(data,'bridge').components,1);});
test('bridge tracing permits only adjacent unvisited stations and starts at START',()=>{assert.deepEqual(bridgeStatus(data,'bridge').next,[1]);assert.deepEqual(bridgeStatus(data,'bridge',[1,2]).next,[3]);assert.equal(bridgeStatus(data,'bridge',[2,1]).validTrace,false);assert.equal(bridgeStatus(data,'bridge',[1,3]).validTrace,false);});
test('a connected network alone cannot submit; the complete shortest trace is required',()=>{assert.equal(bridgeStatus(data,'bridge').ready,false);assert.equal(bridgeStatus(data,'bridge',[1,2,3]).ready,false);assert.equal(bridgeStatus(data,'bridge',[1,2,3,4,5,6]).ready,true);assert.equal(bridgeStatus(data,'bridge',[1,2,3,4,5,6]).hops,5);});
test('responsive display coordinates preserve distinct stations within safe edge margins',()=>{const points=bridgePositions(data);assert.equal(points.size,6);for(const point of points.values()){assert.ok(point.x>=15&&point.x<=85);assert.ok(point.y>=20&&point.y<=80);}assert.deepEqual(bridgePositions(data),points);});
