import type { MatchCard } from "@/components/SwipeDeck";

export type MockUser = {
  id: string;
  name: string;
  gender: string;
  allow_coed_living: boolean;
};

export const MOCK_USERS: MockUser[] = [
  { id: "local-riya", name: "Riya", gender: "woman", allow_coed_living: false },
  { id: "local-arjun", name: "Arjun", gender: "man", allow_coed_living: false }
];

export const MOCK_CARDS: MatchCard[] = [
  {
    id: "mock-ananya", name: "Ananya", age: 25, gender: "woman", allow_coed_living: true,
    occupation: "Product designer · Bengaluru", is_kyc_verified: true,
    profile: { sleep_time: "11:30 PM", work_mode: "hybrid", food: "veg", cleaning_frequency: "weekends" },
    max_rent_budget: 18000, commute_location: "Indiranagar, Bengaluru", match_percentage: 96,
    green_flags: ["Similar rent range and commute priorities", "Both like a calm, tidy shared space", "Vegetarian-friendly kitchen habits"],
    potential_friction: ["Ananya sometimes has friends over on weekends"],
    icebreakers: ["What does your ideal slow Sunday look like?", "Any favourite coffee spots around Indiranagar?"],
    mockMutual: true
  },
  {
    id: "mock-meera", name: "Meera", age: 27, gender: "woman", allow_coed_living: true,
    occupation: "UX researcher · Bengaluru", is_kyc_verified: true,
    profile: { sleep_time: "12:30 AM", work_mode: "wfh", food: "eggetarian", cleaning_frequency: "daily" },
    max_rent_budget: 16000, commute_location: "Koramangala, Bengaluru", match_percentage: 91,
    green_flags: ["Strong budget overlap", "Both prefer a clean kitchen", "Work schedules leave room for shared downtime"],
    potential_friction: ["Meera works from home most weekdays"],
    icebreakers: ["What helps you focus when working from home?", "What would you love to have within walking distance?"],
    mockMutual: false
  },
  {
    id: "mock-kavya", name: "Kavya", age: 24, gender: "woman", allow_coed_living: true,
    occupation: "Masters student · Bengaluru", is_kyc_verified: true,
    profile: { sleep_time: "10:45 PM", work_mode: "student", food: "non_veg", cleaning_frequency: "weekends" },
    max_rent_budget: 14000, commute_location: "Jayanagar, Bengaluru", match_percentage: 88,
    green_flags: ["Rent expectations are a close fit", "Both are considerate about guests", "Weekend chore routines line up"],
    potential_friction: ["Kavya is an early sleeper during exam weeks"],
    icebreakers: ["What are you studying, and what got you interested in it?", "How do you like to split shared chores?"],
    mockMutual: true
  },
  {
    id: "mock-sana", name: "Sana", age: 26, gender: "woman", allow_coed_living: true,
    occupation: "Software engineer · Bengaluru", is_kyc_verified: true,
    profile: { sleep_time: "1:00 AM", work_mode: "hybrid", food: "non_veg", cleaning_frequency: "daily" },
    max_rent_budget: 20000, commute_location: "HSR Layout, Bengaluru", match_percentage: 84,
    green_flags: ["Good overlap on commute radius", "Both value clear communication", "Utilities and deposit budgets are compatible"],
    potential_friction: ["Sana keeps later hours and prefers a livelier home"],
    icebreakers: ["What does a good work-life balance look like for you?", "Are you more of a cook-at-home or explore-the-neighbourhood person?"],
    mockMutual: false
  },
  {
    id: "mock-isha", name: "Isha", age: 28, gender: "woman", allow_coed_living: true,
    occupation: "Architect · Bengaluru", is_kyc_verified: true,
    profile: { sleep_time: "11:00 PM", work_mode: "office", food: "veg", cleaning_frequency: "weekly" },
    max_rent_budget: 17000, commute_location: "Indiranagar, Bengaluru", match_percentage: 82,
    green_flags: ["Similar commute preferences", "Both are comfortable sharing utility costs", "Quiet weekday routines"],
    potential_friction: ["Isha prefers a weekly rather than daily cleaning rhythm"],
    icebreakers: ["What kind of home makes you feel most settled?", "Do you have a favourite neighbourhood to explore?"],
    mockMutual: true
  },
  {
    id: "mock-rohan", name: "Rohan", age: 27, gender: "man", allow_coed_living: true,
    occupation: "Product manager · Bengaluru", is_kyc_verified: true,
    profile: { sleep_time: "12:00 AM", work_mode: "hybrid", food: "veg", cleaning_frequency: "weekends" },
    max_rent_budget: 18000, commute_location: "Indiranagar, Bengaluru", match_percentage: 93,
    green_flags: ["Excellent rent and commute overlap", "Similar sleep and weekend cleaning habits", "Both prefer a thoughtful, low-drama home"],
    potential_friction: ["Rohan occasionally hosts a small dinner with advance notice"],
    icebreakers: ["What does your ideal shared home feel like?", "Any neighbourhood food spots you swear by?"],
    mockMutual: true
  },
  {
    id: "mock-dev", name: "Dev", age: 29, gender: "man", allow_coed_living: true,
    occupation: "Research scholar · Bengaluru", is_kyc_verified: true,
    profile: { sleep_time: "10:30 PM", work_mode: "student", food: "veg", cleaning_frequency: "weekly" },
    max_rent_budget: 15000, commute_location: "Jayanagar, Bengaluru", match_percentage: 87,
    green_flags: ["Comfortable overlap in budget", "Both prefer a quieter home", "Shared vegetarian kitchen preferences"],
    potential_friction: ["Dev has a much earlier sleep schedule"],
    icebreakers: ["What are you currently curious about?", "How do you like to unwind after a busy day?"],
    mockMutual: false
  },
  {
    id: "mock-ayaan", name: "Ayaan", age: 26, gender: "man", allow_coed_living: true,
    occupation: "Motion designer · Bengaluru", is_kyc_verified: true,
    profile: { sleep_time: "1:00 AM", work_mode: "wfh", food: "eggetarian", cleaning_frequency: "daily" },
    max_rent_budget: 19000, commute_location: "Koramangala, Bengaluru", match_percentage: 85,
    green_flags: ["Strong commute and rent fit", "Both are happy to share utility costs", "Similar flexible work routines"],
    potential_friction: ["Ayaan works from home and sometimes takes late calls"],
    icebreakers: ["What kind of creative work do you enjoy most?", "What is one thing your next home absolutely needs?"],
    mockMutual: true
  }
];
