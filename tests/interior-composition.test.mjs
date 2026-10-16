import test from 'node:test';
import assert from 'node:assert/strict';
import { generateInterior, defaultInteriorConfig, validateInterior } from '../src/core/interior.mjs';
import { roomComposition, furnitureParts, ROOM_COMPOSITIONS } from '../src/core/interior-style.mjs';
import { canStand } from '../src/game/physics.mjs';

const resume = { sections: [{ id:'projects', type:'projects', label:'Projects', entries:[{id:'one',title:'A documented project',details:['A documented detail.']}] }] };
const building = {id:'projects-house',sectionId:'projects',type:'projects',label:'Projects'};

test('curated room identities and purposeful groups preserve physical circulation across archetypes', () => {
  const anchors = {foyer:'arrival-bench',bedroom:'bed',reading:'reading-nook',catalog:'archive-stack',research:'researchdesk',archive:'archive-stack',workshop:'workbench',assembly:'workbench',stage:'music-corner',rehearsal:'music-corner',editing:'computer',greenroom:'arrival-bench',living:'reading-nook',study:'desk',storage:'parts-rack'};
  for (const archetype of ['home','library','workshop','studio']) for (const sequence of [[1,1,1,1,1,1],[2,3,4,5,6,7]]) {
    const config = {...defaultInteriorConfig(resume,building),archetype,nodeCount:8,sequence};
    const scene = generateInterior(resume,building,config);
    assert.equal(validateInterior(scene),true);
    for (const room of scene.rooms) {
      assert.ok(room.label.startsWith(roomComposition(room.role).name));
      const groups = scene.objects.filter(object => object.parts?.length && object.x >= room.x && object.y >= room.y && object.x < room.x + room.width && object.y < room.y + room.height);
      assert.ok(groups.length >= 2, `${room.label} needs a purposeful group, rather than a single isolated prop`);
      assert.ok(groups.some(object => object.type === anchors[room.role]), `${room.label} has its semantic anchor`);
      assert.ok(groups.some(object => object.y < room.y + room.height / 2), 'the north half is furnished');
      assert.ok(groups.some(object => object.y > room.y + room.height / 2), 'the lower usable furniture zones remain available');
      for (const object of groups) {
        assert.equal(canStand(object.interactAt,scene),true);
        assert.equal(canStand({x:object.x+8,y:object.y+8},scene),false);
        for (const part of object.parts) assert.ok(part.x >= 0 && part.y >= 0 && part.x + part.width <= object.width && part.y + part.height <= object.height, 'visible pieces stay within solid footprints');
      }
    }
    const changed = generateInterior(resume,building,{...config,layoutSeed:'different-layout',decorationSeed:'different-decorations'});
    assert.deepEqual(scene.rooms.map(room => room.label),changed.rooms.map(room => room.label),'a room identity survives seed changes');
  }
});

test('every declared composition uses bounded existing-asset parts', () => {
  for (const style of Object.values(ROOM_COMPOSITIONS)) for (const type of style.features) {
    const parts = furnitureParts(type,1); assert.equal(parts.length,4);
    for (const part of parts) { assert.ok(part.index >= 0 && part.index < (part.sheet === 'interior' ? 486 : 132)); assert.equal(part.width,16); assert.equal(part.height,16); }
  }
});
