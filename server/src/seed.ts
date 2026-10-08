/**
 * First-launch configuration. Only *structure* is created (program, service list, templates,
 * vocabulary, habits examples from the brief) — never fake figures or fake history.
 */
import { prisma } from './db';
import { getSetting, setSetting } from './settings';
import { createRecord } from './records';

const EXERCISES = [
  { name: 'Hip thrust', category: 'glutes', muscles: 'Grand fessier, moyen fessier, ischio-jambiers', equipment: 'Barre, banc, coussin de barre', instructions: 'Haut du dos appuyé sur le banc (bas des omoplates), barre au pli de la hanche, pieds à largeur de hanches. Pousse dans les talons pour monter le bassin jusqu’à l’alignement épaules-hanches-genoux, marque 1 s en contraction, redescends contrôlé.', tips: 'Menton rentré, regard vers l’avant. Rétroversion du bassin en haut (côtes basses) pour éviter de cambrer. Tibias verticaux en haut du mouvement.', variants: 'Hip thrust machine, unilatéral, avec élastique aux genoux, pause 3 s en haut' },
  { name: 'Squat', category: 'quads', muscles: 'Quadriceps, grand fessier, adducteurs', equipment: 'Barre, rack', instructions: 'Barre sur les trapèzes, pieds largeur d’épaules légèrement ouverts. Inspire, gaine, descends en poussant les hanches en arrière et les genoux dans l’axe des pieds jusqu’à la parallèle ou plus bas, puis remonte en poussant le sol.', tips: 'Pieds stables (talon, base du gros orteil, petit orteil). Dos neutre. Pour cibler les fessiers : écartement un peu plus large et descente profonde.', variants: 'Goblet squat, squat sumo, squat à la Smith machine, box squat' },
  { name: 'Presse à cuisses', category: 'quads', muscles: 'Quadriceps, fessiers, adducteurs', equipment: 'Machine presse', instructions: 'Dos et bassin plaqués, pieds sur la plateforme. Déverrouille, descends en contrôle jusqu’à un angle de genou ~90° sans que le bassin décolle, puis pousse.', tips: 'Pieds hauts et écartés = plus de fessiers/ischios. Ne verrouille pas les genoux en haut.', variants: 'Presse unilatérale, pieds hauts, pieds serrés' },
  { name: 'Abductions machine', category: 'glutes', muscles: 'Moyen et petit fessier', equipment: 'Machine à abducteurs', instructions: 'Assise, dos calé, écarte les genoux contre la résistance, marque une pause, reviens lentement.', tips: 'Penche le buste légèrement vers l’avant pour mieux recruter le haut des fessiers. Mouvement contrôlé, sans élan.', variants: 'Abductions élastique debout, abductions allongée sur le côté, abductions à la poulie' },
  { name: 'Leg curl allongé', category: 'hamstrings', muscles: 'Ischio-jambiers', equipment: 'Machine leg curl', instructions: 'Allongée face au banc, rouleau au-dessus des talons. Fléchis les genoux pour amener les talons vers les fessiers, puis redescends lentement.', tips: 'Hanches plaquées sur le banc. Phase négative en 2–3 s.', variants: 'Leg curl assis, leg curl unilatéral, nordic curl assisté' },
  { name: 'Soulevé de terre roumain', category: 'hamstrings', muscles: 'Ischio-jambiers, grand fessier, érecteurs du rachis', equipment: 'Barre ou haltères', instructions: 'Debout, genoux légèrement fléchis, charge contre les cuisses. Pousse les hanches vers l’arrière en gardant le dos neutre jusqu’à sentir l’étirement des ischios, puis reviens en contractant les fessiers.', tips: 'La barre frôle les jambes. On ne cherche pas à toucher le sol : l’amplitude s’arrête quand le dos ne peut plus rester neutre.', variants: 'RDL haltères, RDL unilatéral, good morning' },
  { name: 'Fentes bulgares', category: 'glutes', muscles: 'Grand fessier, quadriceps', equipment: 'Banc, haltères', instructions: 'Pied arrière posé sur un banc, pied avant assez loin. Descends à la verticale jusqu’à ce que la cuisse avant soit parallèle au sol, puis remonte en poussant dans le talon avant.', tips: 'Buste légèrement penché vers l’avant et pas plus long = plus de fessiers.', variants: 'Fentes arrière, fentes marchées, step-up' },
  { name: 'Kickback à la poulie', category: 'glutes', muscles: 'Grand fessier', equipment: 'Poulie basse, sangle de cheville', instructions: 'Face à la poulie, buste légèrement penché, pousse la jambe vers l’arrière en extension de hanche, contracte, reviens sans relâcher la tension.', tips: 'Ne cambre pas : le mouvement vient de la hanche, pas du bas du dos.', variants: 'Kickback machine, donkey kick au sol' },
  { name: 'Hyperextension orientée fessiers', category: 'glutes', muscles: 'Grand fessier, ischio-jambiers', equipment: 'Banc à lombaires (45°)', instructions: 'Pieds ouverts, haut du banc sous les hanches, dos légèrement arrondi. Descends puis remonte en contractant les fessiers jusqu’à l’alignement.', tips: 'Pense « pousser les hanches dans le banc ». Ne monte pas au-delà de l’alignement.', variants: 'Avec disque, unilatéral' },
  { name: 'Glute bridge', category: 'glutes', muscles: 'Grand fessier, ischio-jambiers', equipment: 'Tapis (option : haltère, élastique)', instructions: 'Allongée sur le dos, pieds au sol près des fessiers. Monte le bassin en contractant les fessiers, pause 1–2 s, redescends.', tips: 'Idéal à la maison ; ajoute un élastique aux genoux ou un poids sur les hanches pour progresser.', variants: 'Unilatéral, pieds surélevés, frog pumps' },
  { name: 'Frog pumps', category: 'glutes', muscles: 'Grand fessier', equipment: 'Tapis', instructions: 'Allongée, plantes de pieds collées, genoux ouverts. Monte et descends le bassin en séries longues et rythmées.', tips: 'Parfait en finisher (20–30 répétitions).', variants: 'Lesté avec un haltère' },
  { name: 'Abductions élastique', category: 'glutes', muscles: 'Moyen fessier', equipment: 'Mini-band', instructions: 'Élastique au-dessus des genoux, en position assise, debout ou en demi-squat : écarte les genoux contre la résistance.', tips: 'Garde la tension en continu. Excellent pour l’activation avant la séance.', variants: 'Monster walk, clamshell, abductions allongée' },
  { name: 'Donkey kick', category: 'glutes', muscles: 'Grand fessier', equipment: 'Tapis (option : élastique, chevillère)', instructions: 'À quatre pattes, genou fléchi à 90°, monte le talon vers le plafond en contractant le fessier, redescends sans poser.', tips: 'Bassin stable et dos neutre : ne tourne pas le bassin pour monter plus haut.', variants: 'Avec élastique, à la machine, à la poulie' },
  { name: 'Good morning élastique', category: 'hamstrings', muscles: 'Ischio-jambiers, fessiers, lombaires', equipment: 'Grand élastique', instructions: 'Élastique sous les pieds et derrière la nuque/épaules. Charnière de hanche comme un RDL, puis reviens en contractant les fessiers.', tips: 'Dos neutre, genoux souples.', variants: 'Barre légère, unilatéral' },
  { name: 'Fentes arrière', category: 'glutes', muscles: 'Fessiers, quadriceps', equipment: 'Poids du corps ou haltères', instructions: 'Recule une jambe et descends jusqu’à ce que le genou arrière frôle le sol, puis reviens en poussant dans le talon avant.', tips: 'Plus stable que les fentes avant pour les genoux.', variants: 'Fentes déficit, fentes croisées (curtsy lunge)' },
  { name: 'Gainage planche', category: 'core', muscles: 'Transverse, grands droits, obliques', equipment: 'Tapis', instructions: 'En appui sur les avant-bras et les pointes de pieds, corps aligné, nombril rentré. Tiens la position.', tips: 'Serre les fessiers et pousse le sol avec les avant-bras.', variants: 'Planche latérale, planche avec touches d’épaules' },
  { name: 'Tirage vertical', category: 'back', muscles: 'Grand dorsal, biceps', equipment: 'Poulie haute', instructions: 'Assise, cuisses calées, tire la barre vers le haut de la poitrine en abaissant les épaules, puis reviens lentement.', tips: 'Pense « coudes vers les poches ». Pas d’élan.', variants: 'Prise neutre, prise serrée, tractions assistées' },
  { name: 'Marche inclinée', category: 'cardio', muscles: 'Fessiers, mollets, cardio', equipment: 'Tapis de course', instructions: '20–30 min de marche rapide avec une inclinaison de 8 à 12 %.', tips: 'Ne te tiens pas aux barres. Idéal en fin de séance.', variants: 'Stairmaster, vélo' },
];

const sets = (exs: [string, number, string][]) => exs;

export async function seedIfNeeded() {
  if (await getSetting<boolean | undefined>('seeded')) return;
  console.log('  ♡ première configuration de Jadou Planner…');

  const ids: Record<string, number> = {};
  for (const e of EXERCISES) ids[e.name] = (await createRecord('exercise', e)).id;

  const program = [
    { name: 'Lower Body A', weekday: '0', location: 'gym', notes: 'Séance principale fessiers — charges lourdes.', exercises: sets([['Hip thrust', 4, '8-10'], ['Squat', 4, '8-10'], ['Presse à cuisses', 3, '10-12'], ['Abductions machine', 3, '15-20'], ['Leg curl allongé', 3, '10-12']]) },
    { name: 'Lower Body B', weekday: '3', location: 'gym', notes: 'Séance complémentaire fessiers & ischio-jambiers.', exercises: sets([['Soulevé de terre roumain', 4, '8-10'], ['Fentes bulgares', 3, '10/jambe'], ['Kickback à la poulie', 3, '12-15'], ['Hyperextension orientée fessiers', 3, '12-15'], ['Leg curl allongé', 3, '12']]) },
    { name: 'Home Workout', weekday: '5', location: 'home', notes: 'Séance à domicile — tapis + élastiques.', exercises: sets([['Glute bridge', 4, '15'], ['Fentes arrière', 3, '12/jambe'], ['Abductions élastique', 3, '20'], ['Donkey kick', 3, '15/jambe'], ['Good morning élastique', 3, '15'], ['Frog pumps', 2, '30']]) },
  ];
  for (const p of program) {
    await createRecord('workoutTemplate', {
      name: p.name,
      weekday: p.weekday,
      location: p.location,
      notes: p.notes,
      active: true,
      exercises: p.exercises.map(([n, s, r]) => ({ exerciseId: ids[n], sets: s, reps: r, weight: null, restSec: n === 'Hip thrust' || n === 'Squat' || n === 'Soulevé de terre roumain' ? 120 : 75 })),
    });
  }

  for (const name of ['Pose classique', 'Pose hybride', 'Volume russe', 'Remplissage', 'Dépose']) await createRecord('lashService', { name, active: true, durationMin: null });

  const habits = [
    { name: 'Sport', emoji: '🏋️‍♀️', color: '#D4876C', targetPerWeek: 3, autoLink: 'sport' },
    { name: 'Eau', emoji: '💧', color: '#6C8EBF', targetPerWeek: 7, autoLink: 'water' },
    { name: 'TOEIC', emoji: '🇬🇧', color: '#8E7DBE', targetPerWeek: 6, autoLink: 'toeic' },
    { name: 'Lecture', emoji: '📖', color: '#9C6B53', targetPerWeek: 4, autoLink: 'none' },
    { name: 'Organisation', emoji: '🗂️', color: '#713F4B', targetPerWeek: 5, autoLink: 'none' },
    { name: 'Travail personnel', emoji: '💻', color: '#5E8C8A', targetPerWeek: 5, autoLink: 'focus' },
    { name: 'Self-care', emoji: '🌸', color: '#C98B9B', targetPerWeek: 7, autoLink: 'skincare' },
  ];
  for (const h of habits) await createRecord('habit', { ...h, active: true });

  const step = (titles: string[]) => titles.map((title, i) => ({ id: `s${i + 1}`, title }));
  await createRecord('routine', { name: 'Skincare matin', type: 'skincare_am', steps: step(['Nettoyant doux', 'Sérum', 'Crème hydratante', 'SPF']) });
  await createRecord('routine', { name: 'Skincare soir', type: 'skincare_pm', steps: step(['Démaquillage', 'Nettoyant', 'Soin actif / sérum', 'Crème de nuit', 'Baume à lèvres']) });
  await createRecord('routine', { name: 'Morning routine', type: 'morning', steps: step(['Grand verre d’eau', 'Ouvrir Jadou Planner & vérifier mes 3 priorités', 'Skincare matin', 'Petit-déjeuner protéiné']) });
  await createRecord('routine', { name: 'Evening routine', type: 'evening', steps: step(['Préparer les priorités de demain', 'Skincare soir', 'Journal (2 min)', 'Écrans off 30 min avant de dormir']) });

  await createRecord('goal', { title: 'Obtenir au minimum 600 points au TOEIC', category: 'toeic', horizon: 'quarterly', targetValue: 600, unit: 'points', status: 'active', steps: [{ id: 's1', title: 'Passer un test blanc pour connaître mon niveau', done: false }, { id: 's2', title: 'Suivre le planning de révision 6 jours / 7', done: false }, { id: 's3', title: 'Réserver la date d’examen', done: false }, { id: 's4', title: 'Atteindre 600+ en test blanc', done: false }] });

  const tpl = [
    { context: 'airbnb', name: 'Confirmation', body: 'Bonjour {voyageur} ! Merci pour votre réservation à {logement} du {arrivee} au {depart}. Je reste disponible pour toute question. À très bientôt ✨' },
    { context: 'airbnb', name: 'Instructions d’arrivée', body: 'Bonjour {voyageur}, votre arrivée approche ! L’arrivée est possible à partir de 16h. Je vous enverrai les informations d’accès le jour J. Bon voyage !' },
    { context: 'airbnb', name: 'Bienvenue', body: 'Bienvenue à {logement}, {voyageur} ! Le Wi-Fi et le guide du logement sont dans le salon. N’hésitez pas à me contacter au besoin. Excellent séjour ✨' },
    { context: 'airbnb', name: 'Départ', body: 'Bonjour {voyageur}, petit rappel : le départ est prévu le {depart} avant 11h. Merci de laisser les clés à l’endroit indiqué. Bon retour !' },
    { context: 'airbnb', name: 'Remerciement', body: 'Merci {voyageur} pour votre séjour à {logement} ! Ce fut un plaisir de vous accueillir. Un commentaire serait très apprécié ⭐ Au plaisir de vous revoir.' },
    { context: 'lash', name: 'Confirmation RDV', body: 'Coucou {cliente} ! Ton rendez-vous {prestation} est bien confirmé le {date} à {heure} ✨ Pense à venir sans mascara. À très vite !' },
    { context: 'lash', name: 'Rappel la veille', body: 'Hello {cliente} ! Petit rappel pour ton rendez-vous demain à {heure} 💕 Préviens-moi au moins 24h à l’avance en cas d’empêchement.' },
    { context: 'lash', name: 'Conseils après pose', body: 'Merci {cliente} ! Pour faire durer tes extensions : pas d’eau ni de vapeur pendant 24h, brosse-les chaque jour, évite les produits huileux et dors sur le dos si possible ✨ Remplissage conseillé dans 2 à 3 semaines.' },
  ];
  for (const t of tpl) await createRecord('messageTemplate', t);

  const vocab: [string, string, string, string][] = [
    ['to schedule', 'planifier, programmer', 'The meeting is scheduled for Monday morning.', 'Office'],
    ['deadline', 'date limite', 'We need to meet the deadline for the report.', 'Office'],
    ['invoice', 'facture', 'Please send the invoice to the accounting department.', 'Finance'],
    ['to reimburse', 'rembourser', 'The company will reimburse your travel expenses.', 'Finance'],
    ['budget', 'budget', 'The marketing budget was increased this quarter.', 'Finance'],
    ['revenue', 'chiffre d’affaires, recettes', 'Revenue rose by 12% last year.', 'Finance'],
    ['to postpone', 'reporter', 'The launch has been postponed until next month.', 'Office'],
    ['applicant', 'candidat·e', 'All applicants must submit a résumé.', 'HR'],
    ['to hire', 'embaucher', 'The firm plans to hire ten new employees.', 'HR'],
    ['colleague', 'collègue', 'My colleague will cover my shift tomorrow.', 'Office'],
    ['supervisor', 'responsable, supérieur·e', 'Ask your supervisor for approval.', 'HR'],
    ['to attend', 'assister à', 'Did you attend the conference in Lyon?', 'Events'],
    ['venue', 'lieu (d’un événement)', 'The venue can hold up to 300 guests.', 'Events'],
    ['to book', 'réserver', 'I booked a table for six people.', 'Travel'],
    ['itinerary', 'itinéraire, programme de voyage', 'Your itinerary includes two stops.', 'Travel'],
    ['boarding pass', 'carte d’embarquement', 'Have your boarding pass ready at the gate.', 'Travel'],
    ['delayed', 'retardé', 'Flight AF210 is delayed by forty minutes.', 'Travel'],
    ['warehouse', 'entrepôt', 'The goods are stored in our main warehouse.', 'Logistics'],
    ['shipment', 'livraison, envoi', 'The shipment should arrive on Friday.', 'Logistics'],
    ['out of stock', 'en rupture de stock', 'This model is currently out of stock.', 'Retail'],
    ['discount', 'remise, réduction', 'Members receive a 15% discount.', 'Retail'],
    ['receipt', 'reçu, ticket de caisse', 'Keep your receipt for any exchange.', 'Retail'],
    ['refund', 'remboursement', 'You can request a full refund within 30 days.', 'Retail'],
    ['customer service', 'service client', 'Contact customer service for assistance.', 'Retail'],
    ['survey', 'enquête, sondage', 'Please complete the customer satisfaction survey.', 'Marketing'],
    ['to launch', 'lancer', 'They will launch the new product line in spring.', 'Marketing'],
    ['advertisement', 'publicité', 'The advertisement appeared in several magazines.', 'Marketing'],
    ['market share', 'part de marché', 'The brand increased its market share.', 'Marketing'],
    ['to negotiate', 'négocier', 'We negotiated a better price with the supplier.', 'Business'],
    ['supplier', 'fournisseur', 'Our supplier delivers every Tuesday.', 'Business'],
    ['contract', 'contrat', 'Both parties signed the contract yesterday.', 'Business'],
    ['merger', 'fusion', 'The merger created the largest firm in the sector.', 'Business'],
    ['agenda', 'ordre du jour', 'The first item on the agenda is the budget.', 'Office'],
    ['minutes', 'compte rendu (de réunion)', 'Could you take the minutes of the meeting?', 'Office'],
    ['to be in charge of', 'être responsable de', 'She is in charge of the events team.', 'Office'],
    ['pharmacist', 'pharmacien·ne', 'Ask the pharmacist about possible side effects.', 'Health'],
    ['prescription', 'ordonnance', 'This medicine requires a prescription.', 'Health'],
    ['appointment', 'rendez-vous', 'I have a dental appointment at 3 p.m.', 'Health'],
    ['to recommend', 'recommander', 'I would recommend booking in advance.', 'General'],
    ['available', 'disponible', 'The manager is not available until noon.', 'General'],
  ];
  for (const [word, translation, example, theme] of vocab) await createRecord('flashcard', { word, translation, example, theme, level: 'new' });

  await setSetting('seeded', true);
}
