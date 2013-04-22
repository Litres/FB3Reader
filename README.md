FB3Reader engine
=========

Open source eBook reader engine based on JS written on [TypeScript](https://typescriptlang.org/).

Why javascript, it is slow!
---------
The overall idia is to create a simpleiest possible wrapper for the system-native web-browser. In the
hope of browser perfactioning, we delegate to the browser 90% or more of critical work and hope that overall
performance of the engine will be nice even if JS will not perform perfectly.


Why TypeScript, it is new!
---------
The reason is simple: nobody wants to maintain 0.3mb of hardcore JS code. I (GribUser) have tvice created web-based
reader for fb2 (as you can see on [LitRes](http://www.litres.ru/)) and it got harder and harder and harder
maintain the code. When I started to draw class structure for new reader I got sick of all this (function)()) stuff.
[TypeScript](https://typescriptlang.org/) is nice and simple, and it allows you to painlessly maintain
even a huge and feauture-rich code.


Who can contrubute
---------
Anyone. At a moment, I'm building a frame for a project and plan rule the trunc for some time by myself. But you can
send me your diff or make a pul request right now, if you feel urgent. It's always fun when somebody
maked your job for you :)


Contacts
---------
* gu@litres.ru - Dmitry Gribov, project owner
* denis@litres.ru - Denis Kovalkov. Just in case
