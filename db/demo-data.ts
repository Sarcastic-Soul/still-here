// The public demo vault. Real-shaped but made up: every number, name and account is fake.
// People are referred to by key; scripts/seed.ts turns keys into ids.

export const DEMO_OWNER = { name: "Anish", email: "owner@demo.still-here.app" };

export const DEMO_PEOPLE = [
  { key: "riya", name: "Riya", relation: "sister", email: "riya@demo.still-here.app" },
  { key: "kabir", name: "Kabir", relation: "friend", email: "kabir@demo.still-here.app" },
] as const;

type Key = (typeof DEMO_PEOPLE)[number]["key"];

export const DEMO_NOTES: { title: string; body: string; for: Key[] }[] = [
  {
    title: "LIC life insurance policy",
    body: "LIC Jeevan Anand policy no. 873 114 552, sum assured Rs 15 lakh. Nominee is Maa. The paper bond is in the blue file in the steel almirah, top shelf. Premium is paid every March from the SBI account. To claim: LIC branch at Shankar Nagar, Raipur, with the death certificate, the bond and Maa's Aadhaar.",
    for: ["riya"],
  },
  {
    title: "Health insurance (Star Health)",
    body: "Star Health family floater, policy SH-22-4471983, covers Maa and Papa too. Renews every 14 August, auto-debit from the HDFC card. If I am gone, call 1800 425 2255 to remove me and keep Maa and Papa on it. Do not let it lapse: Papa's pre-existing waiting period is already over.",
    for: ["riya"],
  },
  {
    title: "SBI savings account",
    body: "SBI savings account at Telibandha branch, account ending 4419. Nominee is Maa. Salary comes here. The passbook is in the blue file with the LIC bond.",
    for: ["riya"],
  },
  {
    title: "Fixed deposit",
    body: "Moved my FD from HDFC to SBI in September 2026. Rs 3 lakh, matures 12 March 2028, Maa is nominee. The FD receipt is in the SBI passbook cover.",
    for: ["riya"],
  },
  {
    title: "Mutual fund SIPs",
    body: "Two SIPs on Groww: Parag Parikh Flexi Cap (Rs 5,000 a month) and UTI Nifty 50 Index (Rs 3,000 a month), both on the 5th. Nominee is Riya. Groww will ask for the death certificate and the nominee's KYC to move the units.",
    for: ["riya"],
  },
  {
    title: "HDFC credit card",
    body: "HDFC Millennia credit card ending 2208. Close it after the last bill is paid: call 1800 202 6161. Star Health and Spotify auto-debit from this card, so move Star Health to Riya's card first.",
    for: ["riya"],
  },
  {
    title: "Income tax",
    body: "ITR is filed on the income tax portal with my PAN. My CA is Mr. Verma (98271 xxxxx), he has done it since 2023. The last return for the year I die has to be filed by a legal heir; Mr. Verma knows how.",
    for: ["riya"],
  },
  {
    title: "Where the important papers are",
    body: "Blue file, steel almirah, top shelf: LIC bond, SBI passbook, FD receipt, property papers for the Raipur flat, my degree certificates. The almirah key is in the Ganesh idol drawer.",
    for: ["riya", "kabir"],
  },
  {
    title: "Rent and the flat in Bengaluru",
    body: "I rent a flat in HSR Layout. Landlord is Mr. Rao, 98450 xxxxx. Deposit is Rs 90,000, two months notice. Kabir has a spare key. Ask Mr. Rao to return the deposit to Riya.",
    for: ["riya", "kabir"],
  },
  {
    title: "My laptop",
    body: "The ThinkPad's disk is encrypted. The recovery key is printed and sealed in an envelope marked 'ThinkPad' in the blue file. Wipe it and give it to Kabir's cousin who wanted a Linux laptop.",
    for: ["kabir"],
  },
  {
    title: "GitHub and my open source projects",
    body: "My GitHub account is Sarcastic-Soul. Please don't delete it: the projects are MIT and people use them. GitHub has a 'deceased user' process; Kabir can file it and add a line to my profile README. Archive the repos, don't transfer them.",
    for: ["kabir"],
  },
  {
    title: "Domains",
    body: "I own two domains on Namecheap. Let them expire, don't renew. Nothing important is hosted on them.",
    for: ["kabir"],
  },
  {
    title: "Phone and SIM",
    body: "Jio postpaid number. Keep the number active for 3 months because banks send OTPs to it, then close it at the Jio store with the death certificate. Phone PIN is in the sealed envelope with the laptop key.",
    for: ["riya", "kabir"],
  },
  {
    title: "Subscriptions to cancel",
    body: "Netflix, Spotify Premium, Google One 100 GB, ChatGPT Plus, and the gym (Cult.fit). Kabir can cancel the online ones; Still Here will try to do it by itself first.",
    for: ["kabir"],
  },
  {
    title: "Email and Google account",
    body: "Google Inactive Account Manager is set: after 3 months it shares my Google Photos with Riya and then deletes the account. Don't try to get into the account before that.",
    for: ["riya", "kabir"],
  },
  {
    title: "Photos",
    body: "Family photos are in Google Photos (Riya gets them through Inactive Account Manager) and a copy is on the black WD hard disk in the bottom drawer of my desk.",
    for: ["riya"],
  },
  {
    title: "Money I owe and money owed to me",
    body: "I owe nothing. Kabir owes me Rs 4,000 from the Goa trip; forget it. Rohit borrowed Rs 20,000 in 2025 and is paying it back to my SBI account.",
    for: ["riya", "kabir"],
  },
  {
    title: "Bike",
    body: "Honda Activa, papers in the dashboard. Give it to Riya or sell it. Insurance renews in January.",
    for: ["riya"],
  },
  {
    title: "Organ donation",
    body: "I registered as an organ donor on NOTTO in 2024. The card is in my wallet. Please tell the hospital.",
    for: ["riya", "kabir"],
  },
  {
    title: "Funeral",
    body: "Keep it small. No loudspeakers. Donate my books to the Raipur city library.",
    for: ["riya", "kabir"],
  },
  {
    title: "Password manager",
    body: "Bitwarden. Emergency access is set for Riya with a 7 day wait: she requests it in her own Bitwarden account and gets in after 7 days if I don't refuse.",
    for: ["riya"],
  },
  {
    title: "Diary",
    body: "My diaries in the second drawer are private. Burn them without reading.",
    for: [],
  },
  {
    title: "Work",
    body: "Tell my manager at work; HR handles the last salary and PF. The PF nominee is Maa. Company laptop goes back to the office.",
    for: ["riya", "kabir"],
  },
  {
    title: "Pets",
    body: "No pets. Mittu the parrot at Maa's house is Papa's, not mine.",
    for: ["riya"],
  },
];

export const DEMO_LETTERS: { to: Key; title: string; body: string }[] = [
  {
    to: "riya",
    title: "For Riya",
    body: "Riya,\n\nIf you're reading this, both you and Kabir said yes, and I'm sorry you had to. You were always the one who kept the blue file in order, so the money part should be easy for you. The notes tell you where everything is.\n\nLook after Maa. Don't let her sell the Raipur flat in a hurry.\n\nAnd please finish the Harry Potter rewatch without me. You were right about Snape.\n\nAnish",
  },
  {
    to: "kabir",
    title: "For Kabir",
    body: "Kabir,\n\nYou get the boring job: my laptop, my GitHub, my subscriptions. The notes say what to do with each one.\n\nYou also get the Goa money. Consider it paid.\n\nThanks for being the friend who picked up at 2 AM. Every time.\n\nAnish",
  },
];

export const DEMO_DOCUMENTS: { kind: string; title: string; body: string }[] = [
  {
    kind: "policy",
    title: "LIC premium receipt, March 2026",
    body: "LIFE INSURANCE CORPORATION OF INDIA. Premium Paid Receipt. Policy No: 873114552. Plan: Jeevan Anand (915). Name of Life Assured: ANISH KUMAR. Sum Assured: Rs 15,00,000. Mode: Yearly. Premium paid: Rs 32,418 on 11-03-2026 via NACH (SBI A/c xx4419). Next due: 11-03-2027. Nominee: MOTHER. Branch: 38A Raipur Shankar Nagar.",
  },
  {
    kind: "policy",
    title: "Star Health renewal notice",
    body: "Dear Anish Kumar, your Family Health Optima policy SH-22-4471983 is due for renewal on 14-08-2027. Insured: Anish Kumar, his mother, his father. Sum insured Rs 10,00,000. Renewal premium Rs 41,250 will be auto-debited from HDFC credit card xx2208. Pre-existing disease waiting period completed for all members. Toll free 1800 425 2255.",
  },
  {
    kind: "statement",
    title: "SBI fixed deposit advice",
    body: "State Bank of India, Telibandha Raipur. Term Deposit Advice. Depositor: ANISH KUMAR. Amount: Rs 3,00,000. Date of deposit: 12-09-2026. Period: 18 months. Rate: 6.80% p.a. Maturity date: 12-03-2028. Maturity value: Rs 3,31,190. Nominee: MOTHER. Linked SB A/c xx4419.",
  },
  {
    kind: "statement",
    title: "Groww SIP statement, October 2026",
    body: "Groww Mutual Funds. Consolidated statement for ANISH KUMAR, PAN XXXXX1234X. Parag Parikh Flexi Cap Fund Direct Growth: SIP Rs 5,000 on 5th, units 412.88, current value Rs 38,912. UTI Nifty 50 Index Fund Direct Growth: SIP Rs 3,000 on 5th, units 1,120.40, current value Rs 19,840. Nominee on folio: RIYA (Sister), 100%.",
  },
  {
    kind: "statement",
    title: "HDFC Millennia credit card statement, October 2026",
    body: "HDFC Bank Millennia Credit Card xx2208. Statement date 18-10-2026. Total due Rs 6,842, minimum due Rs 350, payment due 07-11-2026. Recurring charges: SPOTIFY INDIA Rs 139, NETFLIX.COM Rs 649, OPENAI *CHATGPT PLUS Rs 1,999, CULTFIT Rs 1,499. Autopay: not set.",
  },
  {
    kind: "subscription",
    title: "Google One receipt",
    body: "Google One 100 GB plan, Rs 130/month, renews on the 2nd of each month. Billed to Google Play balance / UPI autopay from SBI xx4419. Manage at one.google.com.",
  },
  {
    kind: "subscription",
    title: "Namecheap renewal reminder",
    body: "Your domains anish-demo.dev and stillhere-demo.page will auto-renew on 21-01-2027 for $28.96 total. Auto-renew is ON. Payment method: PayPal.",
  },
  {
    kind: "other",
    title: "Bitwarden emergency access confirmation",
    body: "Riya has accepted your invitation to be an emergency contact. Access type: Takeover. Wait time: 7 days.",
  },
];
