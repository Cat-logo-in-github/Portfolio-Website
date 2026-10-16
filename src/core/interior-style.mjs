/** Curated room identities and furniture groups; structural placement stays in interior.mjs. */
export const ROOM_COMPOSITIONS = Object.freeze({
  foyer: { name: 'Welcome Hall', density: 4, features: ['arrival-bench', 'plant-corner', 'notice-desk'], floor: 'wood', rug: 'teal', accent: '#8b9670', wall: 'window', story: 'A half-folded map waits beside a pair of muddy boots.' },
  living: { name: 'Field Notes Lounge', density: 4, features: ['reading-nook', 'keepsake-cabinet', 'plant-corner'], floor: 'wood', rug: 'gold', accent: '#aa765f', wall: 'picture', story: 'A reading lamp marks a page someone meant to finish.' },
  study: { name: 'Writing Nook', density: 4, features: ['desk', 'reading-nook', 'plant-corner'], floor: 'wood', rug: 'teal', accent: '#758e9c', wall: 'picture', story: 'The desk is tidy except for one page of very untidy questions.' },
  bedroom: { name: 'Quiet Quarters', density: 4, features: ['bed', 'keepsake-cabinet', 'plant-corner'], floor: 'wood', rug: 'gold', accent: '#9a7b83', wall: 'window', story: 'A folded blanket, a bedside book, and a place to leave the day behind.' },
  storage: { name: 'Parts & Keepsakes', density: 6, features: ['parts-rack', 'chest', 'keepsake-cabinet'], floor: 'stone', rug: 'none', accent: '#8a846c', wall: 'tools', story: 'Every small box is labelled. The largest one simply says “later”.' },
  reading: { name: 'Reading Gallery', density: 6, features: ['bookshelf', 'reading-nook', 'notice-desk', 'plant-corner'], floor: 'wood', rug: 'teal', accent: '#617f92', wall: 'window', story: 'The shelves frame a quiet reading table and a trail of bookmarks.' },
  catalog: { name: 'Card Catalogue', density: 6, features: ['archive-stack', 'bookshelf', 'notice-desk'], floor: 'wood', rug: 'teal', accent: '#70847e', wall: 'picture', story: 'A catalogue card points to a shelf that has been pencilled in by hand.' },
  research: { name: 'Experiment Desk', density: 6, features: ['researchdesk', 'parts-rack', 'archive-stack'], floor: 'stone', rug: 'teal', accent: '#628c86', wall: 'signal', story: 'Beside the apparatus: observations, a crossed-out prediction, and a better question.' },
  archive: { name: 'Draft Archive', density: 6, features: ['archive-stack', 'bookshelf', 'chest'], floor: 'wood', rug: 'none', accent: '#85725d', wall: 'picture', story: 'Unfinished drafts are stored with the same care as finished work.' },
  workshop: { name: 'Prototype Workshop', density: 6, features: ['workbench', 'parts-rack', 'computer', 'notice-desk'], floor: 'stone', rug: 'none', accent: '#927953', wall: 'tools', story: 'An open prototype sits among tools and neatly sorted spare parts.' },
  assembly: { name: 'Assembly Bay', density: 6, features: ['workbench', 'parts-rack', 'computer'], floor: 'stone', rug: 'none', accent: '#8a906b', wall: 'tools', story: 'Two work surfaces face a clear aisle. The next repair can begin here.' },
  stage: { name: 'The Small Stage', density: 4, features: ['music-corner', 'artboard', 'arrival-bench'], floor: 'wood', rug: 'gold', accent: '#a96e77', wall: 'picture', story: 'A spare chair and a waiting instrument leave room for the next performer.' },
  editing: { name: 'Editing Suite', density: 4, features: ['computer', 'editing-rack', 'notice-desk'], floor: 'wood', rug: 'teal', accent: '#78849b', wall: 'signal', story: 'A workstation holds a rough cut, notes, and one carefully saved alternative.' },
  rehearsal: { name: 'Rehearsal Floor', density: 4, features: ['music-corner', 'arrival-bench', 'artboard'], floor: 'wood', rug: 'gold', accent: '#9d7d71', wall: 'picture', story: 'The room keeps its centre open. A small mark shows where to begin again.' },
  greenroom: { name: 'Backstage Retreat', density: 4, features: ['arrival-bench', 'plant-corner', 'keepsake-cabinet'], floor: 'wood', rug: 'teal', accent: '#6e8a70', wall: 'window', story: 'A warm lamp and a quiet corner for the breath before a performance.' },
});
export function roomComposition(role) { return ROOM_COMPOSITIONS[role] || ROOM_COMPOSITIONS.study; }
const part = (sheet, index, x, y) => ({ sheet, index, x, y, width: 16, height: 16 });
const table = () => [part('interior', 0, 0, 16), part('interior', 2, 16, 16)];
export function furnitureParts(type, variant = 0) {
  const plant = variant % 2 ? 17 : 16;
  const groups = {
    computer: () => [...table(), part('dungeon', 54, 0, 0), part('interior', 475, 16, 0)],
    researchdesk: () => [...table(), part('interior', 475, 0, 0), part('dungeon', 114, 16, 0)],
    desk: () => [...table(), part('interior', 475, 0, 0), part('interior', 178, 16, 0)],
    lectern: () => [...table(), part('interior', 475, 0, 0), part('interior', 178, 16, 0)],
    trophy: () => [...table(), part('dungeon', 82, 0, 0), part('interior', 344, 16, 0)],
    bookshelf: () => [part('interior', 478, 0, 0), part('interior', 479, 16, 0), part('interior', 466, 0, 16), part('interior', 480, 16, 16)],
    artboard: () => [...table(), part('interior', 344, 0, 0), part('interior', 342, 16, 0)],
    bed: () => [part('interior', 197, 0, 0), part('interior', 230, 0, 16), part('interior', plant, 16, 0), part('interior', 466, 16, 16)],
    chest: () => [part('dungeon', 89, 0, 16), part('interior', 466, 16, 16), part('interior', 475, 0, 0), part('interior', 157, 16, 0)],
    workbench: () => [part('town', 117, 0, 0), part('town', 118, 16, 0), part('interior', 466, 0, 16), part('interior', 466, 16, 16)],
    'parts-rack': () => [part('town', 118, 0, 0), part('town', 115, 16, 0), part('interior', 439, 0, 16), part('interior', 466, 16, 16)],
    'reading-nook': () => [part('interior', 5, 0, 0), part('interior', 475, 16, 0), part('interior', 135, 0, 16), part('interior', 479, 16, 16)],
    'arrival-bench': () => [part('interior', plant, 0, 0), part('interior', 178, 16, 0), part('interior', 193, 0, 16), part('interior', 196, 16, 16)],
    'plant-corner': () => [part('interior', plant, 0, 0), part('interior', plant === 16 ? 17 : 16, 16, 0), part('interior', 466, 0, 16), part('interior', 466, 16, 16)],
    'notice-desk': () => [...table(), part('town', 83, 0, 0), part('interior', 475, 16, 0)],
    'archive-stack': () => [part('interior', 479, 0, 0), part('interior', 480, 16, 0), part('interior', 479, 0, 16), part('interior', 480, 16, 16)],
    'keepsake-cabinet': () => [part('interior', 340, 0, 0), part('interior', 178, 16, 0), part('interior', 466, 0, 16), part('interior', 466, 16, 16)],
    'music-corner': () => [part('interior', 239, 0, 0), part('interior', 240, 16, 0), part('interior', 135, 0, 16), part('interior', 138, 16, 16)],
    'editing-rack': () => [part('dungeon', 54, 0, 0), part('dungeon', 55, 16, 0), part('interior', 466, 0, 16), part('interior', 439, 16, 16)],
    lamp: () => [...table(), part('interior', 178, 0, 0), part('interior', plant, 16, 0)],
    table: () => [...table(), part('interior', 475, 0, 0), part('interior', plant, 16, 0)],
  };
  return (groups[type] || groups.desk)();
}
export function featureLabel(type) { return ({ 'arrival-bench': 'Arrival bench', 'plant-corner': 'Window plants', 'notice-desk': 'Map and notice desk', 'reading-nook': 'Reading nook', 'parts-rack': 'Sorted parts rack', 'archive-stack': 'Draft shelves', 'keepsake-cabinet': 'Keepsake cabinet', 'music-corner': 'Instrument corner', 'editing-rack': 'Editing equipment' })[type] || type.charAt(0).toUpperCase() + type.slice(1); }

