/* Blackhole Battle v3.1.4: visual skins per level (VISUAL ONLY: never read by the simulation, so physics/solutions are unchanged).
   Keyed by level id. Per object type (asteroids/planets/moons/magnets) the value is either
     'skin'                      -> every object of that type
     ['a','b',...]               -> per object, in level-data order (null = default look)
     { y: [[maxY,'skin'],...], d:'skin' } -> by world y (first band whose maxY > object y), else d
   Asteroids: rock | ice | metal.  Planets: rocky | mars | earth | desert | lava | gas (Jupiter bands) | ringed (Saturn) |
   ice (ice giant) | sun | neutron.  Moons: luna | io | europa | ice.  Magnets: magnetar (neutron-star look). */
window.BH_SKINS = {
  // levels with no skinnable objects (only holes / white holes / flares): kept explicit so every level id is listed
  'kepler-01': {}, 'kepler-03': {}, 'magnetar-05': {}, 'magnetar-06': {}, 'magnetar-08': {},
  // Sector 1 — Kepler Belt (escape velocity, exoplanets, probes, asteroid belts)
  'kepler-02': { planets: ['gas', 'ice'] },                       // Kepler: more planets than stars — two exoplanets
  'kepler-04': { planets: ['lava', 'rocky'] },                    // Parker Solar Probe near the Sun: scorched worlds
  'kepler-05': { asteroids: 'rock' },                             // Mars landing: rocky debris
  'kepler-06': { asteroids: 'rock' },                             // main belt (Vesta) — rocky
  'kepler-07': { planets: ['earth'] },                            // Webb at L2, in line with Earth
  'kepler-08': { asteroids: 'metal', planets: ['earth'] },        // ISS: forever falling around Earth
  'kepler-09': { asteroids: { y: [[300, 'ice']], d: 'rock' } },   // two belts: rocky main belt (lower) + icy Kuiper belt (upper)
  'kepler-10': { asteroids: 'rock', planets: ['desert', 'rocky'] }, // Kepler-16b, a real Tatooine
  // Sector 2 — Moons of the Giant
  'giant-01': { planets: ['mars'], moons: ['luna'] },             // Phobos racing around Mars
  'giant-02': { planets: ['earth'], moons: ['luna'] },            // supermoon
  'giant-03': { planets: ['ringed'], moons: ['ice', 'ice'] },     // Janus & Epimetheus swap orbits at Saturn
  'giant-04': { asteroids: 'rock', moons: ['luna'] },             // DART vs Dimorphos
  'giant-05': { asteroids: 'ice', planets: ['gas'], moons: ['io'] }, // Shoemaker–Levy 9 torn apart by Jupiter
  'giant-06': { moons: 'ice' },                                   // Cassini through Saturn's ring gap
  'giant-07': { asteroids: 'rock', moons: ['ice'] },              // Voyager's grand tour
  'giant-08': { planets: ['gas'], moons: ['io', 'europa'] },      // Io's volcano carousel (Jupiter, Io, Europa)
  'giant-09': { planets: ['ice'], moons: 'ice' },                 // a year on Neptune (ice giant)
  'giant-10': { asteroids: 'ice', planets: ['gas', 'ice'], moons: ['europa', 'io', 'europa', 'luna'] }, // Europa's ocean
  // Sector 3 — Magnetar
  'magnetar-01': { planets: ['sun'] },                            // the Sun flips its poles
  'magnetar-02': { asteroids: 'rock' },                           // Earth's magnetic shield
  'magnetar-03': { planets: ['rocky', 'rocky', 'mars'] },
  'magnetar-04': { asteroids: 'ice' },                            // a comet tail points away from the Sun
  'magnetar-07': { asteroids: 'rock', planets: ['rocky'], magnets: 'magnetar' }, // first pulsar ("little green men")
  'magnetar-09': { magnets: 'magnetar' },                         // aurora rings
  'magnetar-10': { magnets: 'magnetar' },                         // SGR 1806-20 giant flare
  // Sector 4 — Wormholes
  'wormholes-01': { asteroids: 'metal', planets: ['rocky'], moons: ['luna'] },
  'wormholes-02': { asteroids: 'rock' },                          // 1919 eclipse
  'wormholes-03': { asteroids: 'metal' },                         // GPS satellites
  'wormholes-04': { asteroids: 'rock' },
  'wormholes-05': { asteroids: 'rock' },                          // the Sun's 170 000-year zigzag
  'wormholes-06': { asteroids: 'metal' },                         // twins study on the ISS
  'wormholes-07': { asteroids: 'rock', planets: ['earth'], moons: ['luna'] }, // lunar time
  'wormholes-08': { asteroids: 'ice' },                           // Interstellar's Gargantua (icy worlds)
  'wormholes-09': { asteroids: 'metal', moons: ['luna'] },        // Saturn V: three stages to the Moon
  'wormholes-10': { asteroids: 'rock', moons: ['ice'] },          // Webb's most distant galaxy
  // Sector 5 — Event Horizon
  'horizon-01': { asteroids: 'rock', planets: ['neutron', 'neutron'] }, // a 716 Hz "blender" pulsar
  'horizon-02': { asteroids: 'metal', planets: ['rocky'] },       // LIGO's first merger
  'horizon-03': { moons: ['ice', 'luna'] },                       // star S2 at the galactic centre
  'horizon-04': { asteroids: 'metal' },                           // LIGO, a ruler to 1/10 000 proton
  'horizon-05': {},                                               // spaghettification
  'horizon-06': { asteroids: 'rock', magnets: 'magnetar' },
  'horizon-07': { asteroids: 'metal', moons: ['luna'] },          // Event Horizon Telescope dishes
  'horizon-08': { asteroids: 'ice' },                             // double pulsar clock
  'horizon-09': { moons: ['luna'], magnets: 'magnetar' },         // Hawking radiation
  'horizon-10': { asteroids: { y: [[500, 'ice']], d: 'rock' }, moons: ['ice'], magnets: 'magnetar' }, // Sgr A*
};
if (typeof module !== 'undefined') module.exports = window.BH_SKINS;
