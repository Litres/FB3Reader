FB3Reader engine
=========

Open source (LGPL) JavaScript-based eBook reader engine written on [TypeScript](https://www.typescriptlang.org/).

Why javascript, it is slow!
---------
The overall idea is to create a simplest possible wrapper for the system-native web-browser. In the
hope of browser perfectioning, we delegate to the browser 90% or more of the critical work and hope that overall
performance of the engine will be nice even if JS will not perform perfectly.


Why TypeScript, it is new!
---------
The reason is simple: nobody wants to maintain 300kb of pure hardcore JS code. I (GribUser) have twice created web-based
reader for fb2 (as you can see on [LitRes](http://www.litres.ru/)) and it got harder and harder and harder
to maintain the code. When I started to draw a class structure for the new reader I got sick of all this (function)()) stuff. Never again.
[TypeScript](https://typescriptlang.org/) is nice and simple, and it allows you to painlessly maintain
even a huge and feature-rich code.


Who can contribute
---------
Anyone. At a moment, I'm building a frame for a project and plan to rule the trunk for some time by myself. But you can
send me your diff or make a pul request right now, if you feel urgent. It's always fun when somebody
make your job for you :)


Contacts
---------
* gu@litres.ru - Dmitry Gribov, project owner
* denis@litres.ru - Denis Kovalkov. Just in case
