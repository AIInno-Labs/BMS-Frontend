/** Sample director thread shown in the job notes sidebar (demo / preview only). */

export interface DemoChatMessage {
  id: string;
  author: string;
  initials: string;
  time: string;
  body: string;
  /** When true, bubble aligns right (current viewer). */
  isSelf?: boolean;
}

export const DEMO_DIRECTOR_CHAT: DemoChatMessage[] = [
  {
    id: "d1",
    author: "Dirk B",
    initials: "DB",
    time: "Today, 8:42 am",
    body: "Steve — can you confirm lead time on the liner mould before Friday’s client call?",
  },
  {
    id: "d2",
    author: "Steve B",
    initials: "SB",
    time: "Today, 9:05 am",
    body: "Checked with shop floor. 12 working days if PO is released tomorrow. I’ll update program history.",
    isSelf: true,
  },
  {
    id: "d3",
    author: "Hugh",
    initials: "H",
    time: "Today, 9:18 am",
    body: "Client asked for QC photos on this one — flagging in requirements. No change to due date yet.",
  },
  {
    id: "d4",
    author: "Dave",
    initials: "D",
    time: "Today, 10:02 am",
    body: "PO raised with procurement. Copying finance on the thread — please keep updates in this channel only.",
  },
  {
    id: "d5",
    author: "Dirk B",
    initials: "DB",
    time: "Today, 10:15 am",
    body: "Thanks all. @Steve — once Rev A is issued, post here so we have a single audit trail for directors.",
  },
];
