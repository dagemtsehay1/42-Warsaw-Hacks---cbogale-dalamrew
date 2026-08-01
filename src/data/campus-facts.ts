export const CAMPUS_FACTS = [
  "42 is a peer-to-peer learning school — no teachers, no tuition.",
  "Projects at 42 are validated through peer evaluations called scales.",
  "Coalitions compete for points earned through projects, events, and challenges.",
  "The Common Core builds C, systems, networking, and graphics foundations.",
  "ft_transcendence is a major milestone near the end of the core cursus.",
  "Logtime on campus hosts helps track presence, not productivity alone.",
  "Warsaw is one of the European campuses in the 42 Network.",
  "A black hole date marks progress expectations — stay ahead by shipping projects.",
  "Teams can tackle larger projects together; solo work builds deep craft.",
  "Evaluations go both ways: correcting peers is part of learning.",
];

export function pickDidYouKnow(seed: number): string {
  return CAMPUS_FACTS[Math.abs(seed) % CAMPUS_FACTS.length] ?? CAMPUS_FACTS[0];
}
