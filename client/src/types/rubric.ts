export interface RatingSuggestion {
  score: number;
  description: string;
  example?: string;
}

export interface Criteria {
  id: string;
  name: string;
  description: string;
  maxScore: number;
  ratingSuggestions: RatingSuggestion[];
  createdAt: string;
  updatedAt: string;
}

export interface Rubric {
  id: string;
  name: string;
  description: string;
  criteria: Criteria[];
  totalPossibleScore: number;
  createdAt: string;
}

// Dummy data for initial development
export const DUMMY_CRITERIA: Criteria[] = [
  {
    id: "1",
    name: "Educational Impact",
    description:
      "How does the proposed project enhance the educational experience at Weber State University?",
    maxScore: 35,
    ratingSuggestions: [
      {
        score: 35,
        description: "Impacts a large number of students or several programs",
      },
      { score: 20, description: "Impacts many students in one program" },
      { score: 5, description: "Impacts a small number of students" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Student Reach",
    description:
      "How many students are impacted? Are multiple departments or programs involved?",
    maxScore: 25,
    ratingSuggestions: [
      { score: 25, description: "500+ students across 3+ departments" },
      { score: 15, description: "200-500 students in 1-2 departments" },
      { score: 5, description: "Less than 200 students" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Innovation",
    description:
      "Does this project introduce new teaching methods or technologies?",
    maxScore: 20,
    ratingSuggestions: [
      { score: 20, description: "Highly innovative - new to WSU" },
      { score: 10, description: "Moderately innovative - builds on existing" },
      { score: 5, description: "Low innovation - standard approach" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "4",
    name: "Sustainability",
    description:
      "Will the project continue to provide value after funding ends?",
    maxScore: 20,
    ratingSuggestions: [
      { score: 20, description: "Fully sustainable - minimal ongoing costs" },
      {
        score: 10,
        description: "Partially sustainable - some ongoing funding needed",
      },
      {
        score: 5,
        description: "Not sustainable - requires continuous funding",
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
