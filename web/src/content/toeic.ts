/**
 * Original TOEIC-style practice content written for Jadou Planner (not taken from ETS material).
 * Listening parts are read aloud with the browser's speech synthesis (en-US / en-GB voices).
 */
export interface ToeicQ {
  id: string;
  prompt?: string;
  options: string[];
  answer: number;
  explanation: string;
  notion: string;
}
export interface ToeicSet {
  id: string;
  part: number;
  /** text spoken for listening parts (lines starting with "W:" / "M:" switch voices) */
  audio?: string;
  /** Part 1 illustrated scene */
  scene?: { emoji: string; caption: string };
  passage?: string;
  questions: ToeicQ[];
}

export const PARTS = [
  { part: 1, name: 'Photographs', skill: 'Listening', desc: 'Choisir la phrase qui décrit le mieux la scène.' },
  { part: 2, name: 'Question-Response', skill: 'Listening', desc: 'Choisir la meilleure réponse à une question entendue.' },
  { part: 3, name: 'Conversations', skill: 'Listening', desc: 'Comprendre une conversation et répondre à 3 questions.' },
  { part: 4, name: 'Talks', skill: 'Listening', desc: 'Comprendre un monologue (annonce, message…).' },
  { part: 5, name: 'Incomplete Sentences', skill: 'Reading', desc: 'Grammaire et vocabulaire : compléter la phrase.' },
  { part: 6, name: 'Text Completion', skill: 'Reading', desc: 'Compléter un texte court.' },
  { part: 7, name: 'Reading Comprehension', skill: 'Reading', desc: 'Lire un document et répondre aux questions.' },
];

const P1 = (id: string, emoji: string, caption: string, options: string[], answer: number, explanation: string, notion = 'Description de scène'): ToeicSet => ({
  id,
  part: 1,
  scene: { emoji, caption },
  audio: options.map((o, i) => `${'ABCD'[i]}. ${o}`).join(' ... '),
  questions: [{ id: `${id}q`, options, answer, explanation, notion }],
});

const P2 = (id: string, question: string, options: string[], answer: number, explanation: string, notion: string): ToeicSet => ({
  id,
  part: 2,
  audio: `${question} ... ${options.map((o, i) => `${'ABC'[i]}. ${o}`).join(' ... ')}`,
  questions: [{ id: `${id}q`, options, answer, explanation, notion }],
});

const P5 = (id: string, prompt: string, options: string[], answer: number, explanation: string, notion: string): ToeicSet => ({ id, part: 5, questions: [{ id: `${id}q`, prompt, options, answer, explanation, notion }] });

export const TOEIC_SETS: ToeicSet[] = [
  // ---------------------------------------------------------------- Part 1
  P1('p1-1', '👩‍💼 💻 ☕', 'Une femme travaille sur un ordinateur portable, une tasse à côté.', ['She is drinking from a bottle.', 'She is typing on a laptop.', 'She is closing a window.', 'She is printing a document.'], 1, '« typing on a laptop » = tape sur un ordinateur portable. Les autres actions ne sont pas visibles.'),
  P1('p1-2', '🧑‍🍳 🍳 🔥', 'Un cuisinier fait cuire quelque chose dans une poêle.', ['A chef is cooking in a pan.', 'A chef is washing dishes.', 'A waiter is serving customers.', 'A man is setting the table.'], 0, 'On voit un cuisinier (chef) et une poêle (pan) sur le feu.'),
  P1('p1-3', '📦 📦 📦 🚚', 'Des cartons empilés à côté d’un camion.', ['Some boxes are being opened.', 'A truck is parked in a garage.', 'Boxes have been stacked near a truck.', 'A man is driving a truck.'], 2, '« have been stacked » (passif parfait) décrit un état : les cartons ont été empilés. Piège fréquent : « are being opened » décrit une action en cours non visible.', 'Passif (état vs action)'),
  P1('p1-4', '👥 🪑 🗂️', 'Des personnes assises autour d’une table de réunion avec des dossiers.', ['People are standing in a line.', 'Some people are seated at a table.', 'A woman is filing papers in a cabinet.', 'The chairs are stacked in a corner.'], 1, '« seated at a table » = assis à une table.'),
  P1('p1-5', '🚲 🌳 🛣️', 'Un vélo appuyé contre un arbre au bord d’un chemin.', ['A bicycle is leaning against a tree.', 'A cyclist is riding on the road.', 'Trees are being planted.', 'A bicycle is being repaired.'], 0, '« leaning against » = appuyé contre. Aucune personne n’est visible.'),
  P1('p1-6', '🛍️ 👩 🧾', 'Une cliente reçoit un ticket de caisse dans un magasin.', ['A woman is trying on a dress.', 'A customer is receiving a receipt.', 'A cashier is counting coins.', 'Shelves are being restocked.'], 1, '« receipt » = ticket de caisse.', 'Vocabulaire commerce'),

  // ---------------------------------------------------------------- Part 2
  P2('p2-1', 'When does the marketing meeting start?', ['In conference room B.', 'At ten thirty.', 'Yes, I started it.'], 1, '« When » appelle un moment : « At ten thirty ». A répond à « Where », C est un piège sonore (start/started).', 'Questions en WH- (when)'),
  P2('p2-2', 'Where should I leave these brochures?', ['On the front desk, please.', 'They were printed yesterday.', 'I’m leaving at five.'], 0, '« Where » = lieu. C reprend « leave » avec un autre sens : piège.', 'Questions en WH- (where)'),
  P2('p2-3', 'Who is in charge of the event budget?', ['About two thousand euros.', 'Ms. Laurent, from finance.', 'Yes, it’s in charge.'], 1, '« Who » = une personne. A donne un montant (How much).', 'Questions en WH- (who)'),
  P2('p2-4', 'Would you like me to call the supplier?', ['That would be great, thanks.', 'The supply room is upstairs.', 'He called me last week.'], 0, 'Proposition (Would you like me to…) → acceptation polie.', 'Offres & suggestions'),
  P2('p2-5', 'Didn’t you send the invoice yesterday?', ['No, I’ll do it this afternoon.', 'An invoice for the office.', 'Yes, they sent a voice message.'], 0, 'Question négative : on répond sur le fond (No, pas encore envoyé). C est un piège sonore (invoice / voice).', 'Questions négatives'),
  P2('p2-6', 'Why was the flight delayed?', ['Because of the bad weather.', 'At gate twelve.', 'It’s a direct flight.'], 0, '« Why » appelle une cause : « Because of… ».', 'Questions en WH- (why)'),
  P2('p2-7', 'How often do you update the website?', ['Every Monday morning.', 'It’s very user-friendly.', 'About ten minutes.'], 0, '« How often » = fréquence. C répond à « How long ».', 'How often / How long'),
  P2('p2-8', 'The new pharmacy opens next week, doesn’t it?', ['Yes, on Tuesday.', 'It opens the door.', 'I prefer the old one closed.'], 0, 'Question tag : confirmation simple « Yes, on Tuesday ».', 'Question tags'),

  // ---------------------------------------------------------------- Part 3
  {
    id: 'p3-1',
    part: 3,
    audio: `W: Hi Daniel, have you finished the poster for the skincare event on Saturday?
M: Almost. I still need the final price for the gift sets. Do you know if the manager approved the discount?
W: She did — twenty percent on all gift sets. But she wants the posters in the windows by Thursday.
M: OK, I'll update the design this afternoon and send it to the printer tomorrow morning.`,
    questions: [
      { id: 'p3-1a', prompt: 'What are the speakers mainly discussing?', options: ['A job interview', 'A promotional poster', 'A delivery problem', 'A new employee'], answer: 1, explanation: 'Ils parlent du « poster for the skincare event ».', notion: 'Idée principale' },
      { id: 'p3-1b', prompt: 'What did the manager approve?', options: ['A new printer', 'A longer event', 'A discount', 'A larger budget'], answer: 2, explanation: '« She did — twenty percent on all gift sets » : elle a approuvé la remise.', notion: 'Détail' },
      { id: 'p3-1c', prompt: 'What will the man do this afternoon?', options: ['Update the design', 'Call the manager', 'Visit the printer', 'Decorate the windows'], answer: 0, explanation: '« I’ll update the design this afternoon ».', notion: 'Action future' },
    ],
  },
  {
    id: 'p3-2',
    part: 3,
    audio: `M: Good morning, I'm calling about the apartment listed for next weekend. Is it still available?
W: Yes, it is. It's available from Friday to Sunday. How many guests will there be?
M: Just two of us. Is it close to the train station?
W: It's a ten-minute walk. I'll send you the check-in instructions by e-mail once you confirm the booking online.`,
    questions: [
      { id: 'p3-2a', prompt: 'Why is the man calling?', options: ['To cancel a reservation', 'To ask about availability', 'To complain about noise', 'To buy a train ticket'], answer: 1, explanation: '« Is it still available? »', notion: 'But de l’appel' },
      { id: 'p3-2b', prompt: 'How far is the apartment from the station?', options: ['Two minutes by car', 'A ten-minute walk', 'Next to the station', 'Twenty minutes by bus'], answer: 1, explanation: '« It’s a ten-minute walk ».', notion: 'Détail' },
      { id: 'p3-2c', prompt: 'What will the woman send?', options: ['A receipt', 'A map', 'Check-in instructions', 'A train schedule'], answer: 2, explanation: '« I’ll send you the check-in instructions by e-mail ».', notion: 'Action future' },
    ],
  },

  // ---------------------------------------------------------------- Part 4
  {
    id: 'p4-1',
    part: 4,
    audio: `Attention, shoppers. This week only, La Belle Pharmacie is offering free skin consultations with our beauty advisors. Consultations last fifteen minutes and are available every afternoon from two to six. To reserve a time slot, please speak to any member of our staff at the main counter. And don't forget: members of our loyalty program receive a free sample with every purchase over thirty euros.`,
    questions: [
      { id: 'p4-1a', prompt: 'What is being offered this week?', options: ['Free delivery', 'Free skin consultations', 'Half-price perfume', 'A cooking class'], answer: 1, explanation: '« free skin consultations ».', notion: 'Idée principale' },
      { id: 'p4-1b', prompt: 'How long does a consultation last?', options: ['Five minutes', 'Fifteen minutes', 'Thirty minutes', 'One hour'], answer: 1, explanation: '« Consultations last fifteen minutes ».', notion: 'Chiffres & durées' },
      { id: 'p4-1c', prompt: 'Who can receive a free sample?', options: ['All customers', 'New employees', 'Loyalty program members', 'Customers who arrive before two'], answer: 2, explanation: '« members of our loyalty program receive a free sample ».', notion: 'Détail' },
    ],
  },
  {
    id: 'p4-2',
    part: 4,
    audio: `Hello, this is Sophie from Lumière Events. I'm calling to confirm your booking for the product launch on March twelfth. The room will be ready at eight a.m., and the catering team will arrive at nine. However, the projector you requested is not available, so we'll provide a large screen instead. Please call me back before Friday if this change is a problem.`,
    questions: [
      { id: 'p4-2a', prompt: 'What is the purpose of the message?', options: ['To confirm a booking', 'To request a payment', 'To cancel an event', 'To offer a job'], answer: 0, explanation: '« I’m calling to confirm your booking ».', notion: 'But du message' },
      { id: 'p4-2b', prompt: 'What time will the caterers arrive?', options: ['At 8 a.m.', 'At 9 a.m.', 'At noon', 'On Friday'], answer: 1, explanation: '« the catering team will arrive at nine ».', notion: 'Chiffres & horaires' },
      { id: 'p4-2c', prompt: 'What problem does the speaker mention?', options: ['The room is too small', 'A projector is unavailable', 'The date has changed', 'The caterer is late'], answer: 1, explanation: '« the projector you requested is not available ».', notion: 'Problème / solution' },
    ],
  },

  // ---------------------------------------------------------------- Part 5
  P5('p5-1', 'The sales report must be submitted ______ Friday at noon.', ['until', 'by', 'since', 'during'], 1, '« by » = au plus tard (deadline). « until » = jusqu’à (durée continue).', 'Prépositions de temps'),
  P5('p5-2', 'Ms. Moreau has worked for the company ______ 2019.', ['for', 'since', 'from', 'ago'], 1, '« since » + point de départ avec le present perfect. « for » + durée.', 'Since / for'),
  P5('p5-3', 'All employees are required to wear ______ badges in the building.', ['they', 'them', 'their', 'theirs'], 2, 'Adjectif possessif devant un nom : « their badges ».', 'Pronoms & possessifs'),
  P5('p5-4', 'The new campaign was ______ successful than we expected.', ['more', 'most', 'much', 'very'], 0, 'Comparatif de supériorité avec « than » : more successful than.', 'Comparatifs'),
  P5('p5-5', 'If the delivery ______ late, we will contact the supplier.', ['will arrive', 'arrives', 'arrived', 'arriving'], 1, 'Conditionnel de type 1 : If + présent, will + base verbale.', 'Conditionnels'),
  P5('p5-6', 'The manager asked the team to ______ the proposal before the meeting.', ['review', 'reviewing', 'reviewed', 'reviews'], 0, '« ask someone to + base verbale ».', 'Infinitif / gérondif'),
  P5('p5-7', 'The conference room has been ______ for the training session.', ['reserve', 'reserving', 'reserved', 'reservation'], 2, 'Passif au present perfect : has been + participe passé.', 'Voix passive'),
  P5('p5-8', 'Customers can return products ______ they keep the receipt.', ['as long as', 'despite', 'because of', 'unless'], 0, '« as long as » = à condition que.', 'Connecteurs logiques'),
  P5('p5-9', 'The price increase was announced ______ in the newsletter.', ['official', 'officially', 'office', 'officer'], 1, 'Un adverbe modifie le verbe « was announced » : officially.', 'Nature des mots (adverbe)'),
  P5('p5-10', 'Ms. Dupont is looking forward to ______ the new branch manager.', ['meet', 'meets', 'meeting', 'met'], 2, '« look forward to » + V-ing (to est ici une préposition).', 'Infinitif / gérondif'),
  P5('p5-11', 'The pharmacy will remain open ______ the renovation work.', ['while', 'during', 'although', 'when'], 1, '« during » + nom. « while » + proposition (sujet + verbe).', 'During / while'),
  P5('p5-12', 'Please let us know ______ you need any further information.', ['if', 'unless', 'whether or', 'so'], 0, '« if you need… » = si vous avez besoin.', 'Connecteurs logiques'),
  P5('p5-13', 'Our team ______ the final figures by the time the director arrives.', ['will have prepared', 'prepares', 'has prepared', 'prepare'], 0, '« by the time » + futur antérieur : will have prepared.', 'Temps (futur antérieur)'),
  P5('p5-14', 'The marketing assistant handled the client’s complaint very ______.', ['profession', 'professional', 'professionally', 'professionalism'], 2, 'Adverbe après le verbe et « very » : professionally.', 'Nature des mots (adverbe)'),
  P5('p5-15', 'Neither the manager ______ her assistant attended the seminar.', ['or', 'nor', 'and', 'but'], 1, 'Neither … nor = ni … ni.', 'Corrélations'),
  P5('p5-16', 'The ______ of the new store is scheduled for next month.', ['open', 'opened', 'opening', 'opens'], 2, 'Après « The » il faut un nom : the opening (l’ouverture).', 'Nature des mots (nom)'),
  P5('p5-17', 'Applicants ______ résumés are incomplete will not be considered.', ['who', 'whose', 'which', 'whom'], 1, '« whose » = dont (possession) : les candidats dont les CV sont incomplets.', 'Pronoms relatifs'),
  P5('p5-18', 'The supplier offered us a significant ______ on bulk orders.', ['discount', 'discounted', 'discounting', 'discounts it'], 0, '« a significant discount » : nom singulier après l’article a.', 'Vocabulaire commerce'),
  P5('p5-19', 'Ms. Chen was promoted ______ her outstanding results.', ['because', 'due to', 'so that', 'even though'], 1, '« due to » + nom ; « because » + proposition.', 'Connecteurs logiques'),
  P5('p5-20', 'The survey results were ______ positive, so the product launch will go ahead.', ['overwhelm', 'overwhelming', 'overwhelmingly', 'overwhelmed'], 2, 'Adverbe devant un adjectif : overwhelmingly positive.', 'Nature des mots (adverbe)'),

  // ---------------------------------------------------------------- Part 6
  {
    id: 'p6-1',
    part: 6,
    passage: `To: All staff
Subject: New opening hours

Dear team,
Starting next Monday, the pharmacy will open at 8:00 a.m. instead of 8:30 a.m. This change is ___(1)___ to better serve customers who come in before work. Morning shifts will therefore begin fifteen minutes ___(2)___. Please check the updated schedule, ___(3)___ is posted in the staff room. ___(4)___
Thank you for your cooperation.
Claire Martin, Store Manager`,
    questions: [
      { id: 'p6-1a', prompt: '(1)', options: ['intend', 'intended', 'intending', 'intention'], answer: 1, explanation: 'Passif : is intended to = est destiné à.', notion: 'Voix passive' },
      { id: 'p6-1b', prompt: '(2)', options: ['earlier', 'early', 'earliest', 'earliness'], answer: 0, explanation: 'Comparaison implicite (plus tôt qu’avant) : earlier.', notion: 'Comparatifs' },
      { id: 'p6-1c', prompt: '(3)', options: ['who', 'what', 'which', 'where'], answer: 2, explanation: 'Relative non déterminative (après une virgule) pour une chose : which.', notion: 'Pronoms relatifs' },
      { id: 'p6-1d', prompt: '(4)', options: ['The pharmacy sells skincare products.', 'If you have any questions, please contact me directly.', 'Our customers loved the new perfume.', 'The parking lot is closed on Sundays.'], answer: 1, explanation: 'Phrase de conclusion cohérente avec un mémo interne.', notion: 'Cohérence du texte' },
    ],
  },
  {
    id: 'p6-2',
    part: 6,
    passage: `Thank you for booking your appointment with Lash & Glow Studio!
Your appointment is confirmed for Friday, May 9, at 2:00 p.m. ___(1)___ you need to reschedule, please let us know at least 24 hours in advance. Late cancellations may result in the ___(2)___ of your deposit. To prepare for your appointment, please arrive ___(3)___ makeup on your eyes. ___(4)___
We look forward to seeing you!`,
    questions: [
      { id: 'p6-2a', prompt: '(1)', options: ['Should', 'Unless', 'Despite', 'Whereas'], answer: 0, explanation: '« Should you need… » = si jamais vous deviez (inversion formelle de if).', notion: 'Conditionnels' },
      { id: 'p6-2b', prompt: '(2)', options: ['lose', 'lost', 'loss', 'losing'], answer: 2, explanation: 'Après « the » → nom : the loss of your deposit.', notion: 'Nature des mots (nom)' },
      { id: 'p6-2c', prompt: '(3)', options: ['with', 'without', 'within', 'among'], answer: 1, explanation: 'Venir sans maquillage : without makeup.', notion: 'Prépositions' },
      { id: 'p6-2d', prompt: '(4)', options: ['The session usually lasts about two hours.', 'Our studio was painted last year.', 'Many birds live near the studio.', 'Please bring your passport.'], answer: 0, explanation: 'Information pratique cohérente avec la préparation du rendez-vous.', notion: 'Cohérence du texte' },
    ],
  },

  // ---------------------------------------------------------------- Part 7
  {
    id: 'p7-1',
    part: 7,
    passage: `JOB OPENING — Digital Marketing Assistant (Part-time)
Green Leaf Pharmacy is looking for a creative assistant to support our marketing team. Responsibilities include creating content for Instagram and TikTok, organizing in-store events, and analyzing campaign results.
Requirements: currently enrolled in a business or marketing program; excellent communication skills; basic knowledge of design tools. Experience in the health or beauty sector is a plus.
To apply, send your résumé and a short cover letter to careers@greenleaf.example by April 30. Interviews will take place the first week of May.`,
    questions: [
      { id: 'p7-1a', prompt: 'What is the main purpose of the notice?', options: ['To announce a sale', 'To advertise a job', 'To introduce a new product', 'To describe a training course'], answer: 1, explanation: '« JOB OPENING » : annonce d’emploi.', notion: 'Idée principale' },
      { id: 'p7-1b', prompt: 'What is NOT mentioned as a responsibility?', options: ['Creating social media content', 'Organizing events', 'Managing the store’s accounts', 'Analyzing campaign results'], answer: 2, explanation: 'La comptabilité n’est pas citée. Les questions NOT demandent l’élément absent.', notion: 'Questions NOT' },
      { id: 'p7-1c', prompt: 'What is suggested about candidates with beauty-sector experience?', options: ['They will be paid more', 'They are preferred', 'They must work full-time', 'They do not need a cover letter'], answer: 1, explanation: '« is a plus » = un atout → ils sont privilégiés.', notion: 'Inférence' },
    ],
  },
  {
    id: 'p7-2',
    part: 7,
    passage: `From: Julia Rossi <j.rossi@example.com>
To: Bookings — Seine View Apartments
Subject: Reservation #4821

Hello,
I booked your studio from June 14 to June 17 for two people. Unfortunately, my flight has been moved, and I will only arrive on June 15 in the evening. Would it be possible to change my reservation to June 15–18 instead? I am happy to pay any difference in price.
Also, could you tell me whether there is a hairdryer in the apartment?
Best regards,
Julia Rossi`,
    questions: [
      { id: 'p7-2a', prompt: 'Why is Ms. Rossi writing?', options: ['To cancel her stay', 'To change her dates', 'To complain about the price', 'To book a flight'], answer: 1, explanation: 'Elle demande de décaler sa réservation au 15–18 juin.', notion: 'But du document' },
      { id: 'p7-2b', prompt: 'How many nights would the new booking include?', options: ['Two', 'Three', 'Four', 'Five'], answer: 1, explanation: 'Du 15 au 18 juin = 3 nuits.', notion: 'Calcul / déduction' },
      { id: 'p7-2c', prompt: 'What does she ask about the apartment?', options: ['If pets are allowed', 'If there is parking', 'If a hairdryer is provided', 'If breakfast is included'], answer: 2, explanation: '« whether there is a hairdryer ».', notion: 'Détail' },
    ],
  },
  {
    id: 'p7-3',
    part: 7,
    passage: `Monthly Sales Summary — Store Marketing
• Online orders rose by 18% compared with last month, mainly thanks to the Instagram campaign launched on the 5th.
• In-store sales remained stable.
• The skincare event attracted 140 visitors; 35% of them joined the loyalty program.
• Next month's priority: increase TikTok engagement and prepare the summer sun-care display.`,
    questions: [
      { id: 'p7-3a', prompt: 'What contributed most to the rise in online orders?', options: ['A TikTok video', 'An Instagram campaign', 'A newspaper ad', 'Lower prices'], answer: 1, explanation: '« mainly thanks to the Instagram campaign ».', notion: 'Cause / conséquence' },
      { id: 'p7-3b', prompt: 'Approximately how many visitors joined the loyalty program?', options: ['35', 'About 49', '140', 'About 18'], answer: 1, explanation: '35 % de 140 = 49.', notion: 'Calcul / déduction' },
      { id: 'p7-3c', prompt: 'What is planned for next month?', options: ['Closing the store', 'Hiring staff', 'A sun-care display', 'A price increase'], answer: 2, explanation: '« prepare the summer sun-care display ».', notion: 'Détail' },
    ],
  },
];

export function questionById(id: string) {
  for (const s of TOEIC_SETS) for (const q of s.questions) if (q.id === id) return { set: s, q };
  return null;
}

/** Speak a listening script with alternating voices (W:/M:) using the Web Speech API. */
export function speak(text: string, rate = 0.95): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith('en'));
    const female = voices.find((v) => /female|samantha|victoria|karen|serena|zira|susan|kate/i.test(v.name)) ?? voices[0];
    const male = voices.find((v) => /male|daniel|alex|fred|david|george|arthur|tom/i.test(v.name) && v !== female) ?? voices[1] ?? voices[0];
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    lines.forEach((line, i) => {
      const m = line.match(/^(W|M):\s*(.*)$/);
      const u = new SpeechSynthesisUtterance(m ? m[2] : line);
      u.lang = 'en-US';
      u.rate = rate;
      const v = m?.[1] === 'M' ? male : female;
      if (v) u.voice = v;
      if (i === lines.length - 1) u.onend = () => resolve();
      window.speechSynthesis.speak(u);
    });
  });
}
