export type VesselSignalFace = {
  imageSrc: string;
  description: string;
};

export type VesselSignalCard = {
  id: string;
  name: string;
  day: VesselSignalFace;
  night: VesselSignalFace;
};

export const vesselSignalCards: VesselSignalCard[] = [
  {
    id: 'power-under-50',
    name: 'Power-driven vessel under 50 m',
    day: { imageSrc: 'images/colreg-vessels/normal-underway-day.svg', description: 'No special day shape is prescribed while underway.' },
    night: { imageSrc: 'images/colreg-vessels/power-driven-under-50-night.svg', description: 'One masthead light, sidelights and a sternlight.' }
  },
  {
    id: 'power-50-plus',
    name: 'Power-driven vessel 50 m or more',
    day: { imageSrc: 'images/colreg-vessels/normal-underway-day.svg', description: 'No special day shape is prescribed while underway.' },
    night: { imageSrc: 'images/colreg-vessels/power-driven-50-plus-night.svg', description: 'Two masthead lights, sidelights and a sternlight.' }
  },
  {
    id: 'sailing',
    name: 'Sailing vessel underway',
    day: { imageSrc: 'images/colreg-vessels/sailing-vessel-day.svg', description: 'No special day shape is prescribed when proceeding under sail alone.' },
    night: { imageSrc: 'images/colreg-vessels/sailing-vessel-night.svg', description: 'Sidelights and a sternlight, with no masthead light.' }
  },
  {
    id: 'sailing-under-power',
    name: 'Sailing vessel under machinery',
    day: { imageSrc: 'images/colreg-vessels/sailing-under-power-day.svg', description: 'A black cone with its apex downward.' },
    night: { imageSrc: 'images/colreg-vessels/sailing-under-power-night.svg', description: 'Shows the lights of a power-driven vessel, not sailing-vessel lights.' }
  },
  {
    id: 'tow-under-200',
    name: 'Towing vessel — tow up to 200 m',
    day: { imageSrc: 'images/colreg-vessels/towing-under-200-day.svg', description: 'No length-of-tow diamond is required when the tow does not exceed 200 m.' },
    night: { imageSrc: 'images/colreg-vessels/towing-under-200-night.svg', description: 'Two masthead lights vertically, sidelights, sternlight and a yellow towing light.' }
  },
  {
    id: 'tow-over-200',
    name: 'Towing vessel — tow over 200 m',
    day: { imageSrc: 'images/colreg-vessels/tow-over-200-day-diamond.svg', description: 'A black diamond where it can best be seen.' },
    night: { imageSrc: 'images/colreg-vessels/towing-over-200-night.svg', description: 'Three masthead lights vertically, sidelights, sternlight and a yellow towing light.' }
  },
  {
    id: 'pushing',
    name: 'Pushing ahead or towing alongside',
    day: { imageSrc: 'images/colreg-vessels/pushing-ahead-day.svg', description: 'No special day shape unless another condition, such as tow length, requires one.' },
    night: { imageSrc: 'images/colreg-vessels/pushing-ahead-night.svg', description: 'Two masthead lights vertically, sidelights and a sternlight.' }
  },
  {
    id: 'trawling',
    name: 'Fishing vessel — trawling',
    day: { imageSrc: 'images/colreg-vessels/fishing-day.svg', description: 'Two black cones with their apexes together.' },
    night: { imageSrc: 'images/colreg-vessels/trawling-night.svg', description: 'Green over white all-round lights, plus making-way lights when underway.' }
  },
  {
    id: 'fishing-other',
    name: 'Fishing vessel — other than trawling',
    day: { imageSrc: 'images/colreg-vessels/fishing-day.svg', description: 'Two black cones with their apexes together.' },
    night: { imageSrc: 'images/colreg-vessels/fishing-not-trawling-night.svg', description: 'Red over white all-round lights, plus making-way lights when underway.' }
  },
  {
    id: 'fishing-gear',
    name: 'Fishing gear extending over 150 m',
    day: { imageSrc: 'images/colreg-vessels/fishing-gear-over-150-day.svg', description: 'An additional cone, apex upward, in the direction of the gear.' },
    night: { imageSrc: 'images/colreg-vessels/fishing-gear-over-150-night.svg', description: 'An additional all-round white light in the direction of the gear.' }
  },
  {
    id: 'nuc',
    name: 'Not under command (NUC)',
    day: { imageSrc: 'images/colreg-vessels/not-under-command-day.svg', description: 'Two black balls in a vertical line.' },
    night: { imageSrc: 'images/colreg-vessels/not-under-command-night.svg', description: 'Two red all-round lights vertically, plus making-way lights if making way.' }
  },
  {
    id: 'ram',
    name: 'Restricted in ability to manoeuvre (RAM)',
    day: { imageSrc: 'images/colreg-vessels/restricted-ability-day.svg', description: 'Ball, diamond, ball in a vertical line.' },
    night: { imageSrc: 'images/colreg-vessels/restricted-ability-night.svg', description: 'Red, white, red all-round lights vertically, plus applicable underway lights.' }
  },
  {
    id: 'cbd',
    name: 'Constrained by draught (CBD)',
    day: { imageSrc: 'images/colreg-vessels/constrained-by-draught-day.svg', description: 'A black cylinder where it can best be seen.' },
    night: { imageSrc: 'images/colreg-vessels/constrained-by-draught-night.svg', description: 'Three red all-round lights vertically, plus power-driven underway lights.' }
  },
  {
    id: 'pilot',
    name: 'Pilot vessel on duty',
    day: { imageSrc: 'images/colreg-vessels/pilot-vessel-day.svg', description: 'COLREGs prescribe no special day shape; Singapore vessels under pilotage exhibit flag H by day.' },
    night: { imageSrc: 'images/colreg-vessels/pilot-vessel-night.svg', description: 'White over red all-round lights, plus sidelights and sternlight when underway.' }
  },
  {
    id: 'anchor-under-50',
    name: 'Vessel at anchor under 50 m',
    day: { imageSrc: 'images/colreg-vessels/anchored-under-50-day.svg', description: 'One black ball where it can best be seen.' },
    night: { imageSrc: 'images/colreg-vessels/anchored-under-50-night.svg', description: 'One all-round white light where it can best be seen.' }
  },
  {
    id: 'anchor-50-plus',
    name: 'Vessel at anchor 50 m or more',
    day: { imageSrc: 'images/colreg-vessels/anchored-under-50-day.svg', description: 'One black ball where it can best be seen.' },
    night: { imageSrc: 'images/colreg-vessels/anchored-50-plus-night.svg', description: 'Forward and aft all-round white lights, with the forward light higher.' }
  },
  {
    id: 'aground',
    name: 'Vessel aground',
    day: { imageSrc: 'images/colreg-vessels/aground-day.svg', description: 'Three black balls in a vertical line.' },
    night: { imageSrc: 'images/colreg-vessels/aground-night.svg', description: 'Anchor lights plus two red all-round lights in a vertical line.' }
  }
];

export type ResponsibilityStatus = 'give-way' | 'stand-on' | 'do-not-impede' | 'depends';

export type VesselResponsibilityType = {
  id: string;
  shortName: string;
  name: string;
};

export const responsibilityVessels: VesselResponsibilityType[] = [
  { id: 'power', shortName: 'Power', name: 'Power-driven vessel' },
  { id: 'sailing', shortName: 'Sail', name: 'Sailing vessel' },
  { id: 'fishing', shortName: 'Fishing', name: 'Vessel engaged in fishing' },
  { id: 'cbd', shortName: 'CBD', name: 'Vessel constrained by draught' },
  { id: 'ram', shortName: 'RAM', name: 'Vessel restricted in ability to manoeuvre' },
  { id: 'nuc', shortName: 'NUC', name: 'Vessel not under command' },
  { id: 'seaplane', shortName: 'Seaplane', name: 'Seaplane on the water' }
];

export const responsibilityMatrix: Record<string, Record<string, ResponsibilityStatus>> = {
  power: { power: 'depends', sailing: 'give-way', fishing: 'give-way', cbd: 'do-not-impede', ram: 'give-way', nuc: 'give-way', seaplane: 'stand-on' },
  sailing: { power: 'stand-on', sailing: 'depends', fishing: 'give-way', cbd: 'do-not-impede', ram: 'give-way', nuc: 'give-way', seaplane: 'stand-on' },
  fishing: { power: 'stand-on', sailing: 'stand-on', fishing: 'depends', cbd: 'do-not-impede', ram: 'give-way', nuc: 'give-way', seaplane: 'stand-on' },
  cbd: { power: 'stand-on', sailing: 'stand-on', fishing: 'stand-on', cbd: 'depends', ram: 'give-way', nuc: 'give-way', seaplane: 'stand-on' },
  ram: { power: 'stand-on', sailing: 'stand-on', fishing: 'stand-on', cbd: 'stand-on', ram: 'depends', nuc: 'depends', seaplane: 'stand-on' },
  nuc: { power: 'stand-on', sailing: 'stand-on', fishing: 'stand-on', cbd: 'stand-on', ram: 'depends', nuc: 'depends', seaplane: 'stand-on' },
  seaplane: { power: 'give-way', sailing: 'give-way', fishing: 'give-way', cbd: 'give-way', ram: 'give-way', nuc: 'give-way', seaplane: 'depends' }
};

export const responsibilityLabels: Record<ResponsibilityStatus, { label: string; detail: string }> = {
  'give-way': { label: 'Give way', detail: 'Keep out of the other vessel’s way.' },
  'stand-on': { label: 'Stand on', detail: 'Initially keep course and speed, but remain ready to avoid collision.' },
  'do-not-impede': { label: 'Do not impede', detail: 'Allow safe passage; this is not the same as an absolute right of way.' },
  depends: { label: 'Depends', detail: 'Use the encounter, overtaking, visibility and special-waterway rules.' }
};

export const giveWayRuleCards = [
  { title: 'Overtaking comes first', rule: 'The overtaking vessel keeps clear, regardless of vessel type. If in doubt, assume you are overtaking.' },
  { title: 'Power-driven head-on', rule: 'Both vessels alter course to starboard and pass port-to-port.' },
  { title: 'Power-driven crossing', rule: 'If the other vessel is on your starboard side, you give way and avoid crossing ahead.' },
  { title: 'Two sailing vessels', rule: 'Port tack gives way to starboard tack. On the same tack, the windward vessel gives way to the leeward vessel.' },
  { title: 'Give-way and stand-on duties', rule: 'Give-way action must be early and substantial. A stand-on vessel must still act when the give-way vessel fails to act. Five short rapid blasts signal doubt.' },
  { title: 'Narrow channels', rule: 'Keep near the starboard limit. Sailing vessels and vessels under 20 m must not impede a vessel confined to the channel; fishing vessels must not impede channel traffic. Crossing must not impede. Overtake only after agreement, and sound one prolonged blast near a blind bend.' },
  { title: 'Traffic separation schemes', rule: 'Follow the traffic flow and cross lanes as nearly as practicable at right angles. Fishing, sailing and vessels under 20 m must not impede a power-driven vessel following a lane.' },
  { title: 'Restricted visibility', rule: 'Use Rule 19 rather than ordinary in-sight stand-on assumptions. Proceed at safe speed; if danger is detected or a fog signal is heard forward of the beam, reduce to minimum steerage way, stop if necessary and navigate with extreme caution.' }
];

export type SignalFlag = {
  letter: 'A' | 'B' | 'H' | 'Q';
  phonetic: string;
  imageSrc: string;
  meaning: string;
  precaution: string;
  memory: string;
  emphasis?: string;
};

export const signalFlags: SignalFlag[] = [
  {
    letter: 'A', phonetic: 'Alfa', imageSrc: 'images/signal-flags/alfa.svg',
    meaning: 'I have a diver down; keep well clear at slow speed.',
    precaution: 'Reduce to slow speed, keep well clear, watch for divers and support craft, and avoid propeller or wake hazards near the operation.',
    memory: 'A = A diver is down', emphasis: 'Slow down • Keep clear'
  },
  {
    letter: 'B', phonetic: 'Bravo', imageSrc: 'images/signal-flags/bravo.svg',
    meaning: 'I am taking in, discharging, or carrying dangerous goods.',
    precaution: 'Keep well clear, avoid unnecessary close passing or boarding, and keep flames, smoking, sparks and other ignition sources away.',
    memory: 'B = Beware of dangerous goods', emphasis: 'Keep clear • No ignition sources'
  },
  {
    letter: 'H', phonetic: 'Hotel', imageSrc: 'images/signal-flags/hotel.svg',
    meaning: 'I have a pilot on board.',
    precaution: 'Give the vessel ample sea room, avoid crossing closely ahead or impeding it, and continue applying the normal COLREG encounter rules. This flag does not create automatic right of way.',
    memory: 'H = Harbour pilot aboard'
  },
  {
    letter: 'Q', phonetic: 'Quebec', imageSrc: 'images/signal-flags/quebec.svg',
    meaning: 'My vessel is healthy and I request free pratique.',
    precaution: 'In Singapore waters, remain at least 200 m away. Do not board or proceed alongside until the clearance signal is lowered or authorization is given.',
    memory: 'Q = Quarantine clearance requested', emphasis: 'Singapore: stay at least 200 m away'
  }
];
