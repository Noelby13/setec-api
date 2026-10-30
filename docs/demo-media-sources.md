# Demo program media sources

This register documents the manifest in `database/demo_media.json`: 16 synthetic careers and the original IT offerings `ccna`, `ciberseguridad`, and `ia-redes`. All 19 entries reference a local public cover in `/uploads/programas/demo-v2-<career>.<ext>` and a supported YouTube watch URL. Related careers share source photos, stored under each career's expected filename. There are 14 distinct source images and 18 distinct videos.

## Local covers and image sources

The photo files are cached in `uploads/programas/`, where the API's public-upload guard explicitly permits `/uploads/programas/<file>`. The cache script was run successfully: all 19 files have JPEG or PNG magic bytes, match their filename extension, and exist under the demo-only prefix. The 14 unique public source GETs returned HTTP 200 and the MIME types/byte sizes below. The script also validates response MIME and image signatures before writing.

| Career use | Source page and credit | License / reuse | Cached response |
| --- | --- | --- | --- |
| Medicina | [Human heart](https://commons.wikimedia.org/wiki/File:Human_heart.png), Mikael Häggström | Public domain | 200 `image/png`, 68,643 bytes; reused for medicina |
| Enfermería, salud pública | [A Medical Staff in a Clinic](https://www.pexels.com/photo/a-medical-staff-in-a-clinic-7108317/), Pavel Danilyuk | [Pexels Free License](https://www.pexels.com/license/) | 200 `image/jpeg`, 29,513 bytes per career file |
| Odontología | [Dentistry](https://commons.wikimedia.org/wiki/File:Dentistry.jpg), Leeds City Council / Commons listing | Council's royalty-free permission stated on Commons; not a CC license | 200 `image/jpeg`, 226,990 bytes |
| Sistemas, CCNA, ciberseguridad, IA en redes | [Server Racks on Data Center](https://www.pexels.com/photo/server-racks-on-data-center-5480781/), Brett Sayles | [Pexels Free License](https://www.pexels.com/license/) | 200 `image/jpeg`, 151,075 bytes per career file |
| Civil | [Wheeling Suspension Bridge](https://commons.wikimedia.org/wiki/File:Wheeling_Suspension_Bridge.jpg), Library of Congress / NPS / HAER | Public domain | 200 `image/jpeg`, 215,836 bytes (960 px thumbnail) |
| Industrial | [Conveyor system in a factory](https://commons.wikimedia.org/wiki/File:Conveyor_system_in_a_factory.jpg), falco / Pixabay via Commons | CC0 1.0 | 200 `image/jpeg`, 2,475,948 bytes |
| Agronomía | [Farmer Walking Through Field During Planting Season](https://www.pexels.com/photo/farmer-walking-through-field-during-planting-season-37201242/), Mark Stebnicki | [Pexels Free License](https://www.pexels.com/license/) | 200 `image/jpeg`, 87,057 bytes |
| Veterinaria | [Dog Getting Checked](https://www.pexels.com/photo/dog-getting-checked-7469216/), Mikhail Nilov | [Pexels Free License](https://www.pexels.com/license/) | 200 `image/jpeg`, 35,697 bytes |
| Derecho | [Stately Cherokee County Courthouse Architecture](https://www.pexels.com/photo/stately-cherokee-county-courthouse-architecture-34998690/), Connor Scott McManus | [Pexels Free License](https://www.pexels.com/license/) | 200 `image/jpeg`, 56,610 bytes |
| Administración | [People at a Meeting in the Office](https://www.pexels.com/photo/people-at-a-meeting-in-the-office-4623489/), Ketut Subiyanto | [Pexels Free License](https://www.pexels.com/license/) | 200 `image/jpeg`, 50,306 bytes |
| Contabilidad, economía | [Calculator and Pen on Table](https://www.pexels.com/photo/calculator-and-pen-on-table-209224/), Pixabay via Pexels | Pexels listing identifies the photo as free to use / CC0 | 200 `image/jpeg`, 75,251 bytes per career file |
| Educación | [Students Inside a Classroom Listening Attentively](https://www.pexels.com/photo/students-inside-a-classroom-listening-attentively-8423018/), Pavel Danilyuk | [Pexels Free License](https://www.pexels.com/license/) | 200 `image/jpeg`, 80,497 bytes |
| Psicología | [Man in a Psychotherapy Session](https://www.pexels.com/photo/man-in-a-psychotherapy-session-7579183/), Antoni Shkraba | [Pexels Free License](https://www.pexels.com/license/) | 200 `image/jpeg`, 31,647 bytes |
| Comunicación | [Woman Reporting on Camera](https://www.pexels.com/photo/woman-reporting-on-camera-10464471/), cottonbro studio | [Pexels Free License](https://www.pexels.com/license/) | 200 `image/jpeg`, 41,575 bytes |

Eight Wikimedia upload URLs had returned HTTP 429 in the first check and one bounded range retry. Their cached covers were replaced with directly verified Pexels renditions where relevant. Four Wikimedia images whose downloads succeeded remain: heart, dentistry, bridge thumbnail, and conveyor. No generated or placeholder art is used.

To validate/rebuild missing cache files from the source URLs recorded in the manifest, run:

```sh
node scripts/cache-demo-media.mjs
```

The script's help is `node scripts/cache-demo-media.mjs --help`. It has no package dependencies or credentials, reuses valid existing cache files, and refuses any target outside the `demo-v2-*` public-program filename prefix.

## Video references and checks

The portal renderer supports YouTube URLs and turns their 11-character IDs into YouTube-nocookie embeds (`../setecportal/src/components/ProgramMedia.jsx`). All 18 unique video IDs were checked against public YouTube oEmbed JSON; each returned HTTP 200 `application/json` with the exact title and channel below. This confirms the metadata endpoint serves each item, not uninterrupted playback in every region or account configuration. YouTube's [Terms of Service](https://www.youtube.com/t/terms) describe use of its embeddable player. The watch URL for each career is recorded as both `video_url` and `video_source_url`.

| Career(s) | Verified title | oEmbed author / channel | URL |
| --- | --- | --- | --- |
| Medicina, enfermería | Introduction to Anatomy & Physiology: Crash Course Anatomy & Physiology #1 | CrashCourse | https://www.youtube.com/watch?v=uBGl2BujkPQ |
| Odontología | Introduction to Dental Anatomy | Dr Teeth | https://www.youtube.com/watch?v=XNbzd6yqNbg |
| Salud pública | Introduction to Public Health | Centers for Disease Control and Prevention (CDC) | https://www.youtube.com/watch?v=-dmJSLNgjxo |
| Sistemas | The Internet: Crash Course Computer Science #29 | CrashCourse | https://www.youtube.com/watch?v=AEaKrq3SpW8 |
| CCNA | CCNA v7: Introducción General al Curso – Aprende Redes desde Cero con NetAcad | NetTel Academy | https://www.youtube.com/watch?v=Vi5RPgUH7go |
| Ciberseguridad | Cybersecurity: Crash Course Computer Science #31 | CrashCourse | https://www.youtube.com/watch?v=bPVaOlJ6ln0 |
| Posgrado avanzado en redes con IA | How Cisco Is Using AI to Fix Networks | David Bombal | https://www.youtube.com/watch?v=VY0s4JUp-K8 |
| Civil | Every Kind of Bridge Explained in 15 Minutes | Practical Engineering | https://www.youtube.com/watch?v=DX_zkaK5PaI |
| Industrial | How Things Are Made \| An Animated Introduction to Manufacturing Processes | The Efficient Engineer | https://www.youtube.com/watch?v=Um_g8sQ_p3Y |
| Agronomía | Smart farming and climate technologies | Food and Agriculture Organization of the United Nations | https://www.youtube.com/watch?v=uQlqP0F0VAA |
| Veterinaria | Livestock Farmer Field School teaches good practices to reduce antimicrobial resistance | Food and Agriculture Organization of the United Nations | https://www.youtube.com/watch?v=bADLEuKGu8w |
| Derecho | Legal System Basics: Crash Course Government and Politics #18 | CrashCourse | https://www.youtube.com/watch?v=mXw-hEB263k |
| Administración | Productivity and Growth: Crash Course Economics #6 | CrashCourse | https://www.youtube.com/watch?v=UHiUYj5EA0w |
| Contabilidad | ACCOUNTING BASICS: a Guide to (Almost) Everything | Accounting Stuff | https://www.youtube.com/watch?v=yYX4bvQSqbo |
| Educación | Crash Course Study Skills Preview | CrashCourse | https://www.youtube.com/watch?v=IhuwS5ZLwKY |
| Psicología | Intro to Psychology: Crash Course Psychology #1 | CrashCourse | https://www.youtube.com/watch?v=vo4pMVb0R6M |
| Comunicación | Introduction to Media Literacy: Crash Course Media Literacy #1 | CrashCourse | https://www.youtube.com/watch?v=AD7N-1Mj-DU |
| Economía | Macroeconomics: Crash Course Economics #5 | CrashCourse | https://www.youtube.com/watch?v=d8uTB5XorBw |

## Verification boundary

The manifest parses and contains 19 expected keys; every entry has a local public cover path, source page, download URL, license, attribution, Spanish description, and supported YouTube video URL. The local cache script was run to completion, caching all 19 career files from 14 source images with verified JPEG/PNG content types and signatures. The app guard exposes `/uploads/programas/<file>` publicly, and the frontend cover helper resolves these relative paths against the API origin. No database or frontend changes were made in this media task.
