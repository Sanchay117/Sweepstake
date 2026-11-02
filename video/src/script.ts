// The film's narration, in order. `text` is what the captions show; `say` (when set) is what the
// voice reads, spelled for the ear. scripts/voice.ts turns each entry into public/vo/<id>.wav and
// records its timing in public/vo/manifest.json.

export interface Line {
  id: string;
  text: string;
  say?: string;
  /** Seconds of picture before the narrator starts. */
  lead?: number;
  /** Seconds of picture after the narrator stops. */
  tail?: number;
  /** The scene is never shorter than this, voice or not. */
  minSeconds?: number;
  /** Speeds the take up without changing its pitch. */
  tempo?: number;
}

/** The teaser is cut to its music, so these lines sit at fixed places in scenes/Teaser.tsx. */
export const TEASER: Line[] = [
  { id: "t-1956", text: "In 1956, Britain made savers a strange offer.", say: "In nineteen fifty six, Britain made savers a strange offer.", tempo: 1.12 },
  { id: "t-offer", text: "Keep your money. Risk only the interest.", tempo: 1.12 },
  { id: "t-raffle", text: "Critics called it a squalid raffle.", tempo: 1.12 },
  { id: "t-billion", text: "Today, £137 billion sits in the draw.", say: "Today, a hundred and thirty seven billion pounds sits in the draw.", tempo: 1.12 },
  { id: "t-india", text: "India printed the rule on the bond. No interest. Only prizes.", tempo: 1.12 },
  { id: "t-portaldot", text: "Now it runs on Portaldot.", tempo: 1.12 },
  { id: "t-stake", text: "Stake POT. Keep it. One member wins everyone's yield.", tempo: 1.12 },
  { id: "t-name", text: "Sweepstake." },
];

/** The demo, one line per scene. */
export const DEMO: Line[] = [
  {
    id: "hero",
    text: "This is the real website. Every number on this bond is read from the chain, in your browser. And every bond is real POT, staked with Portaldot's validators. More POT staked, by more people.",
    lead: 0.6,
    tail: 0.5,
  },
  {
    id: "counter",
    text: "Bonding takes one click. Your Ethereum wallet signs one transaction, and Portaldot V3 runs it as a native pool call. No second wallet. No wrapped token.",
    lead: 0.4,
    tail: 0.5,
  },
  {
    id: "register",
    text: "Your tickets are your bonded tokens, so your odds are plain arithmetic, and the register is read straight from chain state.",
    lead: 0.3,
    tail: 0.4,
  },
  {
    id: "loop",
    text: "The pool stakes everything. Its commission is one hundred percent, payable to a contract of 1,785 bytes, and the role that could change that has been renounced. Whatever the contract holds is the prize.",
    say: "The pool stakes everything. Its commission is one hundred percent, payable to a contract of seventeen hundred and eighty five bytes, and the role that could change that has been renounced. Whatever the contract holds is the prize.",
    lead: 0.5,
    tail: 0.7,
  },
  {
    id: "draw",
    text: "The keeper commits a Merkle root of every bond. Five blocks later, a block hash nobody could know picks the ticket. If the keeper walks away, anyone can finish the draw from this page.",
    lead: 0.4,
    tail: 0.5,
  },
  {
    id: "check",
    text: "Then check it. Your browser rebuilds the round from public chain state, matches the root, recomputes the ticket, and lands on the same winner.",
    lead: 0.3,
    tail: 0.7,
  },
  {
    id: "exit",
    text: "Leaving needs nothing from us. Unbond goes straight to the chain's own pallet.",
    lead: 0.3,
    tail: 0.7,
  },
  {
    id: "portaldot",
    text: "This needs Portaldot. Native pools for the yield. Ethereum calls that run natively. Solidity on Revive, reading native income. Take one away and it stops working.",
    lead: 0.5,
    tail: 0.7,
  },
  {
    id: "safety",
    text: "And no contract ever holds a deposit. The worst a bug can lose is one prize.",
    lead: 0.4,
    tail: 0.9,
  },
  {
    id: "proof",
    text: "Everything you just saw ran on Portaldot's live testnet, with a stand-in wallet. Real draws have already paid out. Thirty two tests pass, and a fresh clone reproduces every step.",
    lead: 0.5,
    tail: 0.7,
  },
  {
    id: "close",
    text: "Stake POT. Keep it. One member wins everyone's yield.",
    lead: 0.8,
    tail: 2.4,
  },
];

export const SCRIPT: Line[] = [...TEASER, ...DEMO];
