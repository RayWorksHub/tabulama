BEGIN;

UPDATE courses
SET
  application_deadline = '2026-08-21T20:00:00+02:00',
  description = 'Intenzív, gyakorlatorientált Python képzés középiskolásoknak az alapoktól a magabiztos programozásig. Az első szakasz stabil alapokat épít változókkal, elágazásokkal, ciklusokkal, függvényekkel és adatszerkezetekkel. A második szakaszban a tanuló választása szerint ágazati alapvizsgára vagy digitális kultúra érettségire készül. A képzést saját záróprojekt és valós vizsgahelyzetet szimuláló próbavizsga zárja. A korai egyösszegű ajánlat eredeti része 6 × 45 perc személyre szabott magánóra volt.',
  target_audience = 'Középiskolások, ágazati alapvizsgára vagy digitális kultúra érettségire készülők, valamint teljesen kezdők, akik érthetően és gyakorlati feladatokon keresztül szeretnének programozni tanulni.',
  prerequisites = 'Előzetes programozási tudás nem szükséges; a képzés az alapoktól indul.',
  syllabus = '1–2. hét: Fejlesztői környezet, első programok és a Python szintaxis alapjai\n3–4. hét: Elágazások, ciklusok és logikus gondolkodás\n5–6. hét: Függvények, listák, szótárak és összetettebb feladatok\n7–9. hét: Ágazati alapvizsga- vagy digitális kultúra érettségi specializáció\n10–11. hét: Önálló záróprojekt megtervezése és megépítése\n12. hét: Próbavizsga és személyre szabott visszajelzés'
WHERE id = 'course-python-2026';

COMMIT;
