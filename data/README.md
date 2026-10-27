# Officer database

`officers.js` in the site root is the one officer database every game loads
(Mystery Officer, Full Ranks, Muster and Rise or Fall). Each entry carries a
source and a link.

The files in `sources/` are the rows the database was built from, copied from:

* Wikipedia, List of people of the Three Kingdoms (A to Z), which cites the
  Sanguozhi, Houhanshu and Jin Shu by volume (`BtoJ.txt`, `LtoS.txt`, `TtoZ.txt`, `roles.txt`)
* Wikipedia, List of fictional people of the Three Kingdoms, for characters who
  only appear in the novel (`fictional.txt`)
* individual Wikipedia articles, and Kongming's Archives RTK8 roster for the
  five officers no other source covers (`extras.txt`)

Where an existing game already had a curated value (faction, dates, home
province) for one of its own answers, that value was kept. Eight dates differ
from the Wikipedia list by a year because the list gives the Chinese calendar
year; those entries carry a `dn` note.
