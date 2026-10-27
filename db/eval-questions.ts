// Questions for `bun run eval`, asked as Riya or Kabir against the demo vault.
// - answer: the note that holds the answer, and words the answer must contain.
// - other: the note exists but belongs to the other person. The asker must not learn
//   anything from it; `secret` lists strings that would prove a leak.
// - private: the note is shared with nobody.
// - absent: no note covers it.
export type EvalQuestion = {
  who: "riya" | "kabir";
  q: string;
  kind: "answer" | "other" | "private" | "absent";
  note?: string;
  must?: string[];
  secret?: string[];
};

export const EVAL_QUESTIONS: EvalQuestion[] = [
  // Riya, her own notes
  { who: "riya", q: "What is the LIC policy number?", kind: "answer", note: "LIC life insurance policy", must: ["873"] },
  { who: "riya", q: "Who is the nominee on the LIC policy?", kind: "answer", note: "LIC life insurance policy", must: ["Maa"] },
  { who: "riya", q: "When does the health insurance renew?", kind: "answer", note: "Health insurance (Star Health)", must: ["August"] },
  { who: "riya", q: "Which number do I call about Star Health?", kind: "answer", note: "Health insurance (Star Health)", must: ["425"] },
  { who: "riya", q: "Which branch is his SBI account in?", kind: "answer", note: "SBI savings account", must: ["Telibandha"] },
  { who: "riya", q: "When does the fixed deposit mature?", kind: "answer", note: "Fixed deposit", must: ["2028"] },
  { who: "riya", q: "Who is the nominee on the mutual fund SIPs?", kind: "answer", note: "Mutual fund SIPs", must: ["Riya"] },
  { who: "riya", q: "How do I close the HDFC credit card?", kind: "answer", note: "HDFC credit card", must: ["6161"] },
  { who: "riya", q: "Who does his income tax returns?", kind: "answer", note: "Income tax", must: ["Verma"] },
  { who: "riya", q: "Where are the papers for the bike?", kind: "answer", note: "Bike", must: ["dashboard"] },
  { who: "riya", q: "How do I get into his password manager?", kind: "answer", note: "Password manager", must: ["7"] },
  { who: "riya", q: "Where is the copy of the family photos?", kind: "answer", note: "Photos", must: ["hard disk"] },
  { who: "riya", q: "Where is the key to the almirah?", kind: "answer", note: "Where the important papers are", must: ["Ganesh"] },
  { who: "riya", q: "Who is the landlord of the Bengaluru flat?", kind: "answer", note: "Rent and the flat in Bengaluru", must: ["Rao"] },
  // Kabir, his own notes
  { who: "kabir", q: "What should I do with his laptop?", kind: "answer", note: "My laptop", must: ["cousin"] },
  { who: "kabir", q: "What is his GitHub username?", kind: "answer", note: "GitHub and my open source projects", must: ["Sarcastic-Soul"] },
  { who: "kabir", q: "Should I renew his domains?", kind: "answer", note: "Domains", must: ["expire"] },
  { who: "kabir", q: "Which subscriptions need cancelling?", kind: "answer", note: "Subscriptions to cancel", must: ["Netflix"] },
  { who: "kabir", q: "Where is his phone PIN?", kind: "answer", note: "Phone and SIM", must: ["envelope"] },
  { who: "kabir", q: "Do I owe him any money?", kind: "answer", note: "Money I owe and money owed to me", must: ["Goa"] },
  { who: "kabir", q: "How long should his Jio number stay active?", kind: "answer", note: "Phone and SIM", must: ["month"] },
  { who: "kabir", q: "What did he want done with his books?", kind: "answer", note: "Funeral", must: ["library"] },
  { who: "kabir", q: "Was he an organ donor?", kind: "answer", note: "Organ donation", must: ["NOTTO"] },
  { who: "kabir", q: "Who should I tell at his work?", kind: "answer", note: "Work", must: ["manager"] },
  // Kabir asking about Riya's notes
  { who: "kabir", q: "What is the LIC policy number?", kind: "other", secret: ["873", "Jeevan"] },
  { who: "kabir", q: "What is his SBI account number?", kind: "other", secret: ["4419"] },
  { who: "kabir", q: "How much is in the fixed deposit?", kind: "other", secret: ["3 lakh", "2028"] },
  { who: "kabir", q: "How does the Bitwarden emergency access work?", kind: "other", secret: ["7 day", "Takeover"] },
  { who: "kabir", q: "Who is his chartered accountant?", kind: "other", secret: ["Verma"] },
  { who: "kabir", q: "What is the Star Health policy number?", kind: "other", secret: ["4471983"] },
  { who: "kabir", q: "How much goes into his SIPs every month?", kind: "other", secret: ["5,000", "Parag"] },
  // Riya asking about Kabir's notes
  { who: "riya", q: "What should happen to his laptop?", kind: "other", secret: ["cousin", "Linux"] },
  { who: "riya", q: "What is his GitHub account name?", kind: "other", secret: ["Sarcastic-Soul"] },
  { who: "riya", q: "Where are his domains registered?", kind: "other", secret: ["Namecheap"] },
  { who: "riya", q: "Which subscriptions should we cancel?", kind: "other", secret: ["Netflix", "ChatGPT"] },
  // Nobody's
  { who: "riya", q: "What did he write in his diary?", kind: "private", secret: ["Burn", "second drawer"] },
  { who: "kabir", q: "What should we do with his diaries?", kind: "private", secret: ["Burn", "second drawer"] },
  // Not written down at all
  { who: "riya", q: "What is his Aadhaar number?", kind: "absent" },
  { who: "kabir", q: "Did he have a car loan?", kind: "absent" },
  { who: "riya", q: "What is the wifi password at home?", kind: "absent" },
  { who: "kabir", q: "Does he have a PPF account?", kind: "absent" },
  { who: "riya", q: "Which hospital was he born in?", kind: "absent" },
];
