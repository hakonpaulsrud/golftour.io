// Regler – Swedish summary of the tour rulebook (Regelbok). The calendar is generated from events.json.
import { POINTS, FINAL_HEAD_START, difficultyAdjustment } from './engine.js';
import { dateRange } from './time.js';
import { esc, fmtPoints } from './views.js';

const SETTINGS = [
  ['Spelform', 'Stroke Play'],
  ['Antal hål', '18'],
  ['Tee', 'Näst längsta tillgängliga tee'],
  ['Vind', 'Calm'],
  ['Greenhastighet', 'Medium'],
  ['Flaggplacering', 'Medium'],
  ['Greenfirmness', 'Normal'],
  ['Fairwayfirmness', 'Normal'],
  ['Lie Penalties', 'På'],
  ['Auto Putt', 'Fixed'],
  ['Sikthjälp', 'Tillåten'],
  ['Banöversikt och avstånd', 'Tillåtet'],
  ['Slagdata', 'Tillåtet'],
  ['Automatisk slagkorrigering', 'Inte tillåten'],
];

const DIFFICULTY_NAMES = ['Mycket lätt', 'Lätt', 'Normal', 'Svår', 'Mycket svår'];

const signed = (n) => (n > 0 ? `+${fmtPoints(n)}` : n < 0 ? `−${fmtPoints(-n)}` : '0');

const table = (head, rows, cls = '') =>
  `<div class="table-wrap"><table class="rules-table ${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;

const section = (id, title, body) => `<section class="rules-section" id="regel-${id}"><h3>${title}</h3>${body}</section>`;

export function renderRegler(data) {
  const calendar = table(
    ['#', 'Tävling / bana', 'Datum', 'Svår.'],
    data.events.map((e) => [
      e.id === 'final' ? 'F' : Number(e.id),
      `<strong>${esc(e.name)}</strong>${e.multiplier > 1 ? ` <span class="badge badge-gold">${fmtPoints(e.multiplier)}×</span>` : ''}<br><small>${esc(e.course)}</small>`,
      e.id === 'final' ? `${dateRange(e.start, e.end)}<br><small>en gemensam dag</small>` : dateRange(e.start, e.end),
      `${e.difficulty}/5`,
    ]),
    'calendar',
  );

  const toc = [
    ['format', 'Tävlingsformat'],
    ['kalender', 'Kalender'],
    ['installningar', 'Simulatorinställningar'],
    ['handicap', 'Tourhandicap'],
    ['poang', 'Order of Merit'],
    ['final', 'Grand Final'],
    ['rapportering', 'Resultatrapportering'],
    ['mulligans', 'Mulligans och tekniska fel'],
    ['deadlines', 'Deadlines'],
    ['fairplay', 'Avgifter och fair play'],
  ];

  return `
    <section class="page rules">
      <header class="page-header">
        <h2>Regler</h2>
        <p class="page-sub">Sammanfattning av det officiella tävlingsreglementet. Tävlingsledning: Erik Ejerfeldt.</p>
      </header>
      <nav class="rules-toc" aria-label="Innehåll">${toc.map(([id, t]) => `<a href="#regler/${id}">${t}</a>`).join('')}</nav>

      ${section(
        'format',
        '1. Tävlingsformat',
        `<ul>
          <li>12 deltävlingar och en avslutande Grand Final, spelade i TrackMan-simulator.</li>
          <li>Varje deltävling spelas över 18 hål som <strong>individuellt slagspel med handicap (netto)</strong>.</li>
          <li>Varje spelare får spela <strong>en officiell runda</strong> per deltävling.</li>
          <li>Varje deltävling har en spelperiod på tio dagar. Rundan kan spelas när och var som helst, så länge tävlingsinställningarna följs.</li>
          <li>Samtliga 12 deltävlingar räknas i Order of Merit. Inga resultat stryks.</li>
          <li>De sex bästa i Order of Merit kvalificerar sig till Grand Final.</li>
        </ul>`,
      )}

      ${section(
        'kalender',
        '2. Kalender',
        `${calendar}
        <p>Tävlingsuppehåll 21 december–1 januari och 13–19 mars. Samtliga deltävlingar stänger <strong>23:59 svensk tid</strong> på sista tävlingsdagen. Exakt datum för Grand Final meddelas senare.</p>`,
      )}

      ${section(
        'installningar',
        '3. Simulatorinställningar',
        `<p>Gäller hela säsongen, inklusive finalen. Varje spelare ansvarar för att rätt inställningar används före rundan.</p>
        ${table(['Inställning', 'Värde'], SETTINGS)}
        <p><strong>Auto Putt Fixed</strong> – samma för alla oavsett handicap: inom 3,05 m 1 putt, 3,05–19,81 m 2 puttar, över 19,81 m 3 puttar. TrackMans faktiska Fixed-funktion styr registreringen.</p>`,
      )}

      ${section(
        'handicap',
        '4. Tourhandicap',
        `<p>Touren använder ett eget handicapsystem, separat från Golf-ID och TrackMan-handicap. Alla börjar med sitt Golf-ID-handicap.</p>
        <h4>Bansvårighet</h4>
        ${table(
          ['Svårighet', 'Justering'],
          DIFFICULTY_NAMES.map((n, i) => [`${i + 1}/5 – ${n}`, signed(difficultyAdjustment(i + 1))]),
        )}
        <h4>Spelhandicap och nettoresultat</h4>
        <p class="formula">Spelhandicap = Tourhandicap − svårighetsjustering<br>Nettoresultat = Bruttoslag − spelhandicap</p>
        <p>Spelhandicap avrundas till närmaste heltal, exakt halvtal avrundas uppåt.
        <em>Exempel:</em> tourhandicap 25,0 på en 4/5-bana → 25,0 − (−1,5) = 26,5 → spelhandicap 27. Brutto 100 ger netto 73.</p>
        <h4>Uppdatering efter varje deltävling</h4>
        <p class="formula">Prestationshandicap = Bruttoslag − banans par + svårighetsjustering<br>Nytt HCP = Gammalt HCP + 25 % × (prestations-HCP − gammalt HCP)</p>
        <p>Förändringen begränsas till högst <strong>−3,0</strong> och <strong>+1,0</strong> per deltävling.
        <em>Exempel:</em> 25,0 och prestationshandicap 17,0 → skillnad −8,0 → 25 % = −2,0 → nytt handicap 23,0.</p>
        <p>Endast den senaste rundan påverkar uppdateringen. Missar du en deltävling behåller du ditt handicap. Handicap ändras aldrig retroaktivt. Det lagras med full precision men visas med en decimal.</p>`,
      )}

      ${section(
        'poang',
        '5. Order of Merit',
        `${table(
          ['Placering', 'Poäng'],
          POINTS.map((p, i) => [i + 1, p]),
          'points',
        )}
        <ul>
          <li>Poängen baseras alltid på 12 deltagarplatser, även om någon hoppar av.</li>
          <li><strong>Multiplikatorer:</strong> Christmas Classic 1,5×, Winter Major 1,5×, Tour Championship 2×.</li>
          <li><strong>Delade placeringar:</strong> samma nettoresultat delar lika på poängen för placeringarna. Två delade tvåor får (80 + 65) / 2 = 72,5 poäng var. Multiplikatorn appliceras efter delningen.</li>
          <li><strong>Missad deltävling:</strong> du får poäng från de sista placeringarna, delade lika om flera missar (1 → 5, 2 → 7,5, 3 → 10, 4 → 12,5, 5 → 15 poäng var). Den som spelar placeras alltid före den som inte spelar. Multiplikatorn gäller även dessa poäng.</li>
          <li><strong>Slutlig ranking:</strong> alla poäng summeras. Vid lika poäng avgör flest segrar, därefter flest andraplatser, tredjeplatser och så vidare.</li>
        </ul>`,
      )}

      ${section(
        'final',
        '6. Grand Final',
        `<p>De sex främsta i Order of Merit spelar final på <strong>Oakmont Country Club</strong> (5/5), 18 hål netto slagspel med samma inställningar och handicapmodell. Alla spelar samma dag. Kan en kvalificerad spelare inte delta går platsen till nästa i rankingen.</p>
        ${table(
          ['Placering i OoM', 'Startfördel'],
          FINAL_HEAD_START.map((h, i) => [i + 1, h ? `−${h} slag` : '0 slag']),
        )}
        <p class="formula">Finalresultat = Bruttoslag − spelhandicap − startfördel</p>
        <p>Lägst resultat blir <strong>Winter Tour Champion 2026/27</strong>. Vid lika resultat spelas särspel om möjligt, annars avgör tävlingsledningen. Finalen ger inga Order of Merit-poäng.</p>`,
      )}

      ${section(
        'rapportering',
        '7. Resultatrapportering',
        `<p>Rapportera dina bruttoslag till tävlingsledningen. Tävlingsledningen kan begära bild på TrackMan-scorekortet.</p>
        <p><strong>Hemliga resultat:</strong> resultat från en pågående deltävling publiceras inte förrän tävlingen har stängt och resultaten godkänts. Det som visas under tävlingen är vilka som har spelat. Under Grand Final visas resultaten live.</p>`,
      )}

      ${section(
        'mulligans',
        '8. Mulligans och tekniska fel',
        `<ul>
          <li>Mulligan får endast användas vid <strong>uppenbara tekniska fel</strong> – aldrig för vanliga dåliga slag.</li>
          <li>Felet ska uppmärksammas direkt, före nästa slag, och bevittnas och godkännas av en annan närvarande spelare.</li>
          <li>Spelar du ensam ska felet dokumenteras och godkännas av tävlingsledningen innan mulligan används.</li>
          <li>Händelsen ska rapporteras till tävlingsledningen, som kan godkänna omstart vid allvarliga tekniska problem.</li>
        </ul>`,
      )}

      ${section(
        'deadlines',
        '9. Deadlines och sena rundor',
        `<p>Varje deltävling stänger 23:59 svensk tid sista tävlingsdagen. Sena rundor tillåts endast vid särskilda skäl och efter godkännande från tävlingsledningen. Ingen har automatisk rätt till förlängd speltid.</p>`,
      )}

      ${section(
        'fairplay',
        '10–11. Avgifter och fair play',
        `<p>Deltagaravgift och prisfördelning meddelas separat. Avgiften ska vara betald före första officiella rundan.</p>
        <p>Spela ärligt. Manipulation av simulatorinställningar, resultat eller slagregistrering är förbjuden. Tävlingsledningen kontrollerar resultat, beslutar om diskvalifikationer och avgör regeltvister – och dess beslut är slutgiltigt.</p>`,
      )}

      <p class="rules-motto">12 deltävlingar. 6 finalister. 1 mästare.</p>
    </section>`;
}
